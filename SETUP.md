# Team Leaves — setup

About 20 minutes, one time. No credit card, no server, no cost.

You need to do all of this **once, on a laptop**. Everyone else just opens a link.

---

## Before you start: the account

Create a **new Google account** for this — something like `teamleaves.brandpartnerships@gmail.com`.

Do not use your personal Gmail. The account that creates this project owns the app forever. If it's tied to one person and that person changes roles or loses access, the app dies with it and nobody else can fix it.

Once the project exists, add a second owner: **Firebase console → ⚙ → Users and permissions → Add member → Owner.** Use a trusted colleague's work address. Two minutes now, unfixable later.

---

## Step 1 — Create the Firebase project

1. Go to `console.firebase.google.com` and sign in with the new account.
2. **Create a project.** Name it `team-leaves`.
3. Turn **off** Google Analytics when it offers. You don't need it and it adds consent obligations.
4. Wait for it to finish, then click **Continue**.

## Step 2 — Create the database

1. Left sidebar → **Build → Firestore Database → Create database**.
2. Choose **Production mode** (not test mode — test mode leaves it open to the world and expires after 30 days).
3. Location: pick **asia-south1 (Mumbai)**. Closest to your team = fastest. **This cannot be changed later.**
4. Click **Create**.

## Step 3 — Paste the security rules

1. Firestore Database → **Rules** tab.
2. Delete everything in the box.
3. Open `firestore.rules` from this folder, copy all of it, paste it in.
4. Click **Publish**.

## Step 4 — Turn on sign-in

1. Left sidebar → **Build → Authentication → Get started**.
2. Under **Sign-in method**, find **Anonymous** in the list.
3. Click it, toggle **Enable**, click **Save**.

Nobody has to create an account or remember a password. Each phone quietly gets an identity so the security rules have something to check.

## Step 5 — Get your six values

1. Click **⚙ Project settings** (top of the left sidebar).
2. Scroll to **Your apps** → click the **web icon `</>`**.
3. App nickname: `Team Leaves`. Do **not** tick Firebase Hosting. Click **Register app**.
4. You'll see a `firebaseConfig = { ... }` block. Keep this page open.

## Step 6 — Paste them into the app

1. Open `index.html` in any text editor (Notepad, TextEdit, VS Code).
2. Near the top you'll see a block marked `PASTE YOUR FIREBASE CONFIG HERE`.
3. Replace each `PASTE_apiKey`, `PASTE_authDomain`, and so on with the matching value from Firebase. Keep the quote marks.
4. Save.

These six values are **designed to be public**. They identify your project, they don't authorise anything. Your security rules are what protect the data. It's fine that they sit in a file on the internet.

## Step 7 — Put it online

1. Go to `github.com`, sign in (or create a free account).
2. **New repository.** Name: `team-leaves`. Set it to **Public** — GitHub Pages needs Public on the free plan. Click **Create**.
3. Click **uploading an existing file** and drag in all eight files: `index.html`, `sw.js`, `manifest.json`, `firestore.rules`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and `SETUP.md`. Click **Commit changes**.
4. Repository **Settings → Pages**.
5. Under **Source**, choose **Deploy from a branch**. Branch: `main`, folder: `/ (root)`. Click **Save**.
6. Wait two or three minutes, then refresh. Your link appears at the top:
   `https://YOUR-USERNAME.github.io/team-leaves/`

That link is now your app. It's free and it doesn't expire.

## Step 8 — Test it before telling anyone

Open the link on your own phone and check all five:

- The strip at the bottom says **"Synced with your team"** in green.
- Add two or three names. They save.
- Tap a future date, mark a leave. It appears.
- Open the same link on a **second phone**. The names and the leave are already there.
- Turn on aeroplane mode, mark another leave, turn it off. Watch it sync.

**Test it on an ICICI-managed phone too, on the office network.** Corporate policy sometimes blocks `googleapis.com` and `firebaseio.com`. This is the single most likely thing to derail the rollout, and finding out now costs nothing.

## Step 9 — Roll out to the team

Send one message:

> Team leave tracker: `https://YOUR-USERNAME.github.io/team-leaves/`
>
> Open it, then install it: on Android tap ⋮ → Install app, on iPhone use Safari → Share → Add to Home Screen. Open it from the new icon, tap your own name in the top-right corner once, and after that just tap dates to mark your leaves.

- **Android (Chrome):** a prompt should appear on its own. Otherwise ⋮ menu → **Install app**. This creates a genuinely installed app — its own icon in the app drawer, no address bar, its own card in the app switcher.
- **iPhone (Safari):** Share button → **Add to Home Screen**. Must be Safari; Chrome on iOS can't do it.

Installing matters more than it looks. It's what makes the app open full-screen without browser chrome, work without signal, and — on iPhone especially — keep its saved data instead of having it cleared after a week of non-use.

---

## Why your data won't vanish this time

Your other app kept the data **on the phone**. Phones delete that: iOS Safari clears script storage for sites you haven't opened in about 7 days, and Android evicts it when storage runs low. The export file was your only real copy, so you had to keep restoring it.

Here, **Firestore is the source of truth** and the phone only holds a cache. If a phone's cache gets wiped, the app reopens, notices it's empty, and downloads everything again from the server. You never see it happen. There is nothing to restore and nothing to re-sync.

The **Backup** button in the app downloads a JSON copy anyway. That's insurance against a person deleting a teammate by mistake — not against the app losing data on its own.

---

## If something goes wrong

**"Access denied — check your security rules"**
Step 3 didn't publish. Go back to Firestore → Rules and confirm your rules are there, then Publish again.

**"Sign-in is switched off"**
Step 4 was missed. Authentication → Sign-in method → enable Anonymous.

**Page loads but stays on "One step to go"**
The config in Step 6 still has `PASTE_` in it, or a quote mark got deleted. Re-check that block.

**Blank page**
Open the link on a laptop, press F12, read the Console tab. A typo in the config block shows up there in plain language.

**Works on your phone, not a colleague's**
Almost always the corporate network or device policy. Test the same phone on mobile data — if it works there, it's the office network, and you'll need IT to allow `googleapis.com` and `firebaseio.com`.

**Nothing syncs, no error**
Check you're both on the exact same URL. A trailing `/index.html` versus no trailing slash is still the same app, but a different GitHub username or repo name is not.

---

## Living with it

**Cost.** The free Spark plan allows roughly 50,000 reads and 20,000 writes per day. This app uses two documents, so opening it costs about two reads regardless of team size. A hundred people using it all day lands nowhere near the limit. There is no card on file, so it cannot silently start charging you — it would stop working first, and it won't get that far.

**Adding people later.** Anyone can add a name from Manage team. It appears on everyone's phone within a second.

**Years.** The app creates a new document each January automatically. Nothing to do.

**Changing the design.** Edit `index.html` on GitHub, commit, and every phone picks it up on next open. If it looks stale, bump `team-leaves-v1` to `v2` in `sw.js` to force the cached copy to refresh.

**One caveat worth knowing.** Adding or removing *people* needs internet, because those writes have to be checked against the current list to avoid two phones overwriting each other. Marking *leaves* works fully offline. Since roster changes happen once at setup and leaves happen daily, this trade is the right way round.
