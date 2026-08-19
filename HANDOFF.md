# Team Leaves — handoff

Paste this into a new Claude session (or just point Claude at this file's raw URL) to
continue building the app with no explanation needed.

---

I have a working web app called "Team Leaves" that I need you to continue building. Read
everything below before responding — it contains all context, so don't ask me to explain
the project.

## WHAT IT IS

A leave tracker for my team at ICICI Bank (Alliances / Brand Partnerships). ~100 people
across several subteams use it on their phones. Each person marks their own upcoming
leaves; everyone sees who's out. It is NOT an approval system — just visibility.

- Live app: https://ankit-icici.github.io/team-leaves/
- Repo (public): https://github.com/ankit-icici/team-leaves
- Current code: https://raw.githubusercontent.com/ankit-icici/team-leaves/main/index.html
  and https://raw.githubusercontent.com/ankit-icici/team-leaves/main/sw.js

FIRST ACTION: fetch those two raw URLs to read the current code. If you can't fetch,
tell me and I'll paste the file contents in.

## HOW I WORK — IMPORTANT

I don't edit code, and I don't keep files on my laptop. So:

1. Make changes yourself and hand me back COMPLETE `index.html` and `sw.js` files,
   ready to upload with zero editing.
2. Always bake my Firebase config into `index.html` (values below) — never leave
   `PASTE_` placeholders.
3. Always bump the cache version in `sw.js` (currently `team-leaves-v14` → v15, v16…),
   or phones serve a stale cached copy and I'll think the change didn't work.
4. I upload files through the GitHub web UI and wait ~2 min for Pages to rebuild.
5. Test your logic before handing files over. `node --check` the extracted script, and
   run the pure functions headlessly by stripping the firebase imports and the boot
   block and stubbing `document` / `localStorage` / `location`. This has caught real
   bugs — do it.

## FIREBASE CONFIG (public by design, safe in a public file)

```
apiKey:            "AIzaSyAuD0vD6OoXH7fK-zhyDsSNvwU2jb_GaRU"
authDomain:        "team-leaves-270f6.firebaseapp.com"
projectId:         "team-leaves-270f6"
storageBucket:     "team-leaves-270f6.firebasestorage.app"
messagingSenderId: "241879513784"
appId:             "1:241879513784:web:013ceeecfd42d469aa524d"
```

Firestore location asia-south1. Anonymous auth is ON (invisible to users — nobody signs
in). Free Spark plan, no card on file.

## ARCHITECTURE

Single self-contained `index.html` (inline CSS + one ES module), plus `sw.js`,
`manifest.json`, and three PNG icons. Firebase JS SDK 10.12.2 from the gstatic CDN.
Firestore with `persistentLocalCache` so it works offline. Installable PWA.

Firestore is the source of truth; phones hold only a cache. This is deliberate — an
earlier app of mine kept data on the device and kept losing it (iOS Safari clears
script storage after ~7 days unused). Never move data ownership back to the device.

Data model:

```
teams/{teamId}               → { name, leadId, members:[{id,name,color}], createdAt }
teams/{teamId}/years/{YYYY}  → { days: { memberId: { "2026-11-05": "full" } } }
```

One year document per team holds everyone's dates. Writes use field-level merges
(`setDoc(..., {merge:true})` with `deleteField()` for removals) so two people editing
different dates never clobber each other. Roster changes use `runTransaction`.
Never switch to one-document-per-person — read costs would blow the free tier.

Device-local (localStorage, preferences only — never data):

```
tl:known     → JSON [{id,name}] of teams joined on this phone
tl:me:<tid>  → which member id I am in that team
tl:lastTeam  → team to reopen
```

## SECURITY MODEL — READ THIS BEFORE "IMPROVING" IT

There is NO sign-in, by my explicit decision after discussing alternatives at length.
Rules allow any anonymous client to `get` AND `list` teams. Consequences I accepted
knowingly:

- Every team name is visible to anyone who opens the app.
- Any team's leaves are readable via browser dev tools by someone who goes looking.
- "Only the lead manages the roster" and "you only edit your own leaves" are enforced
  in the UI only, not on the server.

The app hides other teams; it does not lock them. That is intentional for one
department. DO NOT add sign-in, team codes, passwords, or per-team links unless I
explicitly ask. If a change I request would need real enforcement, say so once and let
me decide — don't build it unasked.

## DELIBERATE DESIGN DECISIONS — DON'T UNDO THESE

- No half-day option. Removed on request. Any legacy `"half"` value in the database is
  treated as a normal leave.
- Tapping a date toggles it immediately. No confirmation dialog.
- Press-and-hold a date shows a read-only "who's out" list (a cell only fits ~2 initials).
- Drag range-select sits behind a "Select range" button rather than being always-on,
  because a drag-anywhere calendar swallows the vertical swipe used to scroll the page.
  In that mode: drag first→last day, or tap first then tap last. Whether the range marks
  or unmarks is set by the first day touched.
- Marking a leave mirrors to EVERY team the person has joined and picked a name in
  (matched by member id per team, not by name). Teams where they haven't picked a name
  are skipped with a nudge.
- Two tabs: "Calendar" and "List". List shows upcoming leaves as text rows with weekdays
  ("Thu 20 – Fri 21 Aug"), a TODAY badge, no day counts, not month-bound. It deliberately
  contains no mini-calendar.
- Calendar grid uses `minmax(0,1fr)` columns — plain `1fr` let avatar content inflate a
  column and push day 7 off screen. Cells show 2 initials, or 1 initial + "+N".
- Status line tracks cache state PER listener and only warns after 7 seconds of stale
  data. A single shared flag caused false "Reconnecting" warnings, because an empty
  future-year document always reports as cache-served.
- Lead can: rename team, add members, rename members (✎), remove members (✕),
  transfer lead (★).
- Backup: per-team (Manage team) and all-teams (tap your name → Back up all my teams).
  Files record `teamId` so restore survives team renames. Output is human-readable:
  dates grouped under each person's name.
- Restore (Manage team → Restore from a backup file): reads the whole file, checks lead
  status per team, offers "Add back anything missing" (merge) or "Replace all leaves"
  (exact), plus "Only this" per team and "Into <current team>" for teams that no longer
  exist here. Never removes anyone from a roster.

## KNOWN GAPS / THINGS I MIGHT ASK FOR

- Removing a member DELETES their leaves. This is the one destructive action. A safer
  version would keep the dates dormant so re-adding restores them.
- No "N changes waiting to sync" banner. The only genuine data-loss window is a leave
  marked offline on a device whose storage is cleared before it syncs.
- Ordinary members can't fix their own name — lead only.
- No CSV/Excel export.
- An accidental drag in Select-range mode starting on an existing leave can clear a lot
  of days at once.

## TONE

Be direct. Tell me when an idea has a downside or when I've asked for two things that
conflict. Flag risks once, clearly, then do what I decide. Don't pad responses.
