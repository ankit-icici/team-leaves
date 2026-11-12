/* Team Leaves alerts — the sender. Runs in Google Apps Script, in the Google
   account that owns the Firebase project, on a timer every 5 minutes. (GitHub's
   scheduler was tried first and ran only a few percent of its runs.)

   Each run:
     1. New and cancelled leaves → the team's lead (not about their own changes).
     2. From 9:00 AM IST, once a day, on working days (Mon–Fri and the 1st, 3rd
        and 5th Saturdays): "On leave today" to the team's lead; on Mondays,
        "On leave this week" instead, if the lead wants that. Nothing is sent
        when nobody is on leave.
   Alerts are for team leads only (Ankit, November 10, 2026): every alert goes
   only to the lead of the team it's about.
     3. Test alerts asked for from the app's Alerts screen.

   Signs in as the script's owner (ScriptApp.getOAuthToken), so there is no key.
   Setup: run setup() once from the editor. Logs: the editor's Executions page
   (private to the owner). Rules for what to send live in logic.js.            */

var PROJECT = "team-leaves-270f6";
var BASE = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents";
var FCM_URL = "https://fcm.googleapis.com/v1/projects/" + PROJECT + "/messages:send";
var APP_URL = "https://ankit-icici.github.io/team-leaves/";
var MORNING_FROM = 9 * 60;      // minutes after midnight IST: first run after 9:00
var MORNING_UNTIL = 12 * 60;    // never later than noon, if every run before was missed

/* ── Timer ───────────────────────────────────────────────────────────── */

/* Run once from the editor: replaces any timers with one every 5 minutes, then
   does a dry run so the log shows what would be sent. */
function setup() {
  dryRun();      // first, so the log shows what would be sent before anything can be
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("tick").timeBased().everyMinutes(5).create();
  console.log("Timer set: every 5 minutes.");
}
function tick() { runAlerts_({}); }
function dryRun() { runAlerts_({ dry: true, forceMorning: true }); }

/* ── Firestore and FCM over REST ─────────────────────────────────────── */

function call_(url, method, body) {
  var opt = { method: method || "get", muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken(), "x-goog-user-project": PROJECT } };
  if (body !== undefined) { opt.contentType = "application/json"; opt.payload = JSON.stringify(body); }
  var r = UrlFetchApp.fetch(url, opt), text = r.getContentText() || "";
  var json = {}; try { json = text ? JSON.parse(text) : {}; } catch (e) {}
  return { code: r.getResponseCode(), json: json, text: text };
}
function ok_(r, what) { if (r.code >= 300) throw new Error(what + ": HTTP " + r.code + " " + r.text.slice(0, 300)); return r.json; }

function val_(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return +v.integerValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(val_);
  if ("mapValue" in v) { var o = {}, f = v.mapValue.fields || {}; Object.keys(f).forEach(function (k) { o[k] = val_(f[k]); }); return o; }
  var k = Object.keys(v)[0]; return k ? v[k] : null;
}
function fields_(doc) { var o = {}, f = (doc && doc.fields) || {}; Object.keys(f).forEach(function (k) { o[k] = val_(f[k]); }); return o; }

function listDocs_(path) {
  var out = [], page = null;
  do {
    var j = ok_(call_(BASE + "/" + path + "?pageSize=300" + (page ? "&pageToken=" + encodeURIComponent(page) : "")), "list " + path);
    (j.documents || []).forEach(function (d) { out.push([d.name.split("/").pop(), fields_(d)]); });
    page = j.nextPageToken;
  } while (page);
  return out;
}
function getDoc_(path) {
  var r = call_(BASE + "/" + path);
  if (r.code === 404) return null;
  return fields_(ok_(r, "get " + path));
}
/* Write simple string/bool fields, leaving the rest of the document alone. */
function patchDoc_(path, f) {
  var q = Object.keys(f).map(function (k) { return "updateMask.fieldPaths=" + encodeURIComponent(k); }).join("&");
  var enc = {}; Object.keys(f).forEach(function (k) {
    enc[k] = typeof f[k] === "boolean" ? { booleanValue: f[k] } : { stringValue: String(f[k]) }; });
  ok_(call_(BASE + "/" + path + "?" + q, "patch", { fields: enc }), "save " + path);
}

/* Several documents at once (one round trip): {path: fields or null}. */
function getDocs_(paths) {
  var tok = ScriptApp.getOAuthToken(), out = {};
  var res = UrlFetchApp.fetchAll(paths.map(function (p) {
    return { url: BASE + "/" + p, method: "get", muteHttpExceptions: true,
             headers: { Authorization: "Bearer " + tok, "x-goog-user-project": PROJECT } };
  }));
  res.forEach(function (r, i) {
    var code = r.getResponseCode();
    if (code === 404) { out[paths[i]] = null; return; }
    if (code >= 300) throw new Error("get " + paths[i] + ": HTTP " + code + " " + r.getContentText().slice(0, 300));
    out[paths[i]] = fields_(JSON.parse(r.getContentText() || "{}"));
  });
  return out;
}

/* Phones that asked for a test alert since `since` (ISO time). Reads only those. */
function testRequests_(since) {
  var j = ok_(call_(BASE + ":runQuery", "post", { structuredQuery: {
    from: [{ collectionId: "devices" }],
    where: { fieldFilter: { field: { fieldPath: "testAt" }, op: "GREATER_THAN", value: { stringValue: since } } } } }),
    "test requests");
  return (Array.isArray(j) ? j : []).filter(function (x) { return x.document; })
    .map(function (x) { return [x.document.name.split("/").pop(), fields_(x.document)]; });
}

function loadState_() {
  var d = getDoc_("meta/alerts") || {};
  try { return JSON.parse(d.state || "{}"); } catch (e) { return {}; }
}
function saveState_(state, dry) { if (!dry) patchDoc_("meta/alerts", { state: JSON.stringify(state) }); }

/* One failed send never stops the run (that would make the next run repeat
   everything): retry once on a busy server, mark unreachable phones, log the rest. */
function send_(dev, title, body, tag, url, log, dry, retried) {
  log.push("  -> phone " + dev[0].slice(0, 8) + ": " + title + " | " + body.replace(/\n/g, " / "));
  if (dry) return;
  var msg = { message: { token: dev[1].token, webpush: {
    headers: { Urgency: "high", TTL: "43200" },
    data: { title: title, body: body, tag: tag, url: url } } } };
  for (var attempt = 1; attempt <= 2; attempt++) {
    try {
      var r = call_(FCM_URL, "post", msg);
      if (r.code < 300) return;
      if (r.code === 404 || /UNREGISTERED/.test(r.text) || (/INVALID_ARGUMENT/.test(r.text) && /token/i.test(r.text))) {
        log.push("     phone no longer reachable (HTTP " + r.code + " " + r.text.replace(/\s+/g, " ").slice(0, 160) + ")");
        try {
          var cur = getDoc_("devices/" + dev[0]);
          if (!cur) { log.push("     the phone's record is gone; nothing to mark"); return; }
          if (cur.token && cur.token !== dev[1].token && !retried && !cur.off) {
            // the phone renewed its address meanwhile: send this alert there instead
            log.push("     the phone has a new address; sending there");
            send_([dev[0], cur], title, body, tag, url, log, dry, true);
            return;
          }
          if (cur.token === dev[1].token) {
            patchDoc_("devices/" + dev[0], { dead: true, deadAt: new Date().toISOString() });
            log.push("     marked unreachable until the phone renews its address");
          }
        } catch (e2) { log.push("     couldn't mark it: " + e2); }
        return;
      }
      if (attempt === 1 && (r.code === 429 || r.code >= 500)) { Utilities.sleep(3000); continue; }
      log.push("     failed: HTTP " + r.code + " " + r.text.slice(0, 200));
      return;
    } catch (e) {
      if (attempt === 1) { Utilities.sleep(3000); continue; }
      log.push("     failed: " + e);
      return;
    }
  }
}

/* ── One run ─────────────────────────────────────────────────────────── */

function runAlerts_(opts) {
  var dry = !!opts.dry;
  var lock = LockService.getScriptLock(), log = null;
  if (!lock.tryLock(2000)) { console.log("Previous run still going; skipped."); return; }
  try {
    var now = istNow(opts.nowMs || Date.now()), today = now.day, tk = dKey(today), year = today.getUTCFullYear();
    log = ["Run at " + now.stamp + " IST" + (dry ? " (dry run: nothing is sent or saved)" : "")];
    var state = loadState_();
    state.teams = state.teams || {}; state.tests = state.tests || {};

    // Teams and their leave, every year document fetched in one go
    var teamDocs = listDocs_("teams").filter(function (x) {
      if (x[1].hidden) { delete state.teams[x[0]]; return false; }   // shown again later: starts afresh
      return true;
    });
    var yearPaths = [];
    teamDocs.forEach(function (x) { yearPaths.push("teams/" + x[0] + "/years/" + year, "teams/" + x[0] + "/years/" + (year + 1)); });
    var years = yearPaths.length ? getDocs_(yearPaths) : {};
    var teams = teamDocs.map(function (x) {
      var tid = x[0], t = x[1], days = {};
      var roster = (t.members || []).filter(function (m) { return m && m.id; });
      [year, year + 1].forEach(function (y) {
        var dd = ((years["teams/" + tid + "/years/" + y] || {}).days) || {};
        Object.keys(dd).forEach(function (mid) {
          days[mid] = days[mid] || {};
          Object.keys(dd[mid] || {}).forEach(function (k) { if (k.length === 10) days[mid][k] = true; });
        });
      });
      var ids = {}; roster.forEach(function (m) { ids[m.id] = true; });
      return { id: tid, name: t.name || "Team", lead: t.leadId, roster: roster, ids: ids, days: days };
    });

    // What changed since the last run (lead alerts), and is the morning alert due?
    var changes = teams.map(function (t) {
      return t.lead ? diffTeam(state.teams[t.id], t.days, t.roster.map(function (m) { return m.id; }), tk) : {};
    });
    var anyChange = changes.some(function (c) { return Object.keys(c).length; });
    var due = (state.lastMorning !== tk && isWorkingDay(today) && now.minutes >= MORNING_FROM && now.minutes < MORNING_UNTIL) || !!opts.forceMorning;

    // Phone records are read only when there is something to send: every record
    // read counts against the free plan's daily reads.
    var devices = (anyChange || due) ? liveDevices(listDocs_("devices")) : [];
    log.push(teams.length + " teams" + (devices.length ? ", " + devices.length + " phones" : ""));
    // how many of the teams on this run the phone's person leads (for the week title)
    var ledCount = function (d) {
      return teams.filter(function (tt) { return tt.lead && tt.ids[tt.lead] && (d.subs || []).some(function (x) { return x && x.tid === tt.id && x.mid === tt.lead; }); }).length;
    };

    // 1. New and cancelled leaves -> the lead (a team with no lead gets none)
    var runId = now.stamp.replace(/\D/g, ""), told = {};
    teams.forEach(function (t, i) {
      var names = shortNames(t.roster), url = APP_URL + "?t=" + t.id;
      Object.keys(changes[i]).forEach(function (mid) {
        if (mid === t.lead) return;
        var c = changes[i][mid], msg = changeAlert(names[mid], t.name, c.added, c.removed, year);
        log.push(t.name + ": " + msg[0] + " - " + msg[1]);
        subscribers(devices, t.id, t.ids, t.lead).forEach(function (dev) {
          var key = dev[0] + "|" + msg[0] + "|" + c.added.join() + "|" + c.removed.join();
          if (!wants(dev[1], "leads") || told[key]) return;   // one alert per phone per change
          told[key] = true;
          send_(dev, msg[0], msg[1], "chg-" + t.id + "-" + mid + "-" + runId, url, log, dry);
        });
      });
      var saved = {};
      Object.keys(t.days).forEach(function (mid) {
        var up = Object.keys(t.days[mid]).filter(function (k) { return k >= tk; }).sort();
        if (up.length) saved[mid] = up;
      });
      state.teams[t.id] = { roster: t.roster.map(function (m) { return m.id; }), days: saved };
    });
    if (anyChange) saveState_(state, dry);   // straight away: a later failure must not resend these

    // 2. Morning: today, or Monday's week ahead
    if (due) {
      if (!dry) { state.lastMorning = tk; saveState_(state, dry); }   // before sending: a failure can't repeat it
      var monday = weekday(today) === 0;
      log.push("Morning alerts" + (monday ? " (Monday: week ahead)" : ""));
      teams.forEach(function (t) {
        var url = APP_URL + "?t=" + t.id;
        var dayMsg = morningAlert(t.name, t.roster, t.days, today);
        var weekMsg = monday ? weekAlert(t.roster, t.days, today) : null;
        if (dayMsg) log.push(t.name + " today: " + dayMsg[0] + " | " + dayMsg[1]);
        if (weekMsg) log.push(t.name + " week: " + weekMsg[0] + " | " + weekMsg[1].replace(/\n/g, " / "));
        if (!t.lead) return;   // only the lead hears about a team
        subscribers(devices, t.id, t.ids, t.lead).forEach(function (dev) {
          if (monday && wants(dev[1], "week")) {
            if (weekMsg) send_(dev, weekMsg[0] + (ledCount(dev[1]) > 1 ? DOT + t.name : ""), weekMsg[1], "week-" + t.id, url, log, dry);
          } else if (wants(dev[1], "morning") && dayMsg) {
            send_(dev, dayMsg[0], dayMsg[1], "day-" + t.id, url, log, dry);
          }
        });
      });
    }

    // 3. Test alerts asked for in the app within the last hour (older requests are ignored)
    try {
      var since = new Date((opts.nowMs || Date.now()) - 3600000).toISOString();
      testRequests_(since).forEach(function (dev) {
        var d = dev[1];
        if (d.testAt && d.testAt !== state.tests[dev[0]] && d.token && !d.dead) {
          send_(dev, "Alerts are working", "This is a test from Team Leaves. Your alerts will arrive like this.", "test", APP_URL, log, dry);
          if (!dry) state.tests[dev[0]] = d.testAt;
        }
      });
    } catch (e) { log.push("Test alerts skipped: " + e); }

    state.lastRun = new Date().toISOString();
    saveState_(state, dry);
    return log;
  } finally {
    if (log) console.log(log.join("\n"));   // also when the run failed part-way
    lock.releaseLock();
  }
}
