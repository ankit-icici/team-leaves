"""Team Leaves alert sender.

Runs on GitHub Actions (.github/workflows/alerts.yml) every 15 minutes, plus once
just before 9 AM IST. Each run:

  1. New and cancelled leaves -> the team's lead. Compares every team's upcoming
     dates with the last run (kept in Firestore meta/alerts) and sends one alert
     per person who changed, e.g. "Bilal marked leave / Thu 19 - Mon 23 Nov
     (5 days) . Brand Partnerships". The lead's own changes aren't reported.
  2. From 8:55 AM IST, once a day, on working days only (Mon-Fri and the 1st,
     3rd and 5th Saturdays): "On leave today (3) . <team>" to everyone who wants
     it. On Mondays, "On leave this week (16-21 Nov)" instead, for those who want
     that. Nothing is sent when nobody is on leave.
  3. Test alerts that someone asked for from the app's Alerts screen.

Phones register in Firestore devices/{id} (see index.html, "Alerts"). Sending is
through Firebase Cloud Messaging; sw.js shows the alert on the phone.

Local use (never sends anything):
  ANON=1 DRY_RUN=1 STATE_FILE=/tmp/state.json python3 alerts/send_alerts.py
reads the live teams like any phone does (phone records can't be read that way)
and prints what would be sent. Run it twice, changing STATE_FILE between, to see
change alerts. Tests: python3 alerts/test_send_alerts.py
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PROJECT = "team-leaves-270f6"
WEB_API_KEY = "AIzaSyAuD0vD6OoXH7fK-zhyDsSNvwU2jb_GaRU"   # public, same as in index.html
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
FCM = f"https://fcm.googleapis.com/v1/projects/{PROJECT}/messages:send"
APP_URL = "https://ankit-icici.github.io/team-leaves/"
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
MORNING_FROM = dt.time(8, 55)     # the morning alert goes on the first run after this
MORNING_UNTIL = dt.time(12, 0)    # and not at all if every run before noon was missed

DRY = os.environ.get("DRY_RUN") == "1"
ANON = os.environ.get("ANON") == "1"
STATE_FILE = os.environ.get("STATE_FILE")
FORCE_MORNING = os.environ.get("FORCE_MORNING") == "1"
# GitHub's run logs for this public repo can be read by anyone, so there the log
# never shows people's names, team names or dates: only team codes and counts.
PUBLIC_LOG = os.environ.get("GITHUB_ACTIONS") == "true"


def private(full, public):
    """The detailed log line on this computer; a count-only line on GitHub."""
    return public if PUBLIC_LOG else full

WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ── Pure logic (tested in test_send_alerts.py) ─────────────────────────────

def is_working_day(d):
    """Mon-Fri, plus the 1st, 3rd and 5th Saturdays (banks close on the 2nd and 4th)."""
    if d.weekday() < 5:
        return True
    if d.weekday() == 5:
        return (d.day - 1) // 7 in (0, 2, 4)
    return False


def parse(k):
    return dt.date(int(k[0:4]), int(k[5:7]), int(k[8:10]))


def stretches(keys):
    """Consecutive dates grouped: [(start, end, days)]."""
    out = []
    for k in sorted(keys):
        d = parse(k)
        if out and (d - out[-1][1]).days == 1:
            s, _, n = out[-1]
            out[-1] = (s, d, n + 1)
        else:
            out.append((d, d, 1))
    return out


def day_label(d, this_year, month=True):
    s = f"{WD[d.weekday()]} {d.day}"
    if month:
        s += f" {MON[d.month - 1]}"
        if d.year != this_year:
            s += f" {d.year}"
    return s


def stretch_label(s, e, n, this_year):
    """'Fri 13 Nov' or 'Thu 19 - Mon 23 Nov (5 days)', as the app's List tab says it."""
    if s == e:
        return day_label(s, this_year)
    same_month = s.month == e.month and s.year == e.year
    return f"{day_label(s, this_year, month=not same_month)} – {day_label(e, this_year)} ({n} days)"


def short_names(members):
    """First names, except where two people on the team share one."""
    firsts = [str(m.get("name", "")).split()[0] if str(m.get("name", "")).split() else "?" for m in members]
    out = {}
    for m, f in zip(members, firsts):
        out[m["id"]] = m.get("name", "?") if firsts.count(f) > 1 else f
    return out


def change_alert(name, team, added, removed, this_year):
    """Title and text for one person's new and/or cancelled dates."""
    a = ", ".join(stretch_label(*x, this_year) for x in stretches(added))
    r = ", ".join(stretch_label(*x, this_year) for x in stretches(removed))
    if added and removed:
        return f"{name} changed leave", f"Marked {a} · Cancelled {r} · {team}"
    if added:
        return f"{name} marked leave", f"{a} · {team}"
    return f"{name} cancelled leave", f"{r} · {team}"


def diff_team(prev, cur_days, roster_ids, today):
    """Per member: (added, removed) upcoming dates since the last run.

    prev is the saved state for this team ({"roster": [...], "days": {...}}) or
    None on its first run. Members not on the roster last time are new (or added
    back with their old dates) and are recorded silently."""
    if prev is None:
        return {}
    prev_roster = set(prev.get("roster", []))
    prev_days = prev.get("days", {})
    out = {}
    for mid in roster_ids:
        if mid not in prev_roster:
            continue
        cur = {k for k in cur_days.get(mid, ()) if k >= today}
        old = {k for k in prev_days.get(mid, ()) if k >= today}
        added, removed = sorted(cur - old), sorted(old - cur)
        if added or removed:
            out[mid] = (added, removed)
    return out


def out_on(day_key, roster, days):
    return [m for m in roster if day_key in days.get(m["id"], ())]


def morning_alert(team, roster, days, today):
    """'On leave today (3) . Team' / 'Asha, Bilal, Chitra', or None if nobody's out."""
    names = short_names(roster)
    out = out_on(today.isoformat(), roster, days)
    if not out:
        return None
    return f"On leave today ({len(out)}) · {team}", ", ".join(names[m["id"]] for m in out)


def week_alert(roster, days, monday):
    """'On leave this week (16-21 Nov)' with one line per day (or run of days with
    the same people), working days only. None if nobody's out all week."""
    names = short_names(roster)
    work = [monday + dt.timedelta(days=i) for i in range(6) if is_working_day(monday + dt.timedelta(days=i))]
    rows = []
    for d in work:
        who = tuple(names[m["id"]] for m in out_on(d.isoformat(), roster, days))
        if rows and rows[-1][2] == who and (d - rows[-1][1]).days == 1 and who:
            rows[-1] = (rows[-1][0], d, who)
        else:
            rows.append((d, d, who))
    rows = [r for r in rows if r[2]]
    if not rows:
        return None
    a, b = work[0], work[-1]
    span = f"{a.day}–{b.day} {MON[b.month - 1]}" if a.month == b.month else \
           f"{a.day} {MON[a.month - 1]} – {b.day} {MON[b.month - 1]}"
    lines = []
    for s, e, who in rows:
        when = f"{WD[s.weekday()]} {s.day}" if s == e else f"{WD[s.weekday()]} {s.day} – {WD[e.weekday()]} {e.day}"
        lines.append(f"{when}: {', '.join(who)}")
    return f"On leave this week ({span})", "\n".join(lines)


def live_devices(devices):
    """One record per push token, keeping the newest. A phone that lost its storage
    makes a new record but may keep the same token; it must not get alerts twice."""
    best = {}
    for dev_id, d in devices:
        tok = d.get("token")
        if not tok:
            continue
        if tok not in best or str(d.get("updatedAt", "")) > str(best[tok][1].get("updatedAt", "")):
            best[tok] = (dev_id, d)
    return list(best.values())


def subscribers(devices, tid, roster_ids, mid=None):
    """Phones subscribed to a team as someone still on its roster (and, for lead
    alerts, as that exact person). People removed from a team stop hearing about it."""
    out = []
    for dev_id, d in devices:
        for s in (d.get("subs") or []):
            if isinstance(s, dict) and s.get("tid") == tid and s.get("mid") in roster_ids \
                    and (mid is None or s.get("mid") == mid):
                out.append((dev_id, d))
                break
    return out


def wants(device, key):
    return not device.get("off") and not device.get("dead") and device.get("token") \
        and (device.get("prefs") or {}).get(key, True)


# ── Firestore and FCM over REST ────────────────────────────────────────────

def http(url, method="GET", body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, method=method, headers=headers,
                                 data=None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def access_token():
    if ANON:   # read-only, like any phone opening the app
        r = http(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={WEB_API_KEY}",
                 "POST", {"returnSecureToken": True})
        return r["idToken"]
    import google.auth
    import google.auth.transport.requests
    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


def val(v):
    if "stringValue" in v: return v["stringValue"]
    if "booleanValue" in v: return v["booleanValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "nullValue" in v: return None
    if "arrayValue" in v: return [val(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v: return {k: val(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return list(v.values())[0]


def list_docs(path, tok):
    out, page = [], None
    while True:
        url = f"{BASE}/{path}?pageSize=300" + (f"&pageToken={urllib.parse.quote(page)}" if page else "")
        r = http(url, token=tok)
        for d in r.get("documents", []):
            out.append((d["name"].split("/")[-1], {k: val(x) for k, x in d.get("fields", {}).items()}))
        page = r.get("nextPageToken")
        if not page:
            return out


def get_doc(path, tok):
    try:
        d = http(f"{BASE}/{path}", token=tok)
        return {k: val(x) for k, x in d.get("fields", {}).items()}
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def patch_doc(path, fields, tok):
    """Write simple string/bool fields, leaving the rest of the document alone."""
    def enc(x):
        return {"booleanValue": x} if isinstance(x, bool) else {"stringValue": str(x)}
    q = "&".join("updateMask.fieldPaths=" + urllib.parse.quote(k) for k in fields)
    http(f"{BASE}/{path}?{q}", "PATCH", {"fields": {k: enc(v) for k, v in fields.items()}}, tok)


def load_state(tok):
    if STATE_FILE:
        try:
            return json.load(open(STATE_FILE))
        except (OSError, ValueError):
            return {}
    if ANON:   # a phone can't read the saved state
        return {}
    d = get_doc("meta/alerts", tok) or {}
    try:
        return json.loads(d.get("state") or "{}")
    except ValueError:
        return {}


def save_state(state, tok):
    if STATE_FILE:
        json.dump(state, open(STATE_FILE, "w"), indent=1)
        return
    if not DRY:
        patch_doc("meta/alerts", {"state": json.dumps(state, separators=(",", ":"))}, tok)


def send(tok, dev_id, device, title, body, tag, url, log):
    log.append(private(f"  -> {dev_id[:8]}  {title} | {body.replace(chr(10), ' / ')}",
                       f"  -> phone {dev_id[:6]}: {tag.split('-')[0]} alert"))
    if DRY:
        return
    msg = {"message": {"token": device["token"], "webpush": {
        "headers": {"Urgency": "high", "TTL": "43200"},
        "data": {"title": title, "body": body, "tag": tag, "url": url}}}}
    # One failed send must never stop the run: the state is saved at the end, and
    # a crash would make the next run send everything again.
    for attempt in (1, 2):
        try:
            http(FCM, "POST", msg, tok)
            return
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            # the phone uninstalled the app or the browser dropped the subscription
            if e.code == 404 or "UNREGISTERED" in detail or ("INVALID_ARGUMENT" in detail and "token" in detail.lower()):
                log.append("     phone no longer reachable; marked as such")
                try:
                    patch_doc(f"devices/{dev_id}", {"dead": True, "deadAt": dt.datetime.now(dt.timezone.utc).isoformat()}, tok)
                except Exception as e2:
                    log.append(f"     couldn't mark it: {e2}")
                return
            if attempt == 1 and (e.code == 429 or e.code >= 500):
                time.sleep(3)
                continue
            log.append(f"     failed: HTTP {e.code} " + private(detail[:200], ""))
            return
        except Exception as e:
            if attempt == 1:
                time.sleep(3)
                continue
            log.append(f"     failed: {e}")
            return


# ── One run ────────────────────────────────────────────────────────────────

def main():
    now = dt.datetime.now(IST)
    today = now.date()
    tk = today.isoformat()
    tok = access_token()
    log = [f"Run at {now:%Y-%m-%d %H:%M} IST" + (" (dry run: nothing is sent or saved)" if DRY else "")]

    state = load_state(tok)
    state.setdefault("teams", {})
    state.setdefault("tests", {})

    teams = []
    for tid, t in list_docs("teams", tok):
        if t.get("hidden"):
            state["teams"].pop(tid, None)   # if it's ever shown again, it starts afresh
            continue
        roster = [m for m in (t.get("members") or []) if isinstance(m, dict) and m.get("id")]
        days = {}
        for y in (today.year, today.year + 1):
            yd = get_doc(f"teams/{tid}/years/{y}", tok) or {}
            for mid, ds in (yd.get("days") or {}).items():
                days.setdefault(mid, set()).update(k for k in (ds or {}).keys() if len(k) == 10)
        teams.append({"id": tid, "name": t.get("name") or "Team", "lead": t.get("leadId"),
                      "roster": roster, "days": days})

    devices = []
    if not ANON:
        devices = live_devices(list_docs("devices", tok))
    log.append(f"{len(teams)} teams, {len(devices)} phones registered")

    def devices_for(t, mid=None):
        return subscribers(devices, t["id"], {m["id"] for m in t["roster"]}, mid)

    def team_count(d):
        return len({s.get("tid") for s in (d.get("subs") or []) if isinstance(s, dict)})

    # 1. New and cancelled leaves -> the lead
    run_id = now.strftime("%Y%m%d%H%M")
    told = set()   # (phone, person's change) already sent this run — a person on two
                   # teams led by the same lead is reported once
    for t in teams:
        prev = state["teams"].get(t["id"])
        changes = diff_team(prev, t["days"], [m["id"] for m in t["roster"]], tk)
        names = short_names(t["roster"])
        url = f"{APP_URL}?t={t['id']}"
        for mid, (added, removed) in changes.items():
            if mid == t["lead"]:
                continue
            title, body = change_alert(names[mid], t["name"], added, removed, today.year)
            log.append(private(f"{t['name']}: {title} - {body}",
                               f"team {t['id']}: one person's leave changed"))
            if ANON:
                log.append("  -> (the lead's phone, if it has alerts on)")
            for dev_id, d in devices_for(t, t["lead"]):
                key = (dev_id, title, tuple(added), tuple(removed))
                if wants(d, "leads") and key not in told:
                    told.add(key)
                    # unique per run, so an unread alert is never replaced by a later one
                    send(tok, dev_id, d, title, body, f"chg-{t['id']}-{mid}-{run_id}", url, log)
        state["teams"][t["id"]] = {
            "roster": [m["id"] for m in t["roster"]],
            "days": {mid: sorted(k for k in ds if k >= tk) for mid, ds in t["days"].items()
                     if any(k >= tk for k in ds)}}

    # 2. Morning: today, or Monday's week ahead
    morning_due = (state.get("lastMorning") != tk and is_working_day(today)
                   and MORNING_FROM <= now.time() < MORNING_UNTIL) or FORCE_MORNING
    if morning_due:
        if not DRY or STATE_FILE:
            state["lastMorning"] = tk
            save_state(state, tok)   # before sending: a crash mid-way must not repeat it
        monday = today.weekday() == 0
        log.append("Morning alerts" + (" (Monday: week ahead)" if monday else ""))
        for t in teams:
            url = f"{APP_URL}?t={t['id']}"
            day_msg = morning_alert(t["name"], t["roster"], t["days"], today)
            week_msg = week_alert(t["roster"], t["days"], today) if monday else None
            if day_msg:
                log.append(private(f"{t['name']} today: {day_msg[0]} | {day_msg[1]}",
                                   f"team {t['id']}: morning alert ready"))
            if week_msg:
                log.append(private(f"{t['name']} week: {week_msg[0]} | {week_msg[1].replace(chr(10), ' / ')}",
                                   f"team {t['id']}: week-ahead alert ready"))
            for dev_id, d in devices_for(t):
                if monday and wants(d, "week"):
                    if week_msg:
                        title = week_msg[0] + (f" · {t['name']}" if team_count(d) > 1 else "")
                        send(tok, dev_id, d, title, week_msg[1], f"week-{t['id']}", url, log)
                elif wants(d, "morning") and day_msg:
                    send(tok, dev_id, d, day_msg[0], day_msg[1], f"day-{t['id']}", url, log)

    # 3. Test alerts asked for in the app
    for dev_id, d in devices:
        asked = d.get("testAt")
        if asked and asked != state["tests"].get(dev_id) and d.get("token") and not d.get("dead"):
            send(tok, dev_id, d, "Alerts are working",
                 "This is a test from Team Leaves. Your alerts will arrive like this.", "test", APP_URL, log)
            state["tests"][dev_id] = asked

    state["lastRun"] = now.isoformat()
    save_state(state, tok)
    print("\n".join(log))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:   # make a failed run visible in the Actions log
        print(f"Alert run failed: {e}", file=sys.stderr)
        raise
