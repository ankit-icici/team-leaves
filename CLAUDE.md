# Team Leaves: read first

Official (ICICI Bank) work for Ankit Garg. Ankit's rules for every project live in
`~/Desktop/AI/BEST_PRACTICES.md` and load automatically; this file holds only this
project's specifics.

**Read in this order, fully, before doing anything:** this file → `HANDOFF.md` (what the
app is and how it works today) → `DECISIONS.md` (what Ankit has decided; never ask twice).

## Project rules
- **Claude releases.** Change, test, push to `main`, wait for GitHub Pages, confirm the live
  version changed, then tell Ankit how to see it. He doesn't upload files.
- **Every release bumps two things together:** `APP_VERSION` in `index.html` and `CACHE` in
  `sw.js`.
- **Test before pushing:** `node --check` the extracted script, run the pure functions
  headlessly, and click through on a phone-sized screen using a throwaway test team. Never
  use a real team's data.
- **Don't undo the decisions in `DECISIONS.md`.** In particular: no sign-in, no half-days,
  one year document per team, Firestore as the source of truth.
- **The repo is public.** No colleagues' names, personal data or secrets in code, notes or
  commit messages. The Firebase web config is public by design and stays in `index.html`.
- `firestore.rules` in the repo is only a copy. Rule changes must also be published in the
  Firebase console, which needs Ankit's login: give him click steps.
- After every change, update `HANDOFF.md` (features, history, open items) and add any new
  decision to `DECISIONS.md`, in the same session.

## Where things are
- Live: https://ankit-icici.github.io/team-leaves/
- Firebase project: `team-leaves-270f6` (Firestore, asia-south1, free Spark plan)
- Laptop folder: `~/Desktop/AI/ICICI/Team Leaves/` holds only `Start prompt.txt`. All
  other files live here in the repo.
