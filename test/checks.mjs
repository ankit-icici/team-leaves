// Headless logic checks. Run with: python3 test/run-checks.py
// The app's script is spliced in between the stubs below and the checks.

const store={}; globalThis.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},clear:()=>{for(const k in store)delete store[k]}};
const el=()=>({style:{},innerHTML:"",textContent:"",outerHTML:"",classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll:()=>[],focus(){},select(){}});
globalThis.document={getElementById:()=>el(),addEventListener(){},querySelector:()=>null,createElement:()=>el(),body:{appendChild(){},removeChild(){}},activeElement:null};
globalThis.window={addEventListener(){}}; globalThis.history={pushState(){},replaceState(){},back(){},go(){}};
globalThis.location={origin:"https://x",pathname:"/team-leaves/"};
const NAV={onLine:true}; Object.defineProperty(globalThis,"navigator",{value:NAV,configurable:true});
// firestore stubs
let snapCb=null, writes=[], tx=[];
const collection=(...a)=>({path:a.slice(1).join("/")}); const doc=(...a)=>({path:a.slice(1).join("/")});
const onSnapshot=(ref,a,b)=>{ const cb=typeof a==="function"?a:b; if(ref.path==="teams") snapCb=cb; return ()=>{}; };
let pend=[]; const setDoc=(ref,data)=>{ writes.push(ref.path); let r; const p=new Promise(x=>r=x); pend.push(r); return p; };
const runTransaction=async(db,fn)=>{ await fn({get:async ref=>({exists:()=>true,data:()=>({members:[{id:"me1",name:"Old"}]})}), set:(ref,d)=>tx.push([ref.path,d])}); };
const deleteField=()=>"DEL"; const getDocs=async()=>({forEach(){}}); const getDoc=async()=>({exists:()=>false});
const initializeApp=()=>{}, getAuth=()=>{}, signInAnonymously=async()=>{}, onAuthStateChanged=()=>{}, initializeFirestore=()=>{}, persistentLocalCache=()=>{}, persistentMultipleTabManager=()=>{};


/*__APP__*/

const ok=(c,m)=>{ if(!c){console.log("FAIL",m); process.exitCode=1;} else console.log("ok  ",m); };
const tick=()=>new Promise(r=>setTimeout(r,0));
let toasts=[]; toast=m=>toasts.push(m);
let opened=[]; const realOpen=openTeam; openTeam=id=>{opened.push(id); tid=id;};
render=()=>{}; renderStatus=()=>{};
const T=(id,name,mem,extra)=>({id,data:()=>Object.assign({name,members:mem.map(x=>({id:x,name:x}))},extra||{})});
db={};

// hidden teams
known=[{id:"tH",name:"Hid"},{id:"tA",name:"A"}]; phase="app"; tid="tA";
watchAllTeams(); snapCb({docs:[T("tA","A",["me1"]),T("tH","Hid",["me1"],{hidden:true}),T("tB","B",["x"])]});
ok(allTeams.map(t=>t.id).join()==="tA,tB","hidden team left out of the list");
ok(known.map(k=>k.id).join()==="tA","hidden team dropped from this phone");
ok(!loadLeft().includes("tH"),"hidden team not marked as left (comes back if un-hidden)");
// the team on screen gets hidden -> move to another known team
subs.all=null; known=[{id:"tA",name:"A"},{id:"tB",name:"B"}]; tid="tA"; opened=[];
watchAllTeams(); snapCb({docs:[T("tA","A",["me1"],{hidden:true}),T("tB","B",["x"])]});
ok(opened[0]==="tB","open team hidden -> moves to the next team");

// offline write: all teams queued at once, warning shown
subs.all=null; localStorage.clear(); known=[]; tid="tA"; meId="me1"; teamDoc={name:"A",leadId:"me1",members:[{id:"me1",name:"Me"}]};
allTeams=[{id:"tA",name:"A",members:[{id:"me1",name:"Me"}],size:1},{id:"tB",name:"B",members:[{id:"me1",name:"Me"}],size:1}];
localStorage.setItem("tl:meId","me1");
NAV.onLine=false; net.online=false; writes=[]; pend=[]; toasts=[];
const d1=new Date(); d1.setDate(d1.getDate()+3); const k1=key(d1); const d2=new Date(d1); d2.setDate(d2.getDate()+1); const k2=key(d2);
await writeLeaves([k1,k2], true);
ok(writes.length===2 && writes.some(w=>w.startsWith("teams/tA")) && writes.some(w=>w.startsWith("teams/tB")),"offline: both teams queued straight away ("+writes.length+")");
ok(unsynced===2 && net.pending,"offline: 2 changes counted as waiting");
ok(/saved on this phone/.test(toasts.join()),"offline: toast says saved on this phone");
ok(/2 changes waiting to sync/.test(syncWarningHTML()),"offline: warning card shows the count");
pend.forEach(r=>r()); await tick(); await tick(); await tick();
ok(unsynced===0 && !net.pending,"once sent: nothing waiting");
ok(syncWarningHTML()==="","once sent: warning gone");
// online fast path
NAV.onLine=true; net.online=true; writes=[]; pend=[]; toasts=[];
const p=writeLeaves([k1],false); await tick(); pend.forEach(r=>r()); await p;
ok(/Leave removed in all 2 of your teams/.test(toasts.join()),"online: normal toast");
// per-listener pending flag
setPending("year:2026",true); ok(net.pending,"listener pending sets flag"); setPending("year:2026",false); ok(!net.pending,"and clears");

// own name across teams; others blocked
tx=[]; teamDoc={name:"A",leadId:"lead",members:[{id:"me1",name:"Old"},{id:"o",name:"Other"}]};
ok(await renameMember("me1","New Name")===true && tx.length===2,"own name renamed in both teams");
ok(await renameMember("o","X")===false && /Only the team lead/.test(toasts.at(-1)),"non-lead can't rename others");

// confirmations
navStack=[]; let r1=askConfirm({title:"t",ok:"Go"}); ok(navStack.at(-1).s.type==="confirm","confirm sheet pushed");
navStack=[]; navApply(); ok(await r1===false,"leaving the sheet = no");
navStack=[]; let r2=askConfirm({title:"t"}); const rr=confirmAsk.resolve; confirmAsk.resolve=null; rr(true); ok(await r2===true,"button = yes");
ok(/data-act="cf-ok"/.test((navStack=[{screen:"sheet",s:{type:"confirm"}}], confirmAsk={title:"x",ok:"Do"}, confirmSheetHTML())),"sheet has a confirm button");

// Excel stretches
const st=stretches(["2026-11-05","2026-11-06","2026-11-07","2026-11-09","2026-12-31","2027-01-01"]);
ok(st.length===3 && st[0].days===3 && st[2].days===2,"stretches join consecutive days, across years");
ok(excelDate("2026-11-05")===46331,"Excel date serial correct");
// team list from v22 still right
known=[{id:"tB",name:"B"}]; allTeams=[{id:"tA",name:"A",members:[],size:0},{id:"tB",name:"B",members:[],size:0}];
const h=noTeamHTML(); ok(/data-act="team" data-id="tB">Open/.test(h)&&/data-act="join" data-id="tA"/.test(h),"team list: Open and join");
// colours
ok(personColor({color:"#F37E20"})==="#E3530F" && personColor({color:"#8A1538"})==="#94292E" && personColor({color:"#0F766E"})==="#0F766E","old avatar colours map to brand");

// v25: the team list shows the app version; the header name button is hidden there
known=[]; allTeams=[{id:"tA",name:"A",members:[],size:0}];
ok(new RegExp('class="ver">'+APP_VERSION).test(noTeamHTML()),"team list shows the version");
{ const b={style:{}}; const g=document.getElementById; document.getElementById=id=>id==="meBtn"?b:g(id);
  const realRT=renderTop; phase="pick"; teamDoc=null; meId=null;
  try{ realRT(); }catch(e){}
  ok(b.style.visibility==="hidden","name button hidden on the team list");
  // (shown inside a team: checked on the test copy, which runs with a configured app)
  document.getElementById=g; }

// v26 alerts
{ ok(alertsVisible()===ALERTS_FOR_ALL,"alerts screen follows ALERTS_FOR_ALL ("+ALERTS_FOR_ALL+")");
  localStorage.setItem("tl:alertsBeta","1"); ok(alertsVisible()===true,"alerts screen shown after #alerts");
  const p=alertPrefs(); ok(p.morning&&p.week&&p.leads,"all alerts on by default");
  saveAlertPrefs({morning:false}); const q=alertPrefs(); ok(!q.morning&&q.week&&q.leads,"a switched-off alert stays off, others default on");
  ok(/^d[a-z0-9]+$/.test(deviceId()) && deviceId()===deviceId(),"phone id made once and kept");
  ok(alertsState()==="unsupported","no notification support in this test -> 'unsupported'");
  const h=alertsSheetHTML(); ok(/can't show alerts/.test(h),"unsupported phone gets the right explanation");
  allTeams=[{id:"tA",name:"Alpha",leadId:"me1",members:[{id:"me1",name:"Me"}],size:1},{id:"tB",name:"Beta",leadId:"zz",members:[{id:"me1",name:"Me"}],size:1}];
  known=[]; localStorage.setItem("tl:meId","me1"); localStorage.setItem("tl:left","[]");
  ok(teamsILead().join()==="Alpha","lead alerts offered only for teams this person leads");
}

// v30: leads are asked to turn alerts on (pop-up once, then a card); others aren't
{ localStorage.setItem("tl:alertsBeta","1");
  allTeams=[{id:"tA",name:"Alpha",leadId:"me1",members:[{id:"me1",name:"Me"}],size:1},{id:"tB",name:"Beta",leadId:"zz",members:[{id:"me1",name:"Me"}],size:1}];
  known=[]; localStorage.setItem("tl:meId","me1"); localStorage.setItem("tl:left","[]"); meId="me1"; phase="app";
  const realState=alertsState; alertsState=()=>"off";
  ok(leadAlertsPending()===true,"a lead without alerts is asked");
  ok(/Get alerts on this phone/.test(alertAskSheetHTML()) && /New and cancelled leaves in Alpha/.test(alertAskSheetHTML()),"pop-up names the team they lead");
  localStorage.setItem("tl:alertAsked",""); ok(leadAlertCardHTML()==="","no card before the pop-up was shown");
  localStorage.setItem("tl:alertAsked","1"); ok(/Know when your team marks leave/.test(leadAlertCardHTML()),"card after 'Not now'");
  localStorage.setItem("tl:alertCardClosed","1"); ok(leadAlertCardHTML()==="","card gone after closing it");
  localStorage.setItem("tl:alertCardClosed","");
  alertsState=()=>"on"; ok(leadAlertCardHTML()==="" && !leadAlertsPending(),"nothing once alerts are on");
  alertsState=()=>"unsupported"; ok(!leadAlertsPending(),"not asked where the phone can't do alerts");
  alertsState=()=>"off"; allTeams[0].leadId="zz"; ok(!leadAlertsPending() && leadAlertCardHTML()==="","someone who leads no team is never asked");
  alertsState=realState; }

// v30 review fixes
{ localStorage.setItem("tl:alertsBeta","1"); allTeams[0].leadId="me1"; meId="me1"; phase="app";
  const realState=alertsState; alertsState=()=>"off";
  localStorage.setItem("tl:alertsOn","0"); ok(!leadAlertsPending(),"a lead who turned alerts off isn't asked or nagged");
  localStorage.setItem("tl:alertsOn",""); ok(leadAlertsPending(),"a lead who never answered is asked");
  localStorage.setItem("tl:alertAsked",""); let pushed=0; const realNav=navSheet; navSheet=()=>{pushed++;};
  const realST=globalThis.setTimeout; globalThis.setTimeout=f=>{ f(); return 0; };
  openSheet_={type:"manage"}; askingAlerts=false; maybeAskLeadAlerts(); ok(pushed===0 && localStorage.getItem("tl:alertAsked")!=="1","no pop-up over another open screen");
  openSheet_=null; rangeMode=true; askingAlerts=false; maybeAskLeadAlerts(); ok(pushed===0,"no pop-up during Select range");
  rangeMode=false; askingAlerts=false; maybeAskLeadAlerts(); ok(pushed===1 && localStorage.getItem("tl:alertAsked")==="1","pop-up once when the screen is free");
  askingAlerts=false; maybeAskLeadAlerts(); ok(pushed===1,"never a second pop-up");
  globalThis.setTimeout=realST; navSheet=realNav; alertsState=realState; }
