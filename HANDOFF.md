# Team Leaves: handoff

Everything a new Claude session needs to carry on with no explanation. Read `CLAUDE.md`
first, then this file, then `DECISIONS.md`. Last brought up to date: October 29, 2026,
for app version **v21**.

---

## 1. What it is

A leave tracker for Ankit's department at ICICI Bank (Alliances / Brand Partnerships),
used on phones. Each person marks their own upcoming leaves and everyone in the team
sees who's out. It is **not** an approval system, only visibility.

- Live app: https://ankit-icici.github.io/team-leaves/
- Repo (public): https://github.com/ankit-icici/team-leaves (branch `main`)
- Owner: Ankit Garg. Official (ICICI Bank) work.
- In use as of October 29, 2026: 12 teams, 69 names across all rosters (one person on
  two teams counts twice). The biggest team has 33 people.

## 2. Files

| File | What it is |
|---|---|
| `index.html` | The whole app: inline CSS plus one ES module. About 2,200 lines. |
| `sw.js` | Service worker: caches the app shell so it opens offline. Holds the cache version. |
| `manifest.json` | Makes it installable (name, icons, colours). |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | App icons. |
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
                                formerMembers: [{id, name, color, removedAt}] }   // max 200
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

## 6. What the app does today (v21)

**Getting in**
- One link for everyone. First open shows "Which team are you in?" with every team;
  the person taps theirs, then taps their own name once. The phone remembers.
- "Create a team" makes the creator its lead.
- If a lead adds someone who already has an identity on this phone (same member id),
  the phone picks up the new team by itself and shows a toast.
- Team chips at the top switch between the teams joined on this phone.

**Marking leave**
- Calendar tab: tap a future date to mark or unmark it, instantly, no confirmation.
- Press and hold a date: who's out that day (a cell fits only two initials, or one
  initial plus "+N").
- "Select range" button: drag from first to last day, or tap first then tap last. The
  first day decides whether the range is marked or unmarked.
- Past dates can't be changed by members.
- A leave is written to **every** team where this phone is recognised (matched by member
  id, not by name). Teams joined without picking a name are skipped, with a nudge.
- If the person's dates differ between their teams, a "Your leaves don't match" card
  offers "Review and fix", which makes every team match the one on screen. It's also in
  the account menu as "Check my leaves match across teams".

**Seeing who's out**
- Header: "N people out today" with first names, or "Everyone's in today."
- Person chips filter the calendar to one person.
- List tab: each person's upcoming leaves as text rows with weekdays
  ("Thu 20 – Fri 21 Aug"), a TODAY badge, no day counts, no mini-calendar.
- Status line at the bottom: Synced / Saving… / Offline / Reconnecting / errors.

**Lead only (Manage team)**
- Rename the team; add people (type-ahead suggests people already on other teams);
  rename people (✎); hand over the lead (★); remove people (✕).
- Removing someone is **reversible**: they move to "Removed · leaves kept" and their
  dates stay. "Add back" restores them with their dates. A second ✕ there deletes their
  dates for good: the only irreversible action in the app.
- Clear anyone's leave on a date (including past dates), in this team only.

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
- The version (e.g. "v21") shows at the bottom of the screen and in the account menu.

## 7. Making a change and releasing it

Claude makes the change, tests it, pushes and checks it live. Ankit doesn't upload files.

1. Pull `main` first and confirm it matches what's live (compare `APP_VERSION` in the
   live page with the repo).
2. Make the change in `index.html` (and `sw.js` if needed).
3. **Bump the version in two places, together:** `APP_VERSION` in `index.html` and
   `CACHE` in `sw.js` (`v21` → `v22`, and so on). Otherwise phones may show the old copy.
4. Test before pushing:
   - `node --check` on the script extracted from `index.html`;
   - run the pure functions headlessly: strip the Firebase imports and the boot block,
     stub `document`, `localStorage` and `location`. This has caught real bugs;
   - click through the real flows in a browser at phone size, using a throwaway test
     team, never a real team's data.
5. Commit with a clear message and push to `main`.
6. Wait about 2 minutes, then confirm the live page shows the new `APP_VERSION` and
   `sw.js` the new `CACHE`. Tell Ankit how to see it (close and reopen the app).
7. Update this file and `DECISIONS.md` in the same session.

If `firestore.rules` changes, the file in the repo does nothing by itself: the rules must
be published in the Firebase console (Firestore Database → Rules → Publish). That needs
Ankit's login; give him numbered click steps.

## 8. Open items

1. **Not on ICICI Bank brand:** the app uses its own orange (#F37E20 / #E06A0E), maroon
   (#8A1538) and the phone's system font, not the brand orange #E3530F, maroon #94292E
   or Mulish. Ankit to decide whether to rebrand.
2. **Clutter in the team list:** three near-identical teams that differ only by an
   apostrophe or the word "Team", plus a few one-person teams that look like tests. The
   app can't delete teams (the rules forbid it); it has to be done in the Firebase
   console, after checking with each team's lead.
3. No Excel / CSV export.
4. Ordinary members can't fix their own name; only the lead can.
5. No "N changes waiting to sync" banner. The one real data-loss window: a leave marked
   offline on a phone whose storage is cleared before it syncs.
6. In Select-range mode, an accidental drag that starts on an existing leave can clear
   many days at once.
7. Some confirmations use the browser's plain `confirm()` box rather than an in-app sheet.
8. Office network: Zscaler on bank laptops (and some managed phones) may block
   `googleapis.com` / `firebaseio.com`. Not recorded as tested.

## 9. History

| Date | Version | What changed |
|---|---|---|
| Sep 9, 2026 | v21 | Reversible member removal, back navigation, people shared across teams (same member id, type-ahead, auto-adopt), page fetched fresh when online, version shown on screen |
| Aug 27, 2026 | v16 | "Leaves don't match across teams" check and fix; lead can clear anyone's leave |
| Aug 19, 2026 | v14 | First handoff written |
| Aug 18, 2026 | v4 → v14 | One link for everyone with a team picker; many UI rounds the same day |
| Aug 17, 2026 | v1 | First version |
