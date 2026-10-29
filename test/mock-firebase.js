// In-memory stand-in for the Firebase calls Team Leaves uses. Test copy only.
const store = new Map();            // path -> data
const subs = [];                    // {path, isCol, cb, meta}
const pendingWrites = [];           // resolvers waiting for "online"
let pendingPaths = new Set();
const DEL = { __del:true };
const clone = x => JSON.parse(JSON.stringify(x));
function merge(a, b){
  const out = Object.assign({}, a);
  for(const k of Object.keys(b)){
    const v = b[k];
    if(v && v.__del){ delete out[k]; continue; }
    if(v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k]))
      out[k] = merge(out[k], v);
    else if(v && typeof v === "object" && !Array.isArray(v)) out[k] = merge({}, v);
    else out[k] = v;
  }
  return out;
}
function snapDoc(path){
  const d = store.get(path);
  return { id:path.split("/").pop(), exists:() => d !== undefined, data:() => d === undefined ? undefined : clone(d),
           metadata:{ fromCache:false, hasPendingWrites:pendingPaths.has(path) } };
}
function snapCol(path){
  const docs = [];
  for(const [p] of store) if(p.startsWith(path+"/") && p.slice(path.length+1).indexOf("/") === -1) docs.push(snapDoc(p));
  return { docs, forEach:f => docs.forEach(f), size:docs.length };
}
function notify(){ for(const s of subs) s.cb(s.isCol ? snapCol(s.path) : snapDoc(s.path)); }
function apply(path, data, opts){
  store.set(path, opts && opts.merge ? merge(store.get(path) || {}, data) : merge({}, data));
}
window.__mock = {
  store, seed(path, data){ store.set(path, data); },
  offline:false,
  goOnline(){ this.offline = false; pendingPaths = new Set(); while(pendingWrites.length) pendingWrites.shift()(); notify(); },
  dump(){ return Object.fromEntries(store); }
};
export const initializeApp = () => ({});
export const getAuth = () => ({});
export const signInAnonymously = async () => ({});
export const onAuthStateChanged = (a, cb) => setTimeout(() => cb({ uid:"test" }), 50);
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const collection = (db, ...p) => ({ path:p.join("/"), isCol:true });
export const doc = (db, ...p) => ({ path:p.join("/"), isCol:false });
export const deleteField = () => DEL;
export const getDoc = async ref => snapDoc(ref.path);
export const getDocs = async ref => snapCol(ref.path);
export function onSnapshot(ref, a, b){
  const cb = typeof a === "function" ? a : b;
  const s = { path:ref.path, isCol:ref.isCol, cb };
  subs.push(s);
  setTimeout(() => cb(ref.isCol ? snapCol(ref.path) : snapDoc(ref.path)), 30);
  return () => { const i = subs.indexOf(s); if(i >= 0) subs.splice(i, 1); };
}
export function setDoc(ref, data, opts){
  apply(ref.path, data, opts);
  if(window.__mock.offline){
    pendingPaths.add(ref.path);
    setTimeout(notify, 0);
    return new Promise(r => pendingWrites.push(r));
  }
  setTimeout(notify, 0);
  return new Promise(r => setTimeout(r, 120));
}
export async function runTransaction(db, fn){
  if(window.__mock.offline) throw new Error("offline");
  const sets = [];
  await fn({ get: async ref => snapDoc(ref.path), set: (ref, d, o) => sets.push([ref.path, d, o]) });
  for(const [p, d, o] of sets) apply(p, d, o);
  setTimeout(notify, 0);
}
