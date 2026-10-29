# Team Leaves: decision log (newest first)

Ankit's decisions for this app, so he is never asked twice. Entries marked *(recorded in
earlier notes)* come from the August 2026 handoff, setup guides or change history: they
are what those notes say Ankit decided, not his words in this log. Rules for every
project are in `~/Desktop/AI/BEST_PRACTICES.md`, not here.

| Date | Decision | Why / notes |
|---|---|---|
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
| Aug 2026 | Tapping a date toggles it immediately, with no confirmation. | *(recorded in earlier notes)* |
| Aug 2026 | Press and hold a date shows a read-only "who's out" list. | *(recorded in earlier notes)* A cell fits only about two initials. |
| Aug 2026 | Range selection sits behind a "Select range" button, not always on. | *(recorded in earlier notes)* An always-on drag swallows the vertical swipe used to scroll. |
| Aug 2026 | A marked leave is written to every team the person is recognised in, matched by member id, not by name. | *(recorded in earlier notes)* |
| Aug 2026 | Two tabs: Calendar and List. List shows upcoming leaves with weekdays and a TODAY badge, no day counts, no mini-calendar. | *(recorded in earlier notes)* |
| Aug 2026 | Calendar columns use `minmax(0,1fr)`. | *(recorded in earlier notes)* Plain `1fr` let avatars push the 7th day off screen. |
| Aug 2026 | The status line tracks cache state per listener and warns only after 7 seconds of stale data. | *(recorded in earlier notes)* One shared flag caused false "Reconnecting" warnings. |
| Aug 2026 | Backups are human-readable (dates under each person's name) and record `teamId`; restore offers merge or exact replace and never removes anyone from a roster. | *(recorded in earlier notes)* |
| Aug 17, 2026 | Firestore is the source of truth; phones keep only a cache. One year document per team, field-level merges for dates, transactions for roster changes. Free Spark plan, no card on file. | *(recorded in earlier notes)* An earlier app kept data on the phone and kept losing it. One document per person would exceed free-tier reads. |
| Aug 17, 2026 | Hosted free on GitHub Pages (public repo); Firestore in asia-south1 (Mumbai); anonymous auth on. | *(recorded in earlier notes)* Free, no server; Mumbai is closest to the team. |
