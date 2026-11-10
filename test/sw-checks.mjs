// Checks for the alert display in sw.js: loads the worker with a fake `self`.
// Run by test/run-checks.py.
import fs from "node:fs";
const H = {}; let shown = null, opened = null;
const self = { addEventListener:(t,f)=>{ H[t]=f; }, registration:{ scope:"https://x/team-leaves/",
  showNotification:(t,o)=>{ shown={t,o}; return Promise.resolve(); } },
  clients:{ matchAll:async()=>[], openWindow:async u=>{ opened=u; } }, skipWaiting(){} };
const store = {};
const caches = { open:async()=>({ addAll:async()=>{}, put:async(k,r)=>{ store[k]=await r.text(); }, match:async k=> store[k] ? { json:async()=>JSON.parse(store[k]) } : null }), keys:async()=>[], match:async()=>null };
new Function("self","caches","location","fetch", fs.readFileSync(process.argv[2],"utf8"))(self, caches, {origin:"https://x"}, async()=>({ok:true}));
const ok=(c,m)=>{ console.log((c?"ok   ":"FAIL ")+m); if(!c) process.exitCode=1; };
let wait=null;
const ev = data => ({ data: data===undefined?null:{ json:()=>JSON.parse(data) }, waitUntil:p=>{ wait=p; } });
H.push(ev(JSON.stringify({ data:{ title:"On leave today (2) · Alpha", body:"Asha, Bilal", tag:"day-tA", url:"./?t=tA" }, from:"x" })));
await wait;
ok(shown && shown.t==="On leave today (2) · Alpha" && shown.o.body==="Asha, Bilal", "push: shows the alert's title and text");
ok(shown.o.tag==="day-tA" && shown.o.renotify===true, "push: a newer alert of the same kind replaces the old one");
H.push(ev(undefined)); await wait;
ok(shown.t==="Team Leaves", "push with no content still shows something (iPhone requires it)");
H.notificationclick({ notification:{ close(){}, data:{ url:"./?t=tA" } }, waitUntil:p=>{ wait=p; } }); await wait;
ok(opened==="https://x/team-leaves/?t=tA", "tapping an alert opens the app on that team");

ok(store["last-alert"] && JSON.parse(store["last-alert"]).title==="Team Leaves", "an arriving alert is noted for the phone check");
let reply=null;
H.message({ data:{ type:"alert-status" }, ports:[{ postMessage:m=>{ reply=m; } }], waitUntil:p=>{ wait=p; } }); await wait;
ok(reply && /^v\d+$/.test(reply.version) && reply.last && reply.last.title==="Team Leaves", "phone check reports version and last alert: "+JSON.stringify(reply));
H.message({ data:{ type:"sample-alert" }, ports:[], waitUntil:p=>{ wait=p; } }); await wait;
ok(shown.t==="Sample alert", "sample alert can be shown on demand");
