/* Team Leaves alerts — the rules for what to send. Pure functions only, so the
   same file runs in Google Apps Script (the sender, Code.js) and in Node for
   the checks (alerts/test-alerts.mjs). Dates are "YYYY-MM-DD" strings, or Date
   objects at midnight UTC standing for that calendar day.

   Approved wording (Ankit, November 10, 2026):
     "On leave today (3) · Team" / "Asha, Bilal, Chitra"
     "Bilal marked leave" / "Thu 19 – Mon 23 Nov (5 days) · Team"
     "On leave this week (16–21 Nov)" / "Mon 16: Asha" …                        */

var WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var DOT = " · ", DASH = " – ";

function dParse(k) { return new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10))); }
function dKey(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
function weekday(d) { return (d.getUTCDay() + 6) % 7; }   // Monday = 0

/* India time, as a "calendar day" Date plus minutes since midnight. */
function istNow(ms) {
  var t = new Date(ms + 330 * 60000);
  return { day: new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())),
           minutes: t.getUTCHours() * 60 + t.getUTCMinutes(),
           stamp: t.toISOString().slice(0, 16).replace("T", " ") };
}

/* Mon–Fri, plus the 1st, 3rd and 5th Saturdays (banks close on the 2nd and 4th). */
function isWorkingDay(d) {
  var w = weekday(d);
  if (w < 5) return true;
  if (w === 5) { var n = Math.floor((d.getUTCDate() - 1) / 7); return n === 0 || n === 2 || n === 4; }
  return false;
}

/* Consecutive dates grouped: [{s, e, n}] */
function stretches(keys) {
  var ks = keys.slice().sort(), out = [];
  for (var i = 0; i < ks.length; i++) {
    var d = dParse(ks[i]), last = out[out.length - 1];
    if (last && d.getTime() - last.e.getTime() === 86400000) { last.e = d; last.n++; }
    else if (!last || d.getTime() !== last.e.getTime()) out.push({ s: d, e: d, n: 1 });
  }
  return out;
}

function dayLabel(d, thisYear, withMonth) {
  var s = WD[weekday(d)] + " " + d.getUTCDate();
  if (withMonth !== false) {
    s += " " + MON[d.getUTCMonth()];
    if (d.getUTCFullYear() !== thisYear) s += " " + d.getUTCFullYear();
  }
  return s;
}

/* "Fri 13 Nov" or "Thu 19 – Mon 23 Nov (5 days)", as the app's List tab says it. */
function stretchLabel(x, thisYear) {
  if (x.s.getTime() === x.e.getTime()) return dayLabel(x.s, thisYear);
  var same = x.s.getUTCMonth() === x.e.getUTCMonth() && x.s.getUTCFullYear() === x.e.getUTCFullYear();
  return dayLabel(x.s, thisYear, !same) + DASH + dayLabel(x.e, thisYear) + " (" + x.n + " days)";
}

/* First names, except where two people on the team share one. */
function shortNames(members) {
  var first = members.map(function (m) { var p = String(m.name || "").trim().split(/\s+/); return p[0] || "?"; });
  var out = {};
  members.forEach(function (m, i) {
    var dup = first.filter(function (f) { return f === first[i]; }).length > 1;
    out[m.id] = dup ? (m.name || "?") : first[i];
  });
  return out;
}

function changeAlert(name, team, added, removed, thisYear) {
  var lab = function (ks) { return stretches(ks).map(function (x) { return stretchLabel(x, thisYear); }).join(", "); };
  if (added.length && removed.length)
    return [name + " changed leave", "Marked " + lab(added) + DOT + "Cancelled " + lab(removed) + DOT + team];
  if (added.length) return [name + " marked leave", lab(added) + DOT + team];
  return [name + " cancelled leave", lab(removed) + DOT + team];
}

/* Per member: {added, removed} upcoming dates since the last run. prev is the
   saved state for the team ({roster:[ids], days:{id:[keys]}}) or null on its
   first run. People not on the roster last time (new, or added back with old
   dates) are recorded silently. curDays: {id: {key: true}}. */
function diffTeam(prev, curDays, rosterIds, today) {
  if (!prev) return {};
  var prevRoster = {}; (prev.roster || []).forEach(function (id) { prevRoster[id] = true; });
  var prevDays = prev.days || {}, out = {};
  rosterIds.forEach(function (mid) {
    if (!prevRoster[mid]) return;
    var cur = Object.keys(curDays[mid] || {}).filter(function (k) { return k >= today; });
    var old = (prevDays[mid] || []).filter(function (k) { return k >= today; });
    var added = cur.filter(function (k) { return old.indexOf(k) < 0; }).sort();
    var removed = old.filter(function (k) { return cur.indexOf(k) < 0; }).sort();
    if (added.length || removed.length) out[mid] = { added: added, removed: removed };
  });
  return out;
}

function outOn(key, roster, days) { return roster.filter(function (m) { return !!(days[m.id] && days[m.id][key]); }); }

function morningAlert(team, roster, days, today) {
  var names = shortNames(roster), out = outOn(dKey(today), roster, days);
  if (!out.length) return null;
  return ["On leave today (" + out.length + ")" + DOT + team, out.map(function (m) { return names[m.id]; }).join(", ")];
}

/* Monday: one line per day (or run of days with the same people), working days only. */
function weekAlert(roster, days, monday) {
  var names = shortNames(roster), work = [], rows = [];
  for (var i = 0; i < 6; i++) { var d = addDays(monday, i); if (isWorkingDay(d)) work.push(d); }
  work.forEach(function (d) {
    var who = outOn(dKey(d), roster, days).map(function (m) { return names[m.id]; }).join(", ");
    var last = rows[rows.length - 1];
    if (last && who && last.who === who && d.getTime() - last.e.getTime() === 86400000) last.e = d;
    else rows.push({ s: d, e: d, who: who });
  });
  rows = rows.filter(function (r) { return r.who; });
  if (!rows.length) return null;
  var a = work[0], b = work[work.length - 1];
  var span = a.getUTCMonth() === b.getUTCMonth()
    ? a.getUTCDate() + "–" + b.getUTCDate() + " " + MON[b.getUTCMonth()]
    : a.getUTCDate() + " " + MON[a.getUTCMonth()] + DASH + b.getUTCDate() + " " + MON[b.getUTCMonth()];
  var lines = rows.map(function (r) {
    var when = r.s.getTime() === r.e.getTime() ? WD[weekday(r.s)] + " " + r.s.getUTCDate()
      : WD[weekday(r.s)] + " " + r.s.getUTCDate() + DASH + WD[weekday(r.e)] + " " + r.e.getUTCDate();
    return when + ": " + r.who;
  });
  return ["On leave this week (" + span + ")", lines.join("\n")];
}

function wants(d, key) {
  return !d.off && !d.dead && !!d.token && ((d.prefs || {})[key] !== false);
}

/* One record per push token, the newest. A phone that lost its storage makes a
   new record but may keep its token; it must not get every alert twice. */
function liveDevices(devices) {
  var best = {};
  devices.forEach(function (x) {
    var t = x[1].token;
    if (!t) return;
    if (!best[t] || String(x[1].updatedAt || "") > String(best[t][1].updatedAt || "")) best[t] = x;
  });
  return Object.keys(best).map(function (t) { return best[t]; });
}

/* Phones subscribed to a team as someone still on its roster (and, for lead
   alerts, as that exact person). People removed from a team stop hearing about it. */
function subscribers(devices, tid, rosterIds, mid) {
  return devices.filter(function (x) {
    return (x[1].subs || []).some(function (s) {
      return s && s.tid === tid && rosterIds[s.mid] && (mid == null || s.mid === mid);
    });
  });
}

if (typeof module !== "undefined") module.exports = { dParse: dParse, dKey: dKey, addDays: addDays, istNow: istNow,
  isWorkingDay: isWorkingDay, stretches: stretches, stretchLabel: stretchLabel, shortNames: shortNames,
  changeAlert: changeAlert, diffTeam: diffTeam, morningAlert: morningAlert, weekAlert: weekAlert,
  wants: wants, liveDevices: liveDevices, subscribers: subscribers };
