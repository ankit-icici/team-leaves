# Team Leaves: handoff

Everything a new Claude session needs to carry on with no explanation. Read `CLAUDE.md`
first, then this file, then `DECISIONS.md`. Last brought up to date: October 29, 2026,
for app version **v24**.

---

## 1. What it is

A leave tracker for Ankit's department at ICICI Bank (Alliances / Brand Partnerships),
used on phones. Each person marks their own upcoming leaves and everyone in the team
sees who's out. It is **not** an approval system, only visibility.

- Live app: https://ankit-icici.github.io/team-leaves/
- Repo (public): https://github.com/ankit-icici/team-leaves (branch `main`)
- Owner: Ankit Garg. Official (ICICI Bank) work.
- In use as of October 29, 2026: 8 visible teams (4 more hidden), 64 names across the
  visible rosters (one person on two teams counts twice). The biggest team has 32 people.
- Used mostly on personal phones, so the bank office network is not a concern (Ankit,
  October 29, 2026).

## 2. Files

| File | What it is |
|---|---|
| `index.html` | The whole app: inline CSS plus one ES module. About 2,700 lines. |
| `mulish.woff2`, `mulish-OFL.txt` | Mulish, the ICICI Bank typeface: the brand master (`~/Desktop/ICICI Brand/03 Font - Mulish/`) cut down to Latin characters (29 KB), and its free licence. |
| `sw.js` | Service worker: caches the app shell so it opens offline. Holds the cache version. |
| `manifest.json` | Makes it installable (name, icons, colours). |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | App icons, in ICICI Bank orange and maroon since v23. |
| `test/` | Test tools (section 7): `run-checks.py` + `checks.mjs` (headless logic checks), `make-test-copy.py` + `mock-firebase.js` + `seed.html` (a private copy of the app on a fake database with made-up teams). |
| `firestore.rules` | Database security rules. A copy only: the live rules are whatever was last published in the Firebase console. Checked October 29, 2026: the live rules (published August 18, 2026) match this file exactly. |
| `SETUP.md`, `SETUP-V4.md` | One-time setup records from August 2026 (first setup, then the move to one link for everyone). History only: parts are out of date. |
| `CLAUDE.md` | Read-first rules for any session. |
| `HANDOFF.md` | This file. |
| `DECISIONS.md` | Decision log, newest first. |

## 3. How it is built

- Plain HTML and JavaScript, no build step. Firebase JS SDK **10.12.2** loaded from
  `www.gstatic.com`.
- Hosting: GitHub Pages from `main`, root folder. A push goes live in about 2 minutes.
- Database: Google Firestore, location asia-south1 (Mumbai), free Spark plan (confirmed in
  the console on October 29, 2026), no card on file. Firestore runs with `persistentLocalCache` so the app works offline.
- Owner: Ankit's dedicated Google account is the **only** owner of the Firebase project, by
  his decision (see `DECISIONS.md`). The account name is in his private index
  (`~/Desktop/AI/CLAUDE.md`), not here, because this repo is public.
- Sign-in: Firebase **anonymous** auth, invisible to users. It only stops scripts that
  never loaded the app from reading the database.

Firebase config (public by design; it identifies the project and authorises nothing; the
rules do the protecting). It is already in `index.html`:

```
apiKey:            "AIzaSyAuD0vD6OoXH7fK-zhyDsSNvwU2jb_GaRU"
authDomain:        "team-leaves-270f6.firebaseapp.com"
projectId:         "team-leaves-270f6"
storageBucket:     "team-leaves-270f6.firebasestorage.app"
messagingSenderId: "241879513784"
appId:             "1:241879513784:web:013ceeecfd42d469aa524d"
```

## 4. Data

Firestore is the source of truth; phones hold only a cache. Never move data ownership
back to the device (an earlier app lost data that way: iOS Safari clears script storage
after about 7 days unused).

```
teams/{teamId}              → { name, leadId, createdAt,
                                members:       [{id, name, color}],
                                formerMembers: [{id, name, color, removedAt}],    // max 200
                                hidden, hiddenAt }                                 // optional
teams/{teamId}/years/{YYYY} → { days: { memberId: { "2026-11-05": "full" } } }
```

- One year document per team holds everyone's dates. Never switch to one document per
  person: reads would blow the free tier.
- Date writes use field-level merges (`setDoc(..., {merge:true})`, `deleteField()` to
  remove), so two people editing different dates never overwrite each other.
- Roster changes use `runTransaction`, so they need a connection. Marking leaves works
  fully offline.
- A member id is minted once per person and **reused** when that person is added to
  another team from the suggestions. The id is effectively the person's identity across
  teams.
- Any legacy `"half"` value counts as a normal leave.
- **Hidden teams:** `hidden: true` takes a team out of every list and off every phone,
  for everyone; its data stays. The app has no button for it: set it in the Firebase
  console (Firestore → Data → teams → the team → add field `hidden`, boolean, true). To
  bring a team back, delete the `hidden` field. Four teams were hidden on October 29,
  2026, at Ankit's request (two duplicate copies of one team, a one-person test team and
  a former colleague's team): ids `t356e3f203j4k`, `t6m151241343l`, `t3d6s2b231k60`,
  `t0h032f0n2r0l`. Names are kept out of this public repo; they are in Ankit's private
  index.
- Colours saved on people before v23 (#F37E20, #8A1538, #A16207) are mapped to the brand
  palette when drawn (`OLD_COLORS`); saved records are not rewritten.

Stored on the phone (`localStorage`, preferences only, never data):

| Key | Meaning |
|---|---|
| `tl:known` | Teams joined on this phone, `[{id, name}]` |
| `tl:me:<teamId>` | Which member this phone is in that team |
| `tl:meId` | The last member id this phone claimed (used to recognise itself in other teams) |
| `tl:lastTeam` | Team to reopen |
| `tl:left` | Teams deliberately left on this phone, so they aren't re-adopted automatically |

## 5. Security model (a deliberate choice: read before "improving" it)

There is **no sign-in**, by Ankit's decision. The rules let any anonymous client `get`
and `list` teams, so:

- every team name is visible to anyone who opens the app;
- any team's leaves can be read through browser developer tools by someone who looks;
- "only the lead manages the roster" and "you only edit your own leaves" are enforced in
  the app, not on the server. The server forbids only deletes.

The app hides other teams; it doesn't lock them. Don't add sign-in, team codes,
passwords or per-team links unless Ankit asks. If a request would need real enforcement,
say so once and let him decide.

## 6. What the app does today (v24)

**Getting in**
- One link for everyone. First open shows "Which team are you in?" with every team;
  the person taps theirs, then taps their own name once. The phone remembers.
- The list shows every team. Teams already on the phone say "on this phone · Open"
  instead of disappearing (v22: a team the phone had joined by itself used to vanish
  from the list, leaving nothing to tap).
- "Create a team" makes the creator its lead.
- If a lead adds someone who already has an identity on this phone (same member id),
  the phone picks up the new team by itself and shows a toast. If the phone is on the
  first-run team list at that moment, it opens that team straight away (v22).
- Team chips at the top switch between the teams joined on this phone.

**Marking leave**
- Calendar tab: tap a future date to mark or unmark it, instantly, no confirmation.
- Press and hold a date: who's out that day (a cell fits only two initials, or one
  initial plus "+N").
- "Select range" button: drag from first to last day, or tap first then tap last. The
  first day decides whether the range is marked or unmarked. Removing 2 or more marked
  days asks first, showing the dates (v23).
- Past dates can't be changed by members.
- A leave is written to **every** team where this phone is recognised (matched by member
  id, not by name). Teams joined without picking a name are skipped, with a nudge. All
  teams' writes are handed to the database at once, so offline marks reach every team
  (before v23 only the first team's write was queued offline).
- Offline or slow: the toast says "saved on this phone, will sync when you're online", and
  a card shows "N changes waiting to sync … don't clear this app's data or uninstall it"
  until they arrive (v23).
- If the person's dates differ between their teams, a "Your leaves don't match" card
  offers "Review and fix", which makes every team match the one on screen. It's also in
  the account menu as "Check my leaves match across teams".

**Seeing who's out**
- Header: "N people out today" with first names, or "Everyone's in today."
- Person chips filter the calendar to one person.
- List tab: each person's upcoming leaves as text rows with weekdays
  ("Thu 20 – Fri 21 Aug"), a TODAY badge, no day counts, no mini-calendar.
- Status line at the bottom: Synced / Saving… / Offline (with the count waiting) /
  Reconnecting / errors. Team and year listeners include metadata changes, so "Saving…"
  clears and there is no false "Reconnecting" after opening (v23, v24).

**Lead only (Manage team)**
- Rename the team; add people (type-ahead suggests people already on other teams);
  rename people (✎, this team only); hand over the lead (★); remove people (✕).
- Removing someone is **reversible**: they move to "Removed · leaves kept" and their
  dates stay. "Add back" restores them with their dates. A second ✕ there deletes their
  dates for good: the only irreversible action in the app.
- Clear anyone's leave on a date (including past dates), in this team only.

**Everyone**
- "Edit my name" (menu under your name, or ✎ on your own row): fixes your name in every
  team you're on (v23).
- "Download Excel" (Manage team / Team members): a real .xlsx built in the page with no
  library. Sheet "Leaves": one row per stretch of leave (Name, From, To, Days), all years.
  Sheet "Summary": each person's leave days this year, upcoming leave days, next leave.
  Real date cells ("Thu 5 Nov 2026"), Mulish, orange header row, filters, frozen header,
  fits one page wide when printed. Days count dates marked, weekends included. Checked to
  open cleanly in Microsoft Excel.
- Every "are you sure?" is an in-app sheet (`askConfirm`), not the browser's pop-up.
  Back, Cancel or tapping outside always means no (v23).

**Backup and restore**
- "Download a backup" (one team) and "Back up all my teams" (account menu). Files are
  readable JSON: dates grouped under each person's name, with `teamId` so a restore
  survives renames.
- "Restore from a backup file": matches teams by id (then by name), restores only teams
  this phone leads. Options: "Add back anything missing" (merge), "Replace all leaves"
  (exact; keeps removed people's dates), "Only this", and "Into <current team>" for
  teams no longer here. Never removes anyone from a roster.

**Other**
- Share sheet: copy the link, or copy a ready WhatsApp message.
- "Leave <team> on this phone" hides it here only.
- Installable PWA; works offline. Every sheet and mode is a history entry, so Android
  Back closes one layer at a time; each sheet also has its own ← / ✕ for iPhone.
- The version (e.g. "v24") shows at the bottom of the screen and in the account menu.
- Look (v23): ICICI Bank orange #E3530F (flat header, buttons), maroon #94292E (your-leave
  bar, alerts), Mulish. A darker orange #B23F0A is used only for small orange text on
  white, where the brand orange is too light to read. Internal tool, so no ICICI Bank
  logo (brand rule for internal pieces).

## 7. Making a change and releasing it

Claude makes the change, tests it, pushes and checks it live. Ankit doesn't upload files.

1. Pull `main` first and confirm it matches what's live (compare `APP_VERSION` in the
   live page with the repo).
2. Make the change in `index.html` (and `sw.js` if needed).
3. **Bump the version in two places, together:** `APP_VERSION` in `index.html` and
   `CACHE` in `sw.js` (`v21` → `v22`, and so on). Otherwise phones may show the old copy.
4. Test before pushing:
   - `python3 test/run-checks.py`: syntax check plus headless logic checks. Every line
     must say "ok". Add a check for every bug fixed;
   - `python3 test/make-test-copy.py`, then serve `test/site/` locally and click through
     every changed flow at phone size. It runs on a fake database with made-up teams, so
     nothing real is touched (a throwaway team on the real database would show up for
     every user). Offline can be simulated there (see the script's notes). Delete
     `test/site/` afterwards;
   - for looking at real data, open the live app read-only; never tap dates or roster
     controls on a real team.
5. Commit with a clear message and push to `main`.
6. Wait about 2 minutes, then confirm the live page shows the new `APP_VERSION` and
   `sw.js` the new `CACHE`. Tell Ankit how to see it: close and reopen the app (installed),
   or refresh the page (browser). The first open after a release can still show the old
   copy; a second open shows the new one.
7. Update this file and `DECISIONS.md` in the same session.

If `firestore.rules` changes, the file in the repo does nothing by itself: the rules must
be published in the Firebase console (Firestore Database → Rules → Publish). That needs
Ankit's login; give him numbered click steps.

## 8. Open items

None from the October 29, 2026 review: the brand, team-list clutter, Excel, own-name,
sync-warning, range-removal and confirmation items were done in v23. The bank office
network was dropped as an item: the app is used on personal phones (Ankit).

Things to know rather than fix:
- Removing someone keeps their dates (dormant). "Delete for good" is the lead's choice.
- Hidden teams keep their data in the database. Deleting one for good can only be done
  by Ankit in the Firebase console (Firestore → Data → teams → the team → ⋮ → Delete
  document, and its `years` documents).

## 9. History

| Date | Version | What changed |
|---|---|---|
| Oct 29, 2026 | v24 | False "Reconnecting" status about 7 seconds after every open fixed (team listener now hears metadata changes) |
| Oct 29, 2026 | v23 | ICICI Bank look (orange, maroon, Mulish, flat header, icons); hidden teams; Excel download; anyone can fix their own name (all their teams); sync warning and offline-safe writes to every team; check before Select range removes 2+ days; in-app confirmations replace all browser pop-ups; test tools added in `test/` |
| Oct 29, 2026 | v22 | Team list shows every team ("Open" for ones on the phone); a team the phone is added to opens straight away; rejoining a left team clears it from the left list |
| Sep 9, 2026 | v21 | Reversible member removal, back navigation, people shared across teams (same member id, type-ahead, auto-adopt), page fetched fresh when online, version shown on screen |
| Aug 27, 2026 | v16 | "Leaves don't match across teams" check and fix; lead can clear anyone's leave |
| Aug 19, 2026 | v14 | First handoff written |
| Aug 18, 2026 | v4 → v14 | One link for everyone with a team picker; many UI rounds the same day |
| Aug 17, 2026 | v1 | First version |
