# Team Leaves: decision log (newest first)

Ankit's decisions for this app, so he is never asked twice. Entries marked *(recorded in
earlier notes)* come from the August 2026 handoff, setup guides or change history: they
are what those notes say Ankit decided, not his words in this log. Rules for every
project are in `~/Desktop/AI/BEST_PRACTICES.md`, not here.

| Date | Decision | Why / notes |
|---|---|---|
| Oct 29, 2026 | Testing the bank office network (Zscaler) is not needed. | Ankit: the app is used on personal phones. |
| Oct 29, 2026 | Four teams hidden, not deleted: two duplicate copies of one team, a one-person test team and a former colleague's team (ids in `HANDOFF.md` section 4). | Ankit asked to delete them. Claude may not permanently delete data, so "delete" means hidden for everyone (reversible); Ankit can delete for good in the Firebase console. Their leaves were already in the real teams, except 2 past days in the test team. |
| Oct 29, 2026 | A colleague who left ICICI Bank was removed from the biggest team. | Ankit's request. Done as the app's normal reversible removal; there were no leaves marked. |
| Oct 29, 2026 | The app follows ICICI Bank brand: orange #E3530F, maroon #94292E, Mulish, flat orange header (no gradient behind text), recoloured icons. No ICICI Bank logo. | Ankit approved. No logo because it is an internal tool (brand rule for internal pieces). |
| Oct 29, 2026 | Excel download for everyone: a list of every stretch of leave plus a per-person summary. | Ankit chose the list over a month grid. |
| Oct 29, 2026 | Anyone can fix their own name, and it changes in all their teams. A lead's edit of someone else stays in the lead's team. | Ankit approved. |
| Oct 29, 2026 | Removing 2 or more days with Select range asks first. Single taps still save instantly with no confirmation. | Ankit approved. A slip could wipe a whole stretch. |
| Oct 29, 2026 | Every confirmation is an in-app sheet, never the browser's pop-up. | Ankit approved. |
| Oct 29, 2026 | When changes are waiting to sync, the app says how many and warns not to clear its data. | Ankit approved. |
| Oct 29, 2026 | The team list shows every team; teams already on the phone say "Open". A team the phone is added to opens straight away. | Ankit approved (v22), after a member couldn't find his team. |
| Oct 29, 2026 | The Firebase project keeps **one owner only**: Ankit's dedicated Google account (name in his private index, not this public repo). No second owner. Don't propose one again. | Ankit's choice, made after the risk was flagged once: if that account is lost, nobody can manage the app. |
| Oct 29, 2026 | Claude releases changes itself: test, push to `main`, confirm live. Ankit no longer uploads files through the GitHub website. | Ankit's choice, matching his best practices. Replaces the August "hand me complete files" workflow. |
| Oct 29, 2026 | `SETUP.md` and `SETUP-V4.md` are kept as one-time setup history, marked as such, with their content unchanged. `HANDOFF.md` describes the app as it is today. | Ankit's choice. |
| Oct 29, 2026 | Notes brought up to date for v21; `CLAUDE.md` and this log added. | Ankit asked. |
| Sep 9, 2026 | Removing a member is reversible: they move to `formerMembers` with their dates kept; "Add back" restores them. Deleting their dates is a separate, explicit ✕. | *(recorded in earlier notes)* Removal used to delete leaves, the app's one destructive action. |
| Sep 9, 2026 | Every sheet and mode is a browser history entry; each sheet has its own ← / ✕. | *(recorded in earlier notes)* Android Back was closing the whole app; iPhone has no system Back. |
| Sep 9, 2026 | Adding someone already on another team reuses their member id (type-ahead suggests them), copies their upcoming leaves, and their phone adopts the new team automatically. | *(recorded in earlier notes)* |
| Sep 9, 2026 | The page is fetched fresh when online (cache only as a fallback), and the version shows on screen. | *(recorded in earlier notes)* Cache-first showed the previous upload on first open, so changes looked as if they hadn't worked. |
| Aug 27, 2026 | If a person's dates differ between their teams, offer one-tap "make all my teams match the one on screen". | *(recorded in earlier notes)* |
| Aug 27, 2026 | The lead can clear anyone's leave on any date (past included), in their own team only, never in the person's other teams. | *(recorded in earlier notes)* |
| Aug 2026 | **No sign-in.** Every team name is visible; leaves are readable by anyone who goes looking; lead-only and own-leave-only are enforced in the app, not the server. Don't add sign-in, codes, passwords or per-team links unless Ankit asks. | *(recorded in earlier notes)* Zero-friction rollout inside one department, chosen after discussing alternatives at length. Add sign-in before spreading to other functions or holding anything confidential. |
| Aug 18, 2026 | One link for the whole department; people pick their team in the app. | *(recorded in earlier notes)* Replaced one secret link per team. |
| Aug 2026 | No half-day option. Legacy `"half"` values count as a full leave. | *(recorded in earlier notes)* Removed on request. |
| Aug 2026 | Tapping a date toggles it immediately, with no confirmation. | *(recorded in earlier notes)* Still true; since Oct 29, 2026 only a Select range that removes 2+ days asks first. |
| Aug 2026 | Press and hold a date shows a read-only "who's out" list. | *(recorded in earlier notes)* A cell fits only about two initials. |
| Aug 2026 | Range selection sits behind a "Select range" button, not always on. | *(recorded in earlier notes)* An always-on drag swallows the vertical swipe used to scroll. |
| Aug 2026 | A marked leave is written to every team the person is recognised in, matched by member id, not by name. | *(recorded in earlier notes)* |
| Aug 2026 | Two tabs: Calendar and List. List shows upcoming leaves with weekdays and a TODAY badge, no day counts, no mini-calendar. | *(recorded in earlier notes)* |
| Aug 2026 | Calendar columns use `minmax(0,1fr)`. | *(recorded in earlier notes)* Plain `1fr` let avatars push the 7th day off screen. |
| Aug 2026 | The status line tracks cache state per listener and warns only after 7 seconds of stale data. | *(recorded in earlier notes)* One shared flag caused false "Reconnecting" warnings. |
| Aug 2026 | Backups are human-readable (dates under each person's name) and record `teamId`; restore offers merge or exact replace and never removes anyone from a roster. | *(recorded in earlier notes)* |
| Aug 17, 2026 | Firestore is the source of truth; phones keep only a cache. One year document per team, field-level merges for dates, transactions for roster changes. Free Spark plan, no card on file. | *(recorded in earlier notes)* An earlier app kept data on the phone and kept losing it. One document per person would exceed free-tier reads. |
| Aug 17, 2026 | Hosted free on GitHub Pages (public repo); Firestore in asia-south1 (Mumbai); anonymous auth on. | *(recorded in earlier notes)* Free, no server; Mumbai is closest to the team. |
