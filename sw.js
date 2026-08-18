/* Team Leaves — offline shell.
   Caches the app itself so it opens with no signal.
   Your leave DATA is handled separately by Firestore's own offline cache. */

const CACHE = "team-leaves-v9";
const SHELL = ["./", "./index.html", "./manifest.json",
                "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isShell = url.origin === location.origin;
  const isSDK   = url.hostname === "www.gstatic.com";

  // Never intercept Firestore traffic — it manages its own offline queue.
  if (!isShell && !isSDK) return;

  // Cache first, then update quietly in the background.
  e.respondWith(
    caches.match(req).then(hit => {
      const fresh = fetch(req).then(res => {
        if (res && res.ok) {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
        }
        return res;
      }).catch(() => hit);
      return hit || fresh;
    })
  );
});
