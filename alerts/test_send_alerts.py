"""Checks for the alert sender's logic. Run: python3 alerts/test_send_alerts.py
Every line must start with "ok". Made-up names only (this repo is public)."""
import datetime as dt
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import send_alerts as A

fails = 0


def ok(cond, msg):
    global fails
    print(("ok   " if cond else "FAIL ") + msg)
    fails += 0 if cond else 1


D = dt.date
# working days: Mon-Fri, and 1st, 3rd, 5th Saturdays only
ok(A.is_working_day(D(2026, 11, 10)), "Tuesday is a working day")
ok(not A.is_working_day(D(2026, 11, 15)), "Sunday is not")
ok(A.is_working_day(D(2026, 11, 7)), "1st Saturday (7 Nov) works")
ok(not A.is_working_day(D(2026, 11, 14)), "2nd Saturday (14 Nov) is off")
ok(A.is_working_day(D(2026, 11, 21)), "3rd Saturday (21 Nov) works")
ok(not A.is_working_day(D(2026, 11, 28)), "4th Saturday (28 Nov) is off")
ok(A.is_working_day(D(2026, 8, 29)), "5th Saturday (29 Aug) works")

# dates the way the app says them
ok(A.stretch_label(D(2026, 11, 13), D(2026, 11, 13), 1, 2026) == "Fri 13 Nov", "single day")
ok(A.stretch_label(D(2026, 11, 19), D(2026, 11, 23), 5, 2026) == "Thu 19 – Mon 23 Nov (5 days)", "range in one month")
ok(A.stretch_label(D(2026, 11, 30), D(2026, 12, 2), 3, 2026) == "Mon 30 Nov – Wed 2 Dec (3 days)", "range across months")
ok(A.stretch_label(D(2027, 1, 4), D(2027, 1, 4), 1, 2026) == "Mon 4 Jan 2027", "next year shows the year")
ok(len(A.stretches(["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-25"])) == 2, "consecutive days join, gaps split")

# the lead alert text (as approved)
t, b = A.change_alert("Bilal", "Brand Partnerships", ["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"], [], 2026)
ok((t, b) == ("Bilal marked leave", "Thu 19 – Mon 23 Nov (5 days) · Brand Partnerships"), "marked: " + t + " / " + b)
t, b = A.change_alert("Esha", "Brand Partnerships", [], ["2026-11-13"], 2026)
ok((t, b) == ("Esha cancelled leave", "Fri 13 Nov · Brand Partnerships"), "cancelled: " + t + " / " + b)
t, b = A.change_alert("Esha", "Team", ["2026-11-20"], ["2026-11-13"], 2026)
ok(t == "Esha changed leave" and "Marked Fri 20 Nov" in b and "Cancelled Fri 13 Nov" in b, "both in one run")

# change detection
roster = [{"id": "a", "name": "Asha Rao"}, {"id": "b", "name": "Bilal Khan"}, {"id": "c", "name": "Chitra Nair"}]
prev = {"roster": ["a", "b"], "days": {"a": ["2026-11-20"], "b": ["2026-11-12", "2026-11-13"]}}
cur = {"a": {"2026-11-20", "2026-11-21"}, "b": {"2026-11-12"}, "c": {"2026-11-25"}}
ch = A.diff_team(prev, cur, ["a", "b", "c"], "2026-11-12")
ok(ch.get("a") == (["2026-11-21"], []), "added day found")
ok(ch.get("b") == ([], ["2026-11-13"]), "cancelled day found")
ok("c" not in ch, "someone new on the team is recorded silently")
ok(A.diff_team(None, cur, ["a"], "2026-11-12") == {}, "a team's first run sends nothing")
ok(A.diff_team({"roster": ["a"], "days": {"a": ["2026-11-10"]}}, {"a": set()}, ["a"], "2026-11-12") == {},
   "dates that have passed are not 'cancelled'")

# morning and week text (as approved)
days = {"a": {"2026-11-16"}, "b": {"2026-11-18"}, "d": {"2026-11-18"}, "c": {"2026-11-19", "2026-11-20"}}
r4 = roster + [{"id": "d", "name": "Dev Mehta"}]
ok(A.morning_alert("Brand Partnerships", r4, days, D(2026, 11, 18)) == ("On leave today (2) · Brand Partnerships", "Bilal, Dev"),
   "morning: " + str(A.morning_alert("Brand Partnerships", r4, days, D(2026, 11, 18))))
ok(A.morning_alert("X", r4, days, D(2026, 11, 17)) is None, "no morning alert when nobody's on leave")
w = A.week_alert(r4, days, D(2026, 11, 16))
ok(w == ("On leave this week (16–21 Nov)", "Mon 16: Asha\nWed 18: Bilal, Dev\nThu 19 – Fri 20: Chitra"),
   "week: " + str(w))
w2 = A.week_alert(r4, {"a": {"2026-11-09"}}, D(2026, 11, 9))
ok(w2 and w2[0] == "On leave this week (9–13 Nov)", "week without a working Saturday ends Friday: " + str(w2 and w2[0]))
ok(A.week_alert(r4, {}, D(2026, 11, 16)) is None, "no week alert when nobody's on leave")
w3 = A.week_alert(r4, {"a": {"2026-11-30"}}, D(2026, 11, 30))
ok(w3 and w3[0] == "On leave this week (30 Nov – 5 Dec)", "week across months: " + str(w3 and w3[0]))
same = [{"id": "x", "name": "Ravi Rao"}, {"id": "y", "name": "Ravi Shah"}, {"id": "z", "name": "Asha"}]
ok(A.short_names(same) == {"x": "Ravi Rao", "y": "Ravi Shah", "z": "Asha"}, "two people with one first name get full names")

# who wants what
ok(A.wants({"token": "t", "prefs": {"morning": True}}, "morning"), "wants: on")
ok(not A.wants({"token": "t", "prefs": {"morning": False}}, "morning"), "wants: switched off")
ok(not A.wants({"token": "t", "off": True}, "morning"), "wants: alerts off on that phone")
ok(not A.wants({"token": "t", "dead": True}, "morning"), "wants: phone unreachable")
ok(A.wants({"token": "t"}, "leads"), "wants: on by default")

# who gets a team's alerts
devs = [("p1", {"token": "T1", "updatedAt": "2026-11-01", "subs": [{"tid": "A", "mid": "a"}]}),
        ("p2", {"token": "T1", "updatedAt": "2026-11-09", "subs": [{"tid": "A", "mid": "a"}]}),
        ("p3", {"token": "T3", "subs": [{"tid": "A", "mid": "gone"}]}),
        ("p4", {"token": "T4", "subs": [{"tid": "B", "mid": "b"}, {"tid": "A", "mid": "b"}]}),
        ("p5", {"subs": [{"tid": "A", "mid": "a"}]})]
live = A.live_devices(devs)
ok(sorted(x[0] for x in live) == ["p2", "p3", "p4"], "same token twice -> newest record only; no token -> skipped")
ok([x[0] for x in A.subscribers(live, "A", {"a", "b"})] == ["p2", "p4"], "someone removed from the team stops getting its alerts")
ok([x[0] for x in A.subscribers(live, "A", {"a", "b"}, "b")] == ["p4"], "lead alerts go only to the lead's own phone")

# a failed send never stops the run (the next run would otherwise repeat everything)
import urllib.error as UE
calls = []
def boom(*a, **k):
    calls.append(1)
    raise UE.URLError("connection reset")
A.http, real_http = boom, A.http
A.time.sleep = lambda s: None
A.DRY = False
log = []
try:
    A.send("tok", "p1", {"token": "T1"}, "t", "b", "tag", "u", log)
    ok(len(calls) == 2 and "failed" in log[-1], "network failure: tried twice, logged, run carries on")
except Exception as e:
    ok(False, "network failure crashed the run: %s" % e)
A.http = real_http

# GitHub logs are public: no names there
A.PUBLIC_LOG = True
ok(A.private("Bilal marked leave", "team x: changed") == "team x: changed", "GitHub log shows the count-only line")
log = []; A.DRY = True
A.send("tok", "phone123", {"token": "T"}, "Bilal marked leave", "Fri 13 Nov", "chg-tA-b-1", "u", log)
ok("Bilal" not in log[-1] and "13 Nov" not in log[-1], "a sent alert's log line has no name or date on GitHub: " + log[-1])
A.PUBLIC_LOG = False

print("\nAll passed" if not fails else f"\n{fails} FAILED")
sys.exit(1 if fails else 0)
