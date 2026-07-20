/* =================================================================
   GRIPPX FUEL INTELLIGENCE — simulated data layer
   Everything here is synthetic demo data generated client-side.
   No real trucks, depots or customers are represented.
   ================================================================= */

const PRODUCTS = ['Diesel 50ppm', 'Petrol ULP93', 'Petrol ULP95', 'Paraffin'];

function rnd(min, max){ return Math.random() * (max - min) + min; }
function rint(min, max){ return Math.floor(rnd(min, max + 1)); }
function pick(arr){ return arr[rint(0, arr.length - 1)]; }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function fmtNum(n, dp=0){ return Number(n).toLocaleString('en-US', {minimumFractionDigits:dp, maximumFractionDigits:dp}); }

/* ---------------- Depots ---------------- */
const DEPOTS = [
  {
    id:'DPT-HRE', name:'Harare Depot', code:'HRE', city:'Harare', region:'Mashonaland', latlng:[-17.8292, 31.0522],
    tanks:[
      {id:'T1', product:'Diesel 50ppm', capacity:120000, level:0.81, temp:24.3, water:2, receiving:false},
      {id:'T2', product:'Diesel 50ppm', capacity:120000, level:0.64, temp:24.1, water:1, receiving:false},
      {id:'T3', product:'Petrol ULP93', capacity:90000, level:0.42, temp:23.8, water:0, receiving:true},
      {id:'T4', product:'Petrol ULP95', capacity:60000, level:0.91, temp:23.9, water:0, receiving:false},
      {id:'T5', product:'Paraffin', capacity:40000, level:0.28, temp:22.7, water:3, receiving:false},
    ],
    pumps:[
      {id:'P1', status:'dispensing', flowRate:210}, {id:'P2', status:'online', flowRate:0}, {id:'P3', status:'maintenance', flowRate:0}, {id:'P4', status:'online', flowRate:0},
    ],
  },
  {
    id:'DPT-BUQ', name:'Bulawayo Depot', code:'BUQ', city:'Bulawayo', region:'Matabeleland', latlng:[-20.1500, 28.5833],
    tanks:[
      {id:'T1', product:'Diesel 50ppm', capacity:100000, level:0.55, temp:25.0, water:1, receiving:false},
      {id:'T2', product:'Diesel 50ppm', capacity:100000, level:0.73, temp:24.8, water:1, receiving:false},
      {id:'T3', product:'Petrol ULP93', capacity:70000, level:0.37, temp:24.2, water:0, receiving:false},
      {id:'T4', product:'Paraffin', capacity:30000, level:0.66, temp:23.5, water:2, receiving:false},
    ],
    pumps:[ {id:'P1', status:'online', flowRate:0}, {id:'P2', status:'dispensing', flowRate:185} ],
  },
  {
    id:'DPT-MUT', name:'Mutare Border Depot', code:'MUT', city:'Mutare', region:'Manicaland', latlng:[-18.9707, 32.6709],
    tanks:[
      {id:'T1', product:'Diesel 50ppm', capacity:80000, level:0.22, temp:25.4, water:4, receiving:false},
      {id:'T2', product:'Petrol ULP93', capacity:60000, level:0.58, temp:24.9, water:0, receiving:false},
      {id:'T3', product:'Petrol ULP95', capacity:40000, level:0.47, temp:24.6, water:0, receiving:false},
    ],
    pumps:[ {id:'P1', status:'online', flowRate:0}, {id:'P2', status:'online', flowRate:0} ],
  },
];

/* ---------------- Routes (real waypoints, approximating the trunk
   road corridors between sites — not turn-by-turn road-snapped, but
   genuine geography rather than a stylized diagram) ---------------- */
const ROUTES = [
  { id:'R1', name:'Harare \u2192 Bulawayo', originDepotId:'DPT-HRE', hasBorder:false, borderName:null,
    path:[[-17.8292,31.0522],[-18.3333,29.9167],[-18.9281,29.8149],[-19.4500,29.8167],[-20.1500,28.5833]],
    waypointNames:['Harare Depot','Kadoma','Kwekwe','Gweru','Bulawayo'] },
  { id:'R2', name:'Harare \u2192 Mutare', originDepotId:'DPT-HRE', hasBorder:true, borderName:'Forbes Border Post',
    path:[[-17.8292,31.0522],[-18.1853,31.5514],[-18.5333,32.1333],[-18.9707,32.6709]],
    waypointNames:['Harare Depot','Marondera','Rusape','Mutare'] },
  { id:'R3', name:'Harare \u2192 Beitbridge', originDepotId:'DPT-HRE', hasBorder:true, borderName:'Beitbridge Border Post',
    path:[[-17.8292,31.0522],[-19.0167,30.9000],[-20.0637,30.8277],[-22.2167,30.0000]],
    waypointNames:['Harare Depot','Chivhu','Masvingo','Beitbridge'] },
  { id:'R4', name:'Bulawayo \u2192 Vic Falls', originDepotId:'DPT-BUQ', hasBorder:true, borderName:'Victoria Falls Border Post',
    path:[[-20.1500,28.5833],[-18.3667,26.5000],[-17.9243,25.8572]],
    waypointNames:['Bulawayo Depot','Hwange','Victoria Falls'] },
];

const DRIVER_NAMES = ['T. Moyo','J. Ncube','P. Chikwanha','S. Dube','F. Mangwana','R. Sibanda','L. Chirwa','B. Zulu','K. Muponda','A. Gumbo'];

/* ---------------- Trucks ---------------- */
function makeTruck(i){
  const route = pick(ROUTES);
  const compCount = rint(2,3);
  const compartments = Array.from({length:compCount}, (_,ci)=>({
    id:`C${ci+1}`, product: pick(PRODUCTS.slice(0,3)), capacity: pick([8000,10000,12000,15000]), level: rnd(0.35,0.99),
  }));
  const requestedLoad = compartments.reduce((s,c)=>s + c.capacity*rnd(0.9,1.0), 0);
  return {
    id:`TRK-${100+i}`,
    reg:`AEZ ${1000+i*7} `+ pick(['H','B','M']),
    driver: DRIVER_NAMES[i % DRIVER_NAMES.length],
    route,
    progress: rnd(0.02, 0.95),
    speed: rint(0,96),
    status: pick(['In transit','In transit','In transit','Loading','Delivering','Idle']),
    truckFuel: rnd(0.25,0.95),
    compartments,
    requestedLoad,
    loadedLoad: requestedLoad * rnd(0.985, 1.0),
    etaMin: rint(8, 240),
    deliveriesToday: rint(0,4),
    riskScore: rnd(0,1),
    idleMin: rint(0,40),
  };
}
const TRUCKS = Array.from({length: 12}, (_,i)=>makeTruck(i));

/* Each page load re-executes this script from scratch, which would
   normally reshuffle every truck's route/driver/cargo randomly. That
   breaks the premise of the Chain of Custody page \u2014 a shipment's
   story must stay the same whether you're looking at it from Fleet,
   Custody, or the truck detail page. This persists just the static
   identity fields for the browser session (closing the tab resets
   the demo); live/dynamic fields keep re-simulating fresh per load. */
const FLEET_IDENTITY_KEY = 'grippx-demo-fleet-identity';
(function syncFleetIdentity(){
  try {
    const saved = JSON.parse(sessionStorage.getItem(FLEET_IDENTITY_KEY) || 'null');
    if (saved && Array.isArray(saved) && saved.length === TRUCKS.length){
      TRUCKS.forEach((t,i)=>{
        const s = saved[i];
        if (!s) return;
        const route = ROUTES.find(r=>r.id===s.routeId);
        if (route) t.route = route;
        t.driver = s.driver;
        t.reg = s.reg;
        t.compartments = s.compartments;
        t.requestedLoad = s.requestedLoad;
        t.loadedLoad = s.loadedLoad;
      });
    } else {
      const identity = TRUCKS.map(t=>({
        routeId: t.route.id, driver: t.driver, reg: t.reg,
        compartments: t.compartments, requestedLoad: t.requestedLoad, loadedLoad: t.loadedLoad,
      }));
      sessionStorage.setItem(FLEET_IDENTITY_KEY, JSON.stringify(identity));
    }
  } catch(e){ /* sessionStorage unavailable (e.g. privacy mode) \u2014 fall back to fresh random each load */ }
})();

/* ---------------- Expected-vs-actual status helpers ----------------
   The point of a digital twin is comparing live state to an expected
   baseline, not just displaying a number. Every gauge in the UI runs
   through one of these so it always answers "what should I do?"
   ------------------------------------------------------------ */
function tankStatus(tank){
  if (tank.receiving){
    const remaining = Math.max(0.97 - tank.level, 0);
    const ticksToFull = remaining / 0.006;
    const etaMs = ticksToFull * 2200;
    const eta = new Date(Date.now() + etaMs);
    const etaStr = eta.toLocaleTimeString('en-ZA', {hour:'2-digit', minute:'2-digit', hour12:false});
    return { tag:'info', label:'Receiving product', action:`ETA full ${etaStr}` };
  }
  if (tank.water > 2) return { tag:'warn', label:'Water detected', action:'Schedule dip test' };
  if (tank.level < 0.25) return { tag:'warn', label:'Low stock', action:'Reorder recommended' };
  return { tag:'ok', label:'Stable', action:'No intervention required' };
}
function truckFuelExpected(t){
  return clamp(0.95 - t.progress*0.55, 0.05, 1);
}
function truckFuelStatus(t){
  const expected = truckFuelExpected(t);
  const variance = t.truckFuel - expected;
  let tag, label;
  if (variance < -0.08){ tag='crit'; label='Check required'; }
  else if (variance < -0.03){ tag='warn'; label='Above-average burn'; }
  else { tag='ok'; label='Normal'; }
  return { expected, variance, tag, label };
}

/* Nearest waypoint the truck has already passed, for a "last known
   checkpoint" field on the fleet cards \u2014 mirrors how a real ATG/
   telematics feed reports position between full GPS pings. */
function lastCheckpoint(t){
  const names = t.route.waypointNames;
  const segs = names.length - 1;
  const idx = clamp(Math.floor(t.progress * segs), 0, segs);
  return names[idx];
}

/* Seal & fuel-integrity status derived from live alerts rather than
   stored separately, so they can never drift out of sync with the
   alert feed that actually drives them. */
function truckSealStatus(t){
  const tampered = ALERTS.some(a=>a.entity===t.id && a.title==='Possible fuel theft');
  return tampered ? { tag:'crit', label:'Alert: possible tamper' } : { tag:'ok', label:'Secure' };
}
function truckIntegrityStatus(t){
  const flagged = ALERTS.some(a=>a.entity===t.id && (a.title==='Delivery shortfall' || a.title==='Loading discrepancy'));
  return flagged ? { tag:'warn', label:'Discrepancy flagged' } : { tag:'ok', label:'Verified' };
}
function cargoSummary(t){
  const products = [...new Set(t.compartments.map(c=>c.product))];
  const totalL = t.compartments.reduce((s,c)=>s+c.capacity*c.level,0);
  const label = products.length > 1 ? `mixed (${products.join(', ')})` : products[0];
  return `${fmtNum(totalL)} L ${label}`;
}

/* ---------------- Chain of custody ----------------
   Computed live from each truck's current state rather than stored
   as a frozen record, so the chain view updates in step with the
   fleet map and truck detail pages \u2014 same underlying twin, one
   more lens on it. An Idle truck is treated as having just closed
   out a full cycle, giving a complete end-to-end example. ------ */
function getCustodyChain(t){
  const originDepot = DEPOTS.find(d=>d.id===t.route.originDepotId);
  const destPoint = t.route.path[t.route.path.length-1];
  const destName = t.route.waypointNames[t.route.waypointNames.length-1];
  const borderIdx = Math.floor((t.route.path.length-1)/2);
  const borderPoint = t.route.hasBorder ? t.route.path[borderIdx] : null;
  const now = Date.now();

  const idle = t.status === 'Idle';
  const loading = t.status === 'Loading';
  const delivering = t.status === 'Delivering';
  const transit = t.status === 'In transit';

  const loadStatus = idle ? 'complete' : loading ? 'active' : 'complete';
  const transitStatus = idle ? 'complete' : loading ? 'pending' : transit ? 'active' : 'complete';
  let borderStatus = 'pending';
  if (t.route.hasBorder){
    if (idle) borderStatus = 'complete';
    else if (loading) borderStatus = 'pending';
    else if (transit) borderStatus = t.progress > 0.62 ? 'complete' : (t.progress > 0.4 ? 'active' : 'pending');
    else if (delivering) borderStatus = 'complete';
  }
  const customerStatus = idle ? 'complete' : delivering ? 'active' : 'pending';
  const invoiceStatus = idle ? 'complete' : 'pending';
  const reconStatus = idle ? 'complete' : 'pending';
  const primaryProduct = t.compartments[0].product;

  const steps = [
    { key:'supplier', label:'Supplier', status:'complete', time: now - 26*3600*1000,
      location:`Fuel terminal supplying ${originDepot.name}`, gps: originDepot.latlng,
      detail:`Manifest received \u2014 ${fmtNum(t.requestedLoad)} L ${primaryProduct}` },
    { key:'depot', label:'Depot', status:'complete', time: now - 20*3600*1000,
      location: originDepot.name, gps: originDepot.latlng,
      detail:`Received into storage \u2014 dip verified against supplier manifest` },
    { key:'loading', label:'Loading Bay', status: loadStatus, time: now - 5*3600*1000,
      location:`${originDepot.name} \u2014 Loading Bay`, gps: originDepot.latlng, driver: t.driver,
      detail: loadStatus==='pending' ? 'Awaiting loading slot'
        : loadStatus==='active' ? `Loading ${t.id} \u2014 ${fmtNum(t.loadedLoad)} L across ${t.compartments.length} compartments`
        : `Loaded ${t.id} \u2014 ${fmtNum(t.loadedLoad)} L across ${t.compartments.length} compartments`,
      signature: loadStatus!=='pending' ? `${t.driver} \u00b7 depot supervisor` : null },
    { key:'transit', label:'In Transit', status: transitStatus, time: now - 3*3600*1000,
      location: t.route.name, gps: pointOnRoute(t.route, t.progress), driver: t.driver,
      detail: transitStatus==='pending' ? 'Not yet dispatched' : `GPS-tracked \u00b7 seal intact \u00b7 ${Math.round(t.speed)} km/h \u00b7 last checkpoint ${lastCheckpoint(t)}` },
  ];
  if (t.route.hasBorder){
    steps.push({ key:'border', label:'Border Crossing', status: borderStatus, time: now - 1.5*3600*1000,
      location: t.route.borderName, gps: borderPoint,
      detail: borderStatus==='pending' ? 'Not yet reached'
        : borderStatus==='active' ? 'Customs clearance in progress \u2014 seal verified unbroken'
        : 'Cleared \u2014 seal verified unbroken' });
  }
  steps.push(
    { key:'customer', label:'Customer Delivery', status: customerStatus, time: now - 0.5*3600*1000,
      location:`Customer site near ${destName}`, gps: destPoint, driver: t.driver,
      detail: customerStatus==='pending' ? 'Delivery not yet started'
        : customerStatus==='active' ? 'Offloading in progress \u2014 e-POD pending'
        : 'Delivered \u2014 e-POD captured, signature on file',
      signature: customerStatus==='complete' ? 'Customer representative' : null },
    { key:'invoice', label:'Invoice', status: invoiceStatus, time: now - 0.2*3600*1000,
      location:'Finance system',
      detail: invoiceStatus==='pending' ? 'Awaiting delivery confirmation' : `Invoice raised for ${fmtNum(t.loadedLoad)} L delivered` },
    { key:'reconciliation', label:'Reconciliation', status: reconStatus, time: now,
      location:'Wetstock ledger',
      detail: reconStatus==='pending' ? 'Awaiting invoice' : 'Stock ledger reconciled \u2014 within tolerance' }
  );
  return { truck:t, steps };
}

/* ---------------- Alerts ---------------- */
const ALERT_TEMPLATES = [
  {type:'crit', title:'Possible fuel theft', tpl:(t)=>`Compartment valve opened on ${t.id} while stationary for 14 min \u2014 no delivery scheduled.`},
  {type:'crit', title:'Delivery shortfall', tpl:(t)=>`${t.id} delivered 2.6% below manifest volume at last stop.`},
  {type:'warn', title:'Tank water contamination', tpl:(t)=>`Water level trending upward on a Harare Depot diesel tank \u2014 above 2% threshold.`},
  {type:'warn', title:'Idle time exceeded', tpl:(t)=>`${t.id} idle for ${rint(20,45)} min outside of a scheduled stop.`},
  {type:'warn', title:'Loading discrepancy', tpl:(t)=>`Loaded volume on ${t.id} is ${rint(60,400)} L below requested load.`},
  {type:'info', title:'Reconciliation complete', tpl:(t)=>`Wetstock reconciliation for Bulawayo Depot closed within tolerance (\u00b10.3%).`},
  {type:'info', title:'Proof of delivery captured', tpl:(t)=>`${t.id} delivery confirmed with signature, GPS and timestamp.`},
  {type:'info', title:'Predictive maintenance', tpl:(t)=>`${t.id} fuel filter at ${rint(70,90)}% \u2014 service recommended within ${rint(3,10)} days.`},
];
function makeAlert(){
  const tmpl = pick(ALERT_TEMPLATES);
  const truck = pick(TRUCKS);
  return {
    id:'AL-'+Math.random().toString(36).slice(2,8),
    type: tmpl.type,
    title: tmpl.title,
    desc: tmpl.tpl(truck),
    entity: truck.id,
    time: Date.now() - rint(0, 1000*60*180),
  };
}
const ALERTS = Array.from({length:9}, makeAlert).sort((a,b)=>b.time-a.time);

/* ---------------- KPI aggregation ---------------- */
function computeKpis(){
  const totalStorage = DEPOTS.reduce((s,d)=> s + d.tanks.reduce((s2,t)=> s2 + t.capacity*t.level, 0), 0);
  const totalCapacity = DEPOTS.reduce((s,d)=> s + d.tanks.reduce((s2,t)=> s2 + t.capacity, 0), 0);
  const inTransit = TRUCKS.reduce((s,t)=> s + t.compartments.reduce((s2,c)=> s2 + c.capacity*c.level, 0), 0);
  const deliveriesToday = TRUCKS.reduce((s,t)=> s + t.deliveriesToday, 0) + 142;
  const fleetOnline = TRUCKS.filter(t=>t.status!=='Idle').length + 134;
  const fleetTotal = TRUCKS.length + 138;
  const expected = 452000, actual = 451612;
  const lossPct = ((expected-actual)/expected*100);
  const revenue = 1.34e6 + rnd(-4000,6000);
  const openAlerts = ALERTS.filter(a=>a.type!=='info').length;
  const criticalAlerts = ALERTS.filter(a=>a.type==='crit').length;
  return { totalStorage, totalCapacity, inTransit, deliveriesToday, fleetOnline, fleetTotal, lossPct, revenue, openAlerts, criticalAlerts, expected, actual };
}

function timeAgo(ts){
  const s = Math.floor((Date.now()-ts)/1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s/60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  return `${h}h ago`;
}

/* ---------------- Fail-safe storage wrapper ----------------
   Wraps localStorage so a partitioned/blocked storage environment
   (e.g. opening files directly via file://, some private-browsing
   modes) degrades to an in-memory store for the current page load
   instead of throwing or silently failing. This alone can't fix
   storage not persisting BETWEEN separate file:// pages (that's a
   browser-level restriction with no page-side workaround) — for
   that, always serve this over http(s), even a local static server,
   rather than double-clicking the HTML files. --------------------- */
const memoryStore = {};
const safeStorage = {
  get(key){ try { return localStorage.getItem(key); } catch(e){ return memoryStore[key] ?? null; } },
  set(key, val){ try { localStorage.setItem(key, val); } catch(e){ /* ignore */ } memoryStore[key] = val; },
  remove(key){ try { localStorage.removeItem(key); } catch(e){ /* ignore */ } delete memoryStore[key]; },
};

/* ---------------- Roles & access control ----------------
   A flat, everyone-sees-everything view doesn't reflect how a real
   fuel operation is run. Access here is genuinely tiered:
   - Executive:   strategic, read-only, sees financials, all sites
   - Operations:  full live control, all sites, no financials
   - Depot:       device-level actions, scoped to one site
   ------------------------------------------------------------ */
const ROLE_DEFS = {
  exec:  { label:'Executive',          short:'Exec',  desc:'Strategic read-only view across all sites, incl. financials' },
  ops:   { label:'Operations Manager', short:'Ops',   desc:'Live fleet & alert control across all sites' },
  depot: { label:'Depot Technician',   short:'Depot', desc:'Device-level control, scoped to depot operations' },
};
const ROLE_KEY = 'grippx-demo-role';

function getRole(){
  return safeStorage.get(ROLE_KEY) || 'exec';
}
function setRole(role){
  safeStorage.set(ROLE_KEY, role);
  document.dispatchEvent(new CustomEvent('role-changed', { detail: { role } }));
}

/* ---------------- Sign-in / persona layer ----------------
   The role switcher is genuinely useful for a sales demo (quickly
   preview every perspective), but on its own it leaves a real
   question unanswered: why does the platform open as Executive by
   default? Real software doesn't have that ambiguity because you
   sign in as yourself. This layer sits in front of the role system:
   picking a persona on login.html sets role + scope together and
   is what a first-time visitor is required to do before landing on
   any app page. The role switcher still works afterwards for
   quickly previewing other perspectives without signing out.

   Beyond the 3 built-in example personas, anyone can be enrolled
   from the login page itself (e.g. a named exec at a prospect) —
   those are stored alongside the built-ins, not hardcoded. -------- */
const PERSONA_KEY = 'grippx-demo-persona';
const CUSTOM_PERSONA_KEY = 'grippx-demo-custom-personas';
const BUILTIN_PERSONAS = [
  { id:'exec',  name:'Tendai Moyo',    title:'Chief Executive Officer', role:'exec', builtin:true,
    badge:'All sites \u00b7 strategic view', desc:'Fleet-wide KPIs, financials and critical alerts. Read-only \u2014 no operational controls.' },
  { id:'ops',   name:'Farai Ndlovu',   title:'Operations Manager', role:'ops', opsScope:'national', builtin:true,
    badge:'National \u00b7 live fleet control', desc:'Live map, full alert feed with acknowledge actions, no financials.' },
  { id:'depot', name:'Kudzai Chikafu', title:'Depot Technician', role:'depot', depotSite:'DPT-HRE', builtin:true,
    badge:'Harare Depot \u00b7 site operations', desc:'Scoped to one site \u2014 tank gauges, pump control, loading bay.' },
];
function getCustomPersonas(){
  try { return JSON.parse(safeStorage.get(CUSTOM_PERSONA_KEY) || '[]'); } catch(e){ return []; }
}
function saveCustomPersonas(list){
  safeStorage.set(CUSTOM_PERSONA_KEY, JSON.stringify(list));
}
function getAllPersonas(){
  return BUILTIN_PERSONAS.concat(getCustomPersonas());
}
function enrollPersona({ name, title, role, depotSite, opsScope }){
  const id = 'custom-' + Math.random().toString(36).slice(2,9);
  const persona = { id, name, title, role, depotSite, opsScope, builtin:false,
    badge: role==='depot' ? (DEPOTS.find(d=>d.id===depotSite)?.name || 'Depot') + ' \u00b7 site operations'
         : role==='ops' ? (opsScope && opsScope!=='national' ? `${opsScope} \u00b7 regional` : 'National \u00b7 live fleet control')
         : 'All sites \u00b7 strategic view',
    desc: 'Custom persona \u2014 added from the sign-in screen.' };
  const list = getCustomPersonas();
  list.push(persona);
  saveCustomPersonas(list);
  return persona;
}
function removeCustomPersona(id){
  saveCustomPersonas(getCustomPersonas().filter(p=>p.id!==id));
}
function hasChosenRole(){
  return safeStorage.get(ROLE_KEY) !== null;
}
function currentPersona(){
  const id = safeStorage.get(PERSONA_KEY);
  return getAllPersonas().find(p=>p.id===id) || null;
}
function loginAsPersona(personaId){
  const p = getAllPersonas().find(x=>x.id===personaId);
  if (!p) return;
  safeStorage.set(ROLE_KEY, p.role);
  safeStorage.set(PERSONA_KEY, p.id);
  if (p.role === 'depot' && p.depotSite) safeStorage.set(DEPOT_SITE_KEY, p.depotSite);
  if (p.role === 'ops' && p.opsScope) safeStorage.set(OPS_SCOPE_KEY, p.opsScope);
}
function signOut(){
  safeStorage.remove(ROLE_KEY);
  safeStorage.remove(PERSONA_KEY);
  safeStorage.remove(DEPOT_SITE_KEY);
  safeStorage.remove(OPS_SCOPE_KEY);
}
function roleAllowed(restrictAttr){
  if (!restrictAttr) return true;
  const allowed = restrictAttr.split(',').map(s=>s.trim());
  return allowed.includes(getRole());
}

/* ---------------- Depot site assignment ----------------
   A depot technician isn't scoped to "a role" in the abstract — in
   reality they're issued access to one physical site. This mirrors
   that: the Depot role always has a single assigned site attached.
   ------------------------------------------------------------ */
const DEPOT_SITE_KEY = 'grippx-demo-depot-site';
function getMyDepotId(){
  const stored = safeStorage.get(DEPOT_SITE_KEY);
  return DEPOTS.some(d=>d.id===stored) ? stored : DEPOTS[0].id;
}
function setMyDepotId(id){
  safeStorage.set(DEPOT_SITE_KEY, id);
  document.dispatchEvent(new CustomEvent('role-changed'));
}
function getMyDepot(){
  return DEPOTS.find(d=>d.id===getMyDepotId()) || DEPOTS[0];
}
function routeTouchesDepot(route, depot){
  return route.name.includes(depot.city);
}

/* ---------------- Ops regional scope ----------------
   Unlike Depot (always scoped to one physical site), an Operations
   Manager can legitimately be national (sees everything) or regional
   (oversees one corridor). Defaults to national. ------------------ */
const OPS_SCOPE_KEY = 'grippx-demo-ops-scope';
function getOpsScope(){
  return safeStorage.get(OPS_SCOPE_KEY) || 'national';
}
function setOpsScope(region){
  safeStorage.set(OPS_SCOPE_KEY, region);
  document.dispatchEvent(new CustomEvent('role-changed'));
}
function getRegions(){
  return [...new Set(DEPOTS.map(d=>d.region))];
}

/* Unified scope resolver used across dashboard/fleet rendering.
   Returns an array of depots the current role+scope is limited to,
   or null when unscoped (Executive always; Ops when set to National). */
function getScopedDepots(){
  const role = getRole();
  if (role === 'depot') return [getMyDepot()];
  if (role === 'ops'){
    const scope = getOpsScope();
    if (scope !== 'national') return DEPOTS.filter(d=>d.region===scope);
  }
  return null;
}
function getScopedTrucks(){
  const scoped = getScopedDepots();
  if (!scoped) return TRUCKS;
  return TRUCKS.filter(t=> scoped.some(d=>routeTouchesDepot(t.route,d)));
}

/* ---------------- Live actions (mutate the demo data) ---------------- */
function acknowledgeAlert(alertId){
  const idx = ALERTS.findIndex(a=>a.id===alertId);
  if (idx > -1) ALERTS.splice(idx, 1);
}
const PUMP_CYCLE = ['online','dispensing','maintenance'];
function togglePump(depotId, pumpId){
  const depot = DEPOTS.find(d=>d.id===depotId);
  if (!depot) return;
  const pump = depot.pumps.find(p=>p.id===pumpId);
  if (!pump) return;
  const i = PUMP_CYCLE.indexOf(pump.status);
  pump.status = PUMP_CYCLE[(i+1) % PUMP_CYCLE.length];
  pump.flowRate = pump.status === 'dispensing' ? rint(160, 240) : 0;
}

/* Valve states are derived, not stored independently \u2014 the inlet
   valve is only ever "open" because a tank is actually receiving,
   the outlet manifold only because a pump is actually dispensing.
   That coupling is the point: in a SCADA view the plumbing state
   must always agree with what the sensors are actually reporting. */
function depotValves(depot){
  const receiving = depot.tanks.some(t=>t.receiving);
  const dispensing = depot.pumps.some(p=>p.status==='dispensing');
  return [
    { id:'Inlet Valve',      open: receiving,  detail: receiving ? 'Open \u2014 product receiving in progress' : 'Closed \u2014 no inbound delivery' },
    { id:'Outlet Manifold',  open: dispensing, detail: dispensing ? 'Open \u2014 dispensing to loading bay' : 'Closed \u2014 no active dispensing' },
    { id:'Bypass Valve',     open: false,      detail: 'Closed \u2014 normal operating position' },
  ];
}

/* Physical alarm panel for one depot \u2014 tank and pump conditions
   that need floor-level attention, as distinct from the fleet-wide
   alerts feed (which is about trucks/deliveries, not depot hardware). */
function depotAlarms(depot){
  const alarms = [];
  depot.tanks.forEach(tk=>{
    const st = tankStatus(tk);
    if (st.tag !== 'ok' && st.tag !== 'info') alarms.push({ tag: st.tag, title: `${tk.id} \u2014 ${st.label}`, detail: st.action });
    if (tk.receiving && tk.level > 0.93) alarms.push({ tag:'warn', title: `${tk.id} \u2014 Approaching overfill threshold`, detail:'Automatic shutoff armed at 97% \u2014 overfill prevention active' });
  });
  depot.pumps.forEach(p=>{
    if (p.status === 'maintenance') alarms.push({ tag:'warn', title: `${p.id} \u2014 Maintenance mode`, detail:'Pump offline, service in progress' });
  });
  return alarms;
}
const LiveEngine = {
  listeners: [],
  on(fn){ this.listeners.push(fn); },
  start(){
    setInterval(()=>{
      TRUCKS.forEach(t=>{
        if (t.status === 'In transit'){
          t.progress = clamp(t.progress + rnd(0.002,0.01), 0, 1);
          t.speed = clamp(t.speed + rnd(-6,6), 0, 100);
          t.truckFuel = clamp(t.truckFuel - rnd(0.0005,0.002), 0.05, 1);
          t.etaMin = clamp(t.etaMin - rnd(0.2,0.6), 1, 400);
        } else if (t.status === 'Delivering'){
          t.compartments.forEach(c=> c.level = clamp(c.level - rnd(0,0.01), 0, 1));
        }
        t.idleMin = t.status === 'Idle' ? t.idleMin + rnd(0,0.5) : 0;
      });
      DEPOTS.forEach(d=> d.tanks.forEach(tk=>{
        if (!tk.receiving && Math.random() < 0.006) tk.receiving = true;
        if (tk.receiving && (tk.level > 0.96 || Math.random() < 0.02)) tk.receiving = false;
        if (tk.receiving){
          tk.level = clamp(tk.level + rnd(0.004, 0.008), 0.05, 0.98);
        } else {
          tk.level = clamp(tk.level + rnd(-0.0015,0.0012), 0.05, 0.98);
        }
        tk.temp = clamp(tk.temp + rnd(-0.05,0.05), 18, 32);
      }));
      DEPOTS.forEach(d=> d.pumps.forEach(p=>{
        if (p.status === 'dispensing') p.flowRate = clamp((p.flowRate||200) + rint(-12,12), 140, 260);
        else p.flowRate = 0;
      }));
      if (Math.random() < 0.16){
        ALERTS.unshift(makeAlert());
        ALERTS.length = Math.min(ALERTS.length, 24);
      }
      this.listeners.forEach(fn=>fn());
    }, 2200);
  }
};
