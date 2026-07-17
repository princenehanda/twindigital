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
      {id:'T1', product:'Diesel 50ppm', capacity:120000, level:0.81, temp:24.3, water:2},
      {id:'T2', product:'Diesel 50ppm', capacity:120000, level:0.64, temp:24.1, water:1},
      {id:'T3', product:'Petrol ULP93', capacity:90000, level:0.42, temp:23.8, water:0},
      {id:'T4', product:'Petrol ULP95', capacity:60000, level:0.91, temp:23.9, water:0},
      {id:'T5', product:'Paraffin', capacity:40000, level:0.28, temp:22.7, water:3},
    ],
    pumps:[
      {id:'P1', status:'dispensing'}, {id:'P2', status:'online'}, {id:'P3', status:'maintenance'}, {id:'P4', status:'online'},
    ],
  },
  {
    id:'DPT-BUQ', name:'Bulawayo Depot', code:'BUQ', city:'Bulawayo', region:'Matabeleland', latlng:[-20.1500, 28.5833],
    tanks:[
      {id:'T1', product:'Diesel 50ppm', capacity:100000, level:0.55, temp:25.0, water:1},
      {id:'T2', product:'Diesel 50ppm', capacity:100000, level:0.73, temp:24.8, water:1},
      {id:'T3', product:'Petrol ULP93', capacity:70000, level:0.37, temp:24.2, water:0},
      {id:'T4', product:'Paraffin', capacity:30000, level:0.66, temp:23.5, water:2},
    ],
    pumps:[ {id:'P1', status:'online'}, {id:'P2', status:'dispensing'} ],
  },
  {
    id:'DPT-MUT', name:'Mutare Border Depot', code:'MUT', city:'Mutare', region:'Manicaland', latlng:[-18.9707, 32.6709],
    tanks:[
      {id:'T1', product:'Diesel 50ppm', capacity:80000, level:0.22, temp:25.4, water:4},
      {id:'T2', product:'Petrol ULP93', capacity:60000, level:0.58, temp:24.9, water:0},
      {id:'T3', product:'Petrol ULP95', capacity:40000, level:0.47, temp:24.6, water:0},
    ],
    pumps:[ {id:'P1', status:'online'}, {id:'P2', status:'online'} ],
  },
];

/* ---------------- Routes (real waypoints, approximating the trunk
   road corridors between sites — not turn-by-turn road-snapped, but
   genuine geography rather than a stylized diagram) ---------------- */
const ROUTES = [
  { id:'R1', name:'Harare \u2192 Bulawayo', path:[[-17.8292,31.0522],[-18.3333,29.9167],[-18.9281,29.8149],[-19.4500,29.8167],[-20.1500,28.5833]] },
  { id:'R2', name:'Harare \u2192 Mutare',    path:[[-17.8292,31.0522],[-18.1853,31.5514],[-18.5333,32.1333],[-18.9707,32.6709]] },
  { id:'R3', name:'Harare \u2192 Beitbridge',path:[[-17.8292,31.0522],[-19.0167,30.9000],[-20.0637,30.8277],[-22.2167,30.0000]] },
  { id:'R4', name:'Bulawayo \u2192 Vic Falls',path:[[-20.1500,28.5833],[-18.3667,26.5000],[-17.9243,25.8572]] },
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
  return { totalStorage, totalCapacity, inTransit, deliveriesToday, fleetOnline, fleetTotal, lossPct, revenue, openAlerts, expected, actual };
}

function timeAgo(ts){
  const s = Math.floor((Date.now()-ts)/1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s/60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  return `${h}h ago`;
}

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
  return localStorage.getItem(ROLE_KEY) || 'exec';
}
function setRole(role){
  localStorage.setItem(ROLE_KEY, role);
  document.dispatchEvent(new CustomEvent('role-changed', { detail: { role } }));
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
  const stored = localStorage.getItem(DEPOT_SITE_KEY);
  return DEPOTS.some(d=>d.id===stored) ? stored : DEPOTS[0].id;
}
function setMyDepotId(id){
  localStorage.setItem(DEPOT_SITE_KEY, id);
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
  return localStorage.getItem(OPS_SCOPE_KEY) || 'national';
}
function setOpsScope(region){
  localStorage.setItem(OPS_SCOPE_KEY, region);
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
        tk.level = clamp(tk.level + rnd(-0.0015,0.0012), 0.05, 0.98);
        tk.temp = clamp(tk.temp + rnd(-0.05,0.05), 18, 32);
      }));
      if (Math.random() < 0.16){
        ALERTS.unshift(makeAlert());
        ALERTS.length = Math.min(ALERTS.length, 24);
      }
      this.listeners.forEach(fn=>fn());
    }, 2200);
  }
};
