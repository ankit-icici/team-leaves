# Team Leaves v4 — one link, teams chosen in the app

Same Firebase project. One link for the whole department. Nobody signs in, nobody types a code.

Two console jobs and a file swap. About 10 minutes.

---

## How it works now

There's a single link. Everyone uses it.

On first open, the person sees **"Which team are you in?"** with a list of every team. They tap theirs. From then on the app opens straight into that team and the others are out of sight. If they're in two teams, they tap both and get chips at the top to switch.

Nothing to remember, nothing to type, one message to send.

## What you're trading for that — read once, then decide it's fine

For the app to show that picker, it has to be able to read the list of teams. Which means:

- **Every team name is visible** to anyone who opens the app.
- **Any team's leave data is reachable** by someone who deliberately looks, using the browser's developer tools. Right-click, Inspect. No skill needed.

The app shows a person only their own team. That's the app being polite, not the server refusing. There is no way to make the server refuse when nobody signs in — it cannot tell one phone from another.

So the accurate description of this version is: *leave dates are visible to colleagues who go looking.* Which is probably true of a leave calendar on an office wall, and that's the right mental model for it.

Fine for one department. Before this spreads to other functions, or if anyone starts calling it confidential, add sign-in — the data model carries over, so that's an upgrade rather than a rebuild.

---

## Step 1 — Replace the security rules

Firestore Database → **Rules** → select all, delete, paste the new `firestore.rules`, **Publish**.

The only real change from v3 is one word: `list` is now allowed, which is what lets the app show the team picker. The comment block at the top of the file spells out what that costs, so future-you finds it there rather than having to remember this conversation.

## Step 2 — Delete your old v1 data

In the console → Firestore Database → Data → **`teams`** collection → the document named **`main`** → ⋮ → **Delete document**.

Two reasons. It won't show up correctly in v4 anyway, and leaving stale data around that nobody maintains is how you end up trusting a wrong number six months from now.

## Step 3 — Replace the files

Same repo, upload and overwrite all eight. Only `index.html`, `firestore.rules` and `sw.js` changed; icons and `manifest.json` are unchanged.

**Paste your Firebase config into the new `index.html`** — same six values, same block at the top. Copy them from your old file.

Cache version in `sw.js` is already bumped to `v4`, so phones pick up the new app rather than serving the old one.

Anonymous sign-in stays **enabled** — invisible to users, but it stops the database being read by scripts that never loaded your app.

## Step 4 — Create the teams

Open the link on your phone.

1. **Create a team** → name it → enter your own name. You're its lead.
2. Add everyone's names.
3. Repeat for each subteam.

Do this before you share the link, so people have something to pick from. A picker with an empty list is a confusing first impression.

The ★ next to a name in Manage team hands the lead role over.

## Step 5 — Test before rolling out

- Second phone, same link. Confirm the picker lists your teams, pick one, mark a leave, confirm it shows on the first phone.
- Confirm the switcher at the top shows **only** the teams you joined, not all of them.
- Join a second team from the account menu. Confirm both appear.
- Aeroplane mode → mark a leave → back online → confirm it syncs.
- Try it on an **ICICI-managed phone on the office network** before you tell 100 people. Corporate policy sometimes blocks `googleapis.com` and `firebaseio.com`. This is still the most likely thing to derail the rollout.

## Step 6 — One message, everyone

> Team leave tracker: `https://ankit-icici.github.io/team-leaves/`
>
> Tap the link, then install it — Android: ⋮ menu → Install app. iPhone: open in **Safari** → Share → Add to Home Screen.
>
> Open it from the new icon, pick your team, then tap your own name once. After that just tap dates to mark your leaves.

The app's Share sheet writes that for you: Share the app → Copy a WhatsApp message.

---

## Living with it

**New joiner.** Their lead adds their name in the app, then sends them the same link. They pick the team and their name. No setup on your side.

**Someone leaves.** The lead removes them. Note that this doesn't stop them opening the app — nothing does, without sign-in.

**Someone in two teams.** They join both; chips at the top switch between them. Teams are separate, so a leave marked in one doesn't appear in the other — mark it in both if it applies to both.

**Phone storage cleared.** They re-pick their team and their name once. No leave data is lost; that lives on the server, and the phone only holds a cache.

**Cost.** Comfortably inside the free tier. Opening the app costs roughly one read per team that exists, plus two for your own team's dates. With a dozen teams and a hundred people that's a small fraction of the daily allowance.

**Renaming a team.** The lead can't rename it in the app yet. Say the word and I'll add it — it's a small change.

## If something goes wrong

**"Access denied"** → Step 1 didn't publish. Republish the rules.

**Picker is empty** → no teams exist yet. Create one (Step 4).

**Old app keeps appearing** → the cached copy. Confirm `sw.js` says `team-leaves-v4`, then close all tabs and reopen.

**"Sign-in is switched off"** → Anonymous auth got disabled. Authentication → Sign-in method → enable Anonymous.

**Someone sees the wrong team** → they tapped the wrong row in the picker. Account menu (top-right) → Leave this team → then Join another team.
