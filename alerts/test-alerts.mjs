// Checks for the alert sender (alerts/apps-script). Run: node alerts/test-alerts.mjs
// (also run by test/run-checks.py). Made-up names only: this repo is public.
// Part 1 tests the rules in logic.js; part 2 runs the real Code.js against a fake
// Firestore and a fake Firebase messaging service, run after run.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = f => fs.readFileSync(path.join(here, "apps-script", f), "utf8");
let fails = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };

// ── Part 1: rules ──────────────────────────────────────────────────────
const L = {}; vm.runInNewContext(src("logic.js"), L);
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const set = ks => Object.fromEntries(ks.map(k => [k, true]));

ok(L.isWorkingDay(D(2026, 11, 10)), "Tuesday is a working day");
ok(!L.isWorkingDay(D(2026, 11, 15)), "Sunday is not");
ok(L.isWorkingDay(D(2026, 11, 7)), "1st Saturday (7 Nov) works");
ok(!L.isWorkingDay(D(2026, 11, 14)), "2nd Saturday (14 Nov) is off");
ok(L.isWorkingDay(D(2026, 11, 21)), "3rd Saturday (21 Nov) works");
ok(!L.isWorkingDay(D(2026, 11, 28)), "4th Saturday (28 Nov) is off");
ok(L.isWorkingDay(D(2026, 8, 29)), "5th Saturday (29 Aug) works");

const lab = (ks, y = 2026) => L.stretches(ks).map(x => L.stretchLabel(x, y)).join(", ");
ok(lab(["2026-11-13"]) === "Fri 13 Nov", "single day");
ok(lab(["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"]) === "Thu 19 – Mon 23 Nov (5 days)", "range in one month");
ok(lab(["2026-11-30", "2026-12-01", "2026-12-02"]) === "Mon 30 Nov – Wed 2 Dec (3 days)", "range across months");
ok(lab(["2027-01-04"]) === "Mon 4 Jan 2027", "next year shows the year");
ok(L.stretches(["2026-11-19", "2026-11-20", "2026-11-25", "2026-11-25"]).length === 2, "consecutive days join, gaps split, repeats ignored");

let m = L.changeAlert("Bilal", "Brand Partnerships", ["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"], [], 2026);
ok(m[0] === "Bilal marked leave" && m[1] === "Thu 19 – Mon 23 Nov (5 days) · Brand Partnerships", "marked: " + m.join(" / "));
m = L.changeAlert("Esha", "Brand Partnerships", [], ["2026-11-13"], 2026);
ok(m[0] === "Esha cancelled leave" && m[1] === "Fri 13 Nov · Brand Partnerships", "cancelled: " + m.join(" / "));
m = L.changeAlert("Esha", "T", ["2026-11-20"], ["2026-11-13"], 2026);
ok(m[0] === "Esha changed leave" && /Marked Fri 20 Nov/.test(m[1]) && /Cancelled Fri 13 Nov/.test(m[1]), "both in one run");

const prev = { roster: ["a", "b"], days: { a: ["2026-11-20"], b: ["2026-11-12", "2026-11-13"] } };
const ch = L.diffTeam(prev, { a: set(["2026-11-20", "2026-11-21"]), b: set(["2026-11-12"]), c: set(["2026-11-25"]) }, ["a", "b", "c"], "2026-11-12");
ok(JSON.stringify(ch.a) === JSON.stringify({ added: ["2026-11-21"], removed: [] }), "added day found");
ok(JSON.stringify(ch.b) === JSON.stringify({ added: [], removed: ["2026-11-13"] }), "cancelled day found");
ok(!ch.c, "someone new on the team is recorded silently");
ok(Object.keys(L.diffTeam(null, { a: set(["2026-11-20"]) }, ["a"], "2026-11-12")).length === 0, "a team's first run sends nothing");
ok(Object.keys(L.diffTeam({ roster: ["a"], days: { a: ["2026-11-10"] } }, { a: {} }, ["a"], "2026-11-12")).length === 0, "dates that have passed are not 'cancelled'");

const r4 = [{ id: "a", name: "Asha Rao" }, { id: "b", name: "Bilal Khan" }, { id: "c", name: "Chitra Nair" }, { id: "d", name: "Dev Mehta" }];
const days = { a: set(["2026-11-16"]), b: set(["2026-11-18"]), d: set(["2026-11-18"]), c: set(["2026-11-19", "2026-11-20"]) };
m = L.morningAlert("Brand Partnerships", r4, days, D(2026, 11, 18));
ok(m && m[0] === "On leave today (2) · Brand Partnerships" && m[1] === "Bilal, Dev", "morning: " + m);
ok(L.morningAlert("X", r4, days, D(2026, 11, 17)) === null, "no morning alert when nobody's on leave");
m = L.weekAlert(r4, days, D(2026, 11, 16));
ok(m && m[0] === "On leave this week (16–21 Nov)" && m[1] === "Mon 16: Asha\nWed 18: Bilal, Dev\nThu 19 – Fri 20: Chitra", "week: " + JSON.stringify(m));
m = L.weekAlert(r4, { a: set(["2026-11-09"]) }, D(2026, 11, 9));
ok(m && m[0] === "On leave this week (9–13 Nov)", "week without a working Saturday ends Friday");
ok(L.weekAlert(r4, {}, D(2026, 11, 16)) === null, "no week alert when nobody's on leave");
m = L.weekAlert(r4, { a: set(["2026-11-30"]) }, D(2026, 11, 30));
ok(m && m[0] === "On leave this week (30 Nov – 5 Dec)", "week across months: " + (m && m[0]));
const sn = L.shortNames([{ id: "x", name: "Ravi Rao" }, { id: "y", name: "Ravi Shah" }, { id: "z", name: "Asha" }]);
ok(sn.x === "Ravi Rao" && sn.y === "Ravi Shah" && sn.z === "Asha", "two people with one first name get full names");

ok(L.wants({ token: "t", prefs: { morning: true } }, "morning"), "wants: on");
ok(!L.wants({ token: "t", prefs: { morning: false } }, "morning"), "wants: switched off");
ok(!L.wants({ token: "t", off: true }, "morning"), "wants: alerts off on that phone");
ok(!L.wants({ token: "t", dead: true }, "morning"), "wants: phone unreachable");
ok(L.wants({ token: "t" }, "leads"), "wants: on by default");
const devs = [["p1", { token: "T1", updatedAt: "2026-11-01", subs: [{ tid: "A", mid: "a" }] }],
  ["p2", { token: "T1", updatedAt: "2026-11-09", subs: [{ tid: "A", mid: "a" }] }],
  ["p3", { token: "T3", subs: [{ tid: "A", mid: "gone" }] }],
  ["p4", { token: "T4", subs: [{ tid: "B", mid: "b" }, { tid: "A", mid: "b" }] }], ["p5", { subs: [{ tid: "A", mid: "a" }] }]];
const live = L.liveDevices(devs);
ok(live.map(x => x[0]).sort().join() === "p2,p3,p4", "same token twice -> newest only; no token -> skipped");
ok(L.subscribers(live, "A", { a: 1, b: 1 }).map(x => x[0]).join() === "p2,p4", "someone removed from the team stops getting its alerts");
ok(L.subscribers(live, "A", { a: 1, b: 1 }, "b").map(x => x[0]).join() === "p4", "lead alerts go only to the lead's own phone");
const t = L.istNow(Date.UTC(2026, 10, 10, 3, 31));
ok(L.dKey(t.day) === "2026-11-10" && t.minutes === 9 * 60 + 1, "India time: 03:31 UTC is 9:01 AM IST");
ok(L.dKey(L.istNow(Date.UTC(2026, 10, 10, 18, 40)).day) === "2026-11-11", "India time: 18:40 UTC is already the next day");

// ── Part 2: the real sender against a fake Firestore and messaging service ──
const enc = x => x === null ? { nullValue: null } : typeof x === "boolean" ? { booleanValue: x }
  : typeof x === "number" ? { integerValue: String(x) } : typeof x === "string" ? { stringValue: x }
  : Array.isArray(x) ? { arrayValue: { values: x.map(enc) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, v]) => [k, enc(v)])) } };
const db = {};            // "teams/A" -> plain object
const sent = [];          // what reached the fake messaging service
const dead = new Set(["TOKEN-GONE"]);
let fcmFailOnce = false;
const BASE = "https://firestore.googleapis.com/v1/projects/team-leaves-270f6/databases/(default)/documents/";
const resp = (code, obj) => ({ getResponseCode: () => code, getContentText: () => obj === undefined ? "" : JSON.stringify(obj) });
let deviceLists = 0;      // how often the whole devices collection was read
const fetch = (url, opt) => {
  opt = opt || {}; const method = (opt.method || "get").toLowerCase();
  if (url.endsWith("/documents:runQuery")) {
    const q = JSON.parse(opt.payload).structuredQuery, since = q.where.fieldFilter.value.stringValue;
    const hits = Object.keys(db).filter(k => k.startsWith("devices/") && db[k].testAt && db[k].testAt > since)
      .map(k => ({ document: { name: "projects/x/databases/(default)/documents/" + k, fields: enc(db[k]).mapValue.fields } }));
    return resp(200, hits.length ? hits : [{ readTime: "now" }]);
  }
  if (url.startsWith("https://fcm.googleapis.com/")) {
    const msg = JSON.parse(opt.payload).message;
    if (fcmFailOnce) { fcmFailOnce = false; return resp(503, { error: "busy" }); }
    if (dead.has(msg.token)) return resp(404, { error: { status: "NOT_FOUND", details: ["UNREGISTERED"] } });
    sent.push({ token: msg.token, ...msg.webpush.data }); return resp(200, { name: "m" });
  }
  const rel = decodeURIComponent(url.slice(BASE.length).split("?")[0]);
  if (method === "get" && rel === "devices") deviceLists++;
  if (method === "get" && /^(teams|devices)$/.test(rel)) {
    const docs = Object.keys(db).filter(k => k.startsWith(rel + "/") && k.split("/").length === 2)
      .map(k => ({ name: "projects/x/databases/(default)/documents/" + k, fields: enc(db[k]).mapValue.fields }));
    return resp(200, { documents: docs });
  }
  if (method === "get") return db[rel] ? resp(200, { name: rel, fields: enc(db[rel]).mapValue.fields }) : resp(404, { error: "nf" });
  if (method === "patch") {
    const body = JSON.parse(opt.payload).fields, cur = db[rel] || {};
    for (const [k, v] of Object.entries(body)) cur[k] = "booleanValue" in v ? v.booleanValue : v.stringValue;
    db[rel] = cur; return resp(200, {});
  }
  return resp(400, { error: "unexpected " + method + " " + rel });
};
const G = { UrlFetchApp: { fetch, fetchAll: reqs => reqs.map(r => fetch(r.url, r)) }, ScriptApp: { getOAuthToken: () => "tok" }, Utilities: { sleep: () => {} },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) }, console: { log: () => {} } };
vm.createContext(G);
vm.runInContext(src("logic.js"), G);
vm.runInContext(src("Code.js"), G);
const run = (utc, extra) => { sent.length = 0; G.runAlerts_({ nowMs: utc, ...(extra || {}) }); return sent.slice(); };
const at = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h, mi) - 330 * 60000;   // an IST time, as UTC ms

db["teams/A"] = { name: "Alpha", leadId: "L", members: [{ id: "L", name: "Lata Iyer" }, { id: "b", name: "Bilal Khan" }, { id: "c", name: "Chitra Nair" }] };
db["teams/A/years/2026"] = { days: { c: { "2026-11-11": "full" } } };
db["teams/H"] = { name: "Hidden", hidden: true, leadId: "L", members: [{ id: "L", name: "Lata Iyer" }] };
db["teams/B"] = { name: "Beta", leadId: "L", members: [{ id: "L", name: "Lata Iyer" }, { id: "b", name: "Bilal Khan" }] };
db["devices/pL"] = { token: "TOKEN-LEAD", subs: [{ tid: "A", mid: "L" }, { tid: "H", mid: "L" }, { tid: "B", mid: "L" }], prefs: { morning: true, week: true, leads: true }, updatedAt: "1" };
db["devices/pb"] = { token: "TOKEN-B", subs: [{ tid: "A", mid: "b" }], prefs: { morning: true, week: true, leads: true }, updatedAt: "1" };
db["devices/pGone"] = { token: "TOKEN-GONE", subs: [{ tid: "G", mid: "g" }], prefs: { morning: true }, updatedAt: "1" };
db["teams/G"] = { name: "Gamma", leadId: "g", members: [{ id: "g", name: "Gita Paul" }] };
db["teams/G/years/2026"] = { days: { g: { "2026-11-11": "full" } } };

let s = run(at(2026, 11, 10, 20, 0));
ok(s.length === 0 && db["meta/alerts"], "first run: nothing sent, starting point saved");
db["teams/A/years/2026"].days.b = { "2026-11-19": "full", "2026-11-20": "full", "2026-11-21": "full" };
s = run(at(2026, 11, 10, 20, 5));
ok(s.length === 1 && s[0].token === "TOKEN-LEAD" && s[0].title === "Bilal marked leave" && s[0].body === "Thu 19 – Sat 21 Nov (3 days) · Alpha",
   "new leave: one alert, to the lead only: " + JSON.stringify(s));
ok(run(at(2026, 11, 10, 20, 10)).length === 0, "nothing changed: nothing sent again");
db["teams/A/years/2026"].days.L = { "2026-11-25": "full" };
ok(run(at(2026, 11, 10, 20, 15)).length === 0, "the lead's own leave isn't reported to the lead");
ok(run(at(2026, 11, 11, 8, 55)).length === 0, "8:55 AM: too early for the morning alert");
s = run(at(2026, 11, 11, 9, 1));
ok(s.length === 1 && s[0].token === "TOKEN-LEAD" && s[0].title === "On leave today (1) · Alpha" && s[0].body === "Chitra",
   "9:01 AM: morning alert to the lead only: " + JSON.stringify(s.map(x => x.token + " " + x.title)));
ok(!s.some(x => x.token === "TOKEN-B"), "a team member who isn't the lead gets no morning alert");
ok(db["devices/pGone"].dead === true, "a phone the service says is gone is marked unreachable, and the run carried on");
ok(run(at(2026, 11, 11, 9, 6)).length === 0, "morning alert goes once a day");
ok(run(at(2026, 11, 14, 9, 1)).length === 0, "2nd Saturday: no morning alert");
db["teams/A/years/2026"].days.c["2026-11-17"] = "full";
s = run(at(2026, 11, 16, 9, 2));
const wk = s.filter(x => x.tag.startsWith("week"));
ok(wk.length === 1 && wk[0].token === "TOKEN-LEAD" && wk[0].title.startsWith("On leave this week (16–21 Nov)") && /Thu 19 – Sat 21: Bilal/.test(wk[0].body),
   "Monday: week-ahead alert: " + JSON.stringify(wk.map(x => x.title + " | " + x.body)));
ok(s.filter(x => x.tag.startsWith("day")).length === 0, "Monday: no separate morning alert");
ok(wk[0].title.endsWith("· Alpha"), "a lead of two teams sees which team the week alert is about");
ok(!s.some(x => /Hidden/.test(x.title + x.body)), "hidden team: no alerts");
db["devices/pb"].testAt = "2026-11-16T04:25:00Z";   // asked 5 minutes before the run
s = run(at(2026, 11, 16, 10, 0));
ok(s.length === 1 && s[0].token === "TOKEN-B" && s[0].title === "Alerts are working", "test alert sent when asked");
ok(run(at(2026, 11, 16, 10, 5)).length === 0, "test alert sent only once");
db["devices/pL"].testAt = "2026-11-15T04:00:00Z";   // a day-old request
ok(run(at(2026, 11, 16, 10, 7)).length === 0, "a test request older than an hour is ignored");
deviceLists = 0; run(at(2026, 11, 16, 10, 8));
ok(deviceLists === 0, "quiet run: phone records aren't read (saves the free plan's daily reads)");
fcmFailOnce = true; delete db["teams/A/years/2026"].days.b["2026-11-21"];
s = run(at(2026, 11, 16, 10, 10));
ok(s.length === 1 && s[0].title === "Bilal cancelled leave" && s[0].body === "Sat 21 Nov · Alpha", "busy service: retried, the cancellation still arrives");
db["teams/A"].members = db["teams/A"].members.filter(x => x.id !== "b");
db["teams/A/years/2026"].days.b["2026-11-30"] = "full";
ok(run(at(2026, 11, 16, 10, 15)).length === 0, "someone removed from the team: no alerts about or to them");
db["teams/N"] = { name: "No lead", members: [{ id: "x", name: "Xavier Roy" }, { id: "y", name: "Yamini Das" }] };
db["devices/px"] = { token: "TOKEN-X", subs: [{ tid: "N", mid: "x" }], prefs: {}, updatedAt: "1" };
run(at(2026, 11, 16, 10, 20));
db["teams/N/years/2026"] = { days: { y: { "2026-11-27": "full" } } };
ok(run(at(2026, 11, 16, 10, 25)).length === 0, "a team with no lead sends no change alerts to anyone");
// leads only: a team with no lead, a lead who handed over, a member of two teams who leads neither
db["teams/N/years/2026"].days.x = { "2026-11-18": "full" };
db["devices/pY"] = { token: "TOKEN-Y", subs: [{ tid: "N", mid: "y" }], prefs: {}, updatedAt: "1" };
s = run(at(2026, 11, 18, 9, 1));
ok(!s.some(x => x.token === "TOKEN-X" || x.token === "TOKEN-Y"), "a team with no lead: no morning alert to anyone in it");
db["teams/A"].leadId = "c";   // Lata hands Alpha over to Chitra
db["teams/A/years/2026"].days.c["2026-11-19"] = "full";
db["devices/pb2"] = { token: "TOKEN-B2", subs: [{ tid: "A", mid: "b" }, { tid: "B", mid: "b" }], prefs: {}, updatedAt: "2" };
s = run(at(2026, 11, 19, 9, 1));
ok(!s.some(x => x.token === "TOKEN-LEAD" && /Alpha/.test(x.title + x.body)), "a lead who handed over gets nothing more about that team");
ok(!s.some(x => x.token === "TOKEN-B2"), "a member of two teams who leads neither gets nothing");
// a phone that renewed its address while the send was failing isn't marked unreachable
db["teams/R"] = { name: "Rho", leadId: "r", members: [{ id: "r", name: "Rhea Sen" }] };
db["teams/R/years/2026"] = { days: { r: { "2026-11-20": "full" } } };
db["devices/pR"] = { token: "TOKEN-OLD-R", subs: [{ tid: "R", mid: "r" }], prefs: {}, updatedAt: "1" };
dead.add("TOKEN-OLD-R");
const realFetch = G.UrlFetchApp.fetch;
G.UrlFetchApp.fetch = (url, opt) => {   // the phone renews just as the send to its old address fails
  if (url.startsWith("https://fcm.googleapis.com/") && /TOKEN-OLD-R/.test((opt || {}).payload || "")) db["devices/pR"].token = "TOKEN-NEW-R";
  return realFetch(url, opt);
};
s = run(at(2026, 11, 20, 9, 1));
ok(db["devices/pR"].dead !== true, "a phone that renewed its address in the meantime isn't marked unreachable");
ok(s.some(x => x.token === "TOKEN-NEW-R" && /On leave today/.test(x.title)), "…and the morning alert is resent to its new address");
G.UrlFetchApp.fetch = realFetch;
sent.length = 0; G.runAlerts_({ nowMs: at(2026, 11, 17, 9, 5), dry: true });
ok(sent.length === 0, "dry run sends nothing");

console.log(fails ? `\n${fails} FAILED` : "\nAll passed");
process.exit(fails ? 1 : 0);
