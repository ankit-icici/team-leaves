"""Build a private test copy of the app in test/site/, wired to an in-memory fake
database (mock-firebase.js) seeded with made-up teams (seed.html). Nothing touches
the real Firebase project. Serve it locally and click through at phone size:

    python3 test/make-test-copy.py
    python3 -m http.server 8766 --bind 127.0.0.1 --directory test/site

In the browser console: window.__mock.offline = true; dispatchEvent(new Event("offline"))
to test offline, and window.__mock.goOnline(); dispatchEvent(new Event("online")) to reconnect.
test/site/ is throwaway: never commit it."""
import os, re, shutil, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
site = os.path.join(root, "test", "site")
shutil.rmtree(site, ignore_errors=True); os.makedirs(site)
for f in ["sw.js", "manifest.json", "mulish.woff2", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]:
    shutil.copy(os.path.join(root, f), site)
shutil.copy(os.path.join(root, "test", "mock-firebase.js"), site)
s = open(os.path.join(root, "index.html"), encoding="utf-8").read()
s = re.sub(r'from "https://www\.gstatic\.com/firebasejs/[\d.]+/firebase-(app|auth|firestore)\.js"', 'from "./mock-firebase.js"', s)
if s.count("./mock-firebase.js") != 3: sys.exit("Firebase imports changed: update make-test-copy.py")
seed = open(os.path.join(root, "test", "seed.html"), encoding="utf-8").read()
s = s.replace('<script type="module">', seed + '<script type="module">', 1)
open(os.path.join(site, "index.html"), "w", encoding="utf-8").write(s)
print("Test copy ready in", site)
