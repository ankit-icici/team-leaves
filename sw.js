/* Team Leaves — offline shell.
   Caches the app itself so it opens with no signal.
   Your leave DATA is handled separately by Firestore's own offline cache. */

const CACHE = "team-leaves-v21";
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

/* The page itself is fetched fresh whenever there is a connection, falling back
   to the cache when there isn't. Cache-first was serving the previous upload on
   the first open after a change — the new file only appeared the time after
   that, which made it look as though a change hadn't worked. */
function pageFirst(req){
  return new Promise(resolve => {
    let settled = false;
    const done = r => { if(!settled && r){ settled = true; resolve(r); } };
    const cached = () => caches.match(req).then(hit => hit || caches.match("./index.html"));

    // don't let a dead connection hang the splash: fall back after 3.5s
    const timer = setTimeout(() => cached().then(done), 3500);

    fetch(req).then(res => {
      clearTimeout(timer);
      if(res && res.ok){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        done(res);
      } else cached().then(hit => done(hit || res));
    }).catch(() => {
      clearTimeout(timer);
      cached().then(hit => done(hit || new Response(
        "<h1>Offline</h1><p>Open the app once with a connection.</p>",
        { status:503, headers:{ "Content-Type":"text/html" } })));
    });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);
  const isShell = url.origin === location.origin;
  const isSDK   = url.hostname === "www.gstatic.com";

  // Never intercept Firestore traffic — it manages its own offline queue.
  if(!isShell && !isSDK) return;

  // The HTML is the only thing that changes between uploads; everything else
  // (icons, manifest, the version-pinned SDK) stays cache-first and instant.
  const isPage = req.mode === "navigate" ||
                 url.pathname.endsWith("/") ||
                 url.pathname.endsWith("/index.html");
  if(isShell && isPage){ e.respondWith(pageFirst(req)); return; }

  e.respondWith(
    caches.match(req).then(hit => {
      const fresh = fetch(req).then(res => {
        if(res && res.ok){
          caches.open(CACHE).then(c => c.put(req, res.clone()));
        }
        return res;
      }).catch(() => hit);
      return hit || fresh;
    })
  );
});
