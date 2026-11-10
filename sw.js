/* Team Leaves — offline shell.
   Caches the app itself so it opens with no signal.
   Your leave DATA is handled separately by Firestore's own offline cache. */

const CACHE = "team-leaves-v31";
const META = "team-leaves-meta";   // survives version changes: the last alert received
const SHELL = ["./", "./index.html", "./manifest.json", "./mulish.woff2",
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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== META).map(k => caches.delete(k))))
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

    // "no-cache": always ask the server whether the page changed. The browser's own
    // cache could otherwise hand back a copy up to 10 minutes old. (By URL: a
    // navigation request can't be re-sent with options.)
    fetch(req.url, { cache:"no-cache", credentials:"same-origin" }).then(res => {
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

/* ── Alerts ───────────────────────────────────────────────────
   alerts/send_alerts.py sends data-only messages through Firebase Cloud
   Messaging: { title, body, tag, url }. Showing them is done here, so the app
   needs no extra Firebase code in this worker. Every push must show something
   (iPhone withdraws permission from apps that receive pushes silently). */
self.addEventListener("push", e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch(err){ p = {}; }
  const d = p.data || p, n = p.notification || {};
  const title = d.title || n.title || "Team Leaves";
  const opts = { body: d.body || n.body || "", icon: "icon-192.png", data: { url: d.url || "./" } };
  if(d.tag){ opts.tag = d.tag; opts.renotify = true; }
  e.waitUntil(Promise.all([self.registration.showNotification(title, opts), noteAlert(title)]));
});

/* For the Alerts screen's phone check: when the last alert reached this phone. */
function noteAlert(title){
  return caches.open(META)
    .then(c => c.put("last-alert", new Response(JSON.stringify({ at: Date.now(), title }))))
    .catch(() => {});
}

/* The Alerts screen asks: which version is running here, and when did an alert
   last arrive. */
self.addEventListener("message", e => {
  const m = e.data || {}, port = e.ports && e.ports[0];
  if(m.type === "alert-status" && port)
    e.waitUntil(caches.open(META).then(c => c.match("last-alert")).then(r => r ? r.json() : null)
      .catch(() => null).then(last => port.postMessage({ version: CACHE.replace("team-leaves-", ""), last })));
});

/* Tapping an alert opens the app on the team it was about — reusing an open
   window when there is one. */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(list => {
    for(const c of list){
      if(c.url.startsWith(self.registration.scope)){
        // bring the open app forward on that team; if the browser won't let it
        // change page (iPhone, or a window this worker doesn't control), open one
        return c.focus().then(w => w && "navigate" in w ? w.navigate(url) : Promise.reject())
                .catch(() => self.clients.openWindow(url));
      }
    }
    return self.clients.openWindow(url);
  }));
});
