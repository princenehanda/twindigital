/* =================================================================
   GRIPPX FUEL INTELLIGENCE — app behaviour
   Renders whichever page-specific containers exist in the DOM.
   ================================================================= */

const roleAwareRenderers = [];

/* ------------------------------------------------------------------
   Centralized internal navigation. Every in-app link/click goes
   through this so the signed-in persona travels with it via a URL
   param — not just relying on localStorage, which can fail to share
   between separate pages in some environments (e.g. opening files
   directly via file:// in Safari). Without this, a signed-in
   Depot/Ops user could get bounced to login on every single click
   to another page, and — worse — land back on the dashboard instead
   of wherever they were actually trying to go.
   ------------------------------------------------------------------ */
function go(url){
  const persona = currentPersona();
  if (persona){
    const u = new URL(url, location.href);
    u.searchParams.set('persona', persona.id);
    window.location.href = u.toString();
  } else {
    window.location.href = url;
  }
}

function interceptInternalLinks(){
  document.addEventListener('click', (e)=>{
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || link.target === '_blank') return;
    if (!href.includes('.html')) return;
    const persona = currentPersona();
    if (!persona) return;
    e.preventDefault();
    const u = new URL(href, location.href);
    u.searchParams.set('persona', persona.id);
    window.location.href = u.toString();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // carry a persona choice via URL as a robust bridge into the first
  // app page after sign-in, independent of whether localStorage
  // happens to be shared between login.html and this page (it won't
  // be, for instance, if these files are opened directly via file://
  // rather than served over http/https)
  const incomingPersona = new URLSearchParams(location.search).get('persona');
  if (incomingPersona){
    loginAsPersona(incomingPersona);
    const url = new URL(location.href);
    url.searchParams.delete('persona');
    history.replaceState(null, '', url);
  }

  const isAppPage = document.body.classList.contains('app-body');
  if (isAppPage && !hasChosenRole()){
    const returnTo = location.pathname.split('/').pop() + location.search;
    window.location.href = 'login.html?return=' + encodeURIComponent(returnTo);
    return;
  }
  if (isAppPage) interceptInternalLinks();

  initClock();
  initMobileNav();
  markActiveNav();
  initRoleSwitcher();

  if (document.getElementById('kpi-grid'))      initDashboard();
  if (document.getElementById('fleet-table'))    initFleet();
  if (document.getElementById('truck-root'))     initTruck();
  if (document.getElementById('depot-root'))     initDepot();
  if (document.getElementById('custody-steps'))  initCustody();
  initPageGate();

  applyRoleGating();
  LiveEngine.start();

  document.addEventListener('role-changed', refreshRoleAwareUI);
});

function refreshRoleAwareUI(){
  roleAwareRenderers.forEach(fn=>fn());
  initPageGate();
  applyRoleGating();
}

/* ------------------------------------------------------------------
   Role switcher — injected into every page's topbar. Switching role
   re-runs the gating pass live, no reload, so the access model is
   visibly enforced rather than just described.
   ------------------------------------------------------------------ */
function initRoleSwitcher(){
  const mount = document.getElementById('role-switcher');
  if (!mount) return;
  function paint(){
    const current = getRole();
    const persona = currentPersona();

    let scopeLabel = '';
    if (current === 'depot'){
      scopeLabel = getMyDepot().name;
    } else if (current === 'ops'){
      const scope = getOpsScope();
      scopeLabel = scope === 'national' ? 'National' : `${scope} region`;
    } else {
      scopeLabel = 'All sites';
    }

    mount.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="pill" style="gap:8px;">
          <span class="dot" style="background:var(--sage);"></span>
          <span class="mono" style="font-size:11.5px;">
            ${persona ? `<strong style="color:var(--text);">${persona.name}</strong> \u00b7 ` : ''}${ROLE_DEFS[current]?.label || current} \u00b7 ${scopeLabel}
          </span>
        </div>
        <a href="#" id="sign-out-link" style="font-size:11px; color:var(--text-faint); white-space:nowrap;">Sign out</a>
      </div>`;
    const signOutLink = document.getElementById('sign-out-link');
    if (signOutLink) signOutLink.addEventListener('click', (e)=>{ e.preventDefault(); signOut(); window.location.href = 'login.html'; });
  }
  paint();
  document.addEventListener('role-changed', paint);
}

/* ------------------------------------------------------------------
   Applies data-restrict / data-restrict-action gating to whatever is
   currently in the DOM. Safe to call repeatedly after re-renders.
   ------------------------------------------------------------------ */
function applyRoleGating(){
  document.querySelectorAll('[data-restrict]').forEach(el=>{
    const ok = roleAllowed(el.getAttribute('data-restrict'));
    el.classList.toggle('locked-block', !ok);
    if (!ok && !el.querySelector('.lock-overlay')){
      const label = el.getAttribute('data-restrict-label') || restrictLabel(el.getAttribute('data-restrict'));
      const overlay = document.createElement('div');
      overlay.className = 'lock-overlay';
      overlay.innerHTML = `<div class="lock-icon">\uD83D\uDD12</div><strong>Restricted</strong><span>${label}</span>`;
      el.appendChild(overlay);
    }
    if (ok){ const o = el.querySelector('.lock-overlay'); if (o) o.remove(); }
  });
  document.querySelectorAll('[data-restrict-action]').forEach(el=>{
    const ok = roleAllowed(el.getAttribute('data-restrict-action'));
    el.classList.toggle('locked-action', !ok);
    el.disabled = !ok;
  });
}
function restrictLabel(attr){
  const roles = attr.split(',').map(k=>ROLE_DEFS[k.trim()]?.label || k).join(' or ');
  return `Requires ${roles} access`;
}

/* ------------------------------------------------------------------
   Whole-page gating (used on Integrations, which is ops/exec scope)
   ------------------------------------------------------------------ */
function initPageGate(){
  const gate = document.querySelector('[data-page-restrict]');
  if (!gate) return;
  const existing = document.getElementById('page-gate-overlay');
  if (existing) existing.remove();
  const ok = roleAllowed(gate.getAttribute('data-page-restrict'));
  gate.classList.toggle('page-gate', true);
  if (!ok){
    const label = restrictLabel(gate.getAttribute('data-page-restrict'));
    const overlay = document.createElement('div');
    overlay.id = 'page-gate-overlay';
    overlay.className = 'page-gate-overlay';
    overlay.innerHTML = `
      <div class="page-gate-card">
        <div class="lock-icon">\uD83D\uDD12</div>
        <h3>Restricted for this role</h3>
        <p>${label}. Switch roles above to preview this section as it would appear for that access level.</p>
      </div>`;
    gate.appendChild(overlay);
  }
}

function initClock(){
  const el = document.querySelectorAll('.js-clock');
  if (!el.length) return;
  function tick(){
    const now = new Date();
    const str = now.toLocaleString('en-ZA', { weekday:'short', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
    el.forEach(e => e.textContent = str);
  }
  tick(); setInterval(tick, 1000);
}

function initMobileNav(){
  const btn = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav-links');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    const open = nav.style.display === 'flex';
    nav.style.display = open ? 'none' : 'flex';
    nav.style.cssText += 'position:absolute; top:60px; left:0; right:0; background:#0C0F12; flex-direction:column; padding:10px 18px; border-bottom:1px solid var(--line); z-index:60;';
  });
}

function markActiveNav(){
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('a[data-nav]').forEach(a=>{
    if (a.getAttribute('data-nav') === path) a.classList.add('active');
  });
}

/* ------------------------------------------------------------------
   Real map: interpolate a truck's [lat,lng] position along its route
   ------------------------------------------------------------------ */
function pointOnRoute(route, progress){
  const pts = route.path;
  const segs = pts.length - 1;
  const scaled = clamp(progress,0,1) * segs;
  const i = Math.min(Math.floor(scaled), segs - 1);
  const t = scaled - i;
  const a = pts[i], b = pts[i+1];
  return [ a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t ];
}

function statusTag(status){
  const map = { 'In transit':'info', 'Delivering':'ok', 'Loading':'warn', 'Idle':'', };
  return `<span class="tag ${map[status]||''}">${status}</span>`;
}
function riskTag(score){
  if (score > 0.75) return `<span class="tag crit">High risk</span>`;
  if (score > 0.45) return `<span class="tag warn">Elevated</span>`;
  return `<span class="tag ok">Normal</span>`;
}
function alertIconChar(type){ return type==='crit' ? '\u2715' : type==='warn' ? '!' : '\u2713'; }

/* ==================================================================
   DASHBOARD
   ================================================================== */
function initDashboard(){
  renderKpis();
  initLeafletMap();
  updateMapScope();
  renderTankfarmMini();
  renderAlerts('alerts-feed', 6);
  renderFleetSnapshot();
  renderLossBar();

  LiveEngine.on(()=>{
    renderKpis();
    updateMapPositions();
    renderTankfarmMini();
    renderAlerts('alerts-feed', 6);
    renderFleetSnapshot();
  });
  roleAwareRenderers.push(renderKpis, renderAlerts.bind(null,'alerts-feed',6), refreshMapTooltips, renderTankfarmMini, renderFleetSnapshot, updateMapScope);
}

function renderKpis(){
  const el = document.getElementById('kpi-grid');
  const k = computeKpis();
  const role = getRole();
  const isDepot = role === 'depot';
  const scopedDepots = getScopedDepots();          // null = unscoped (Exec, or Ops/National)
  const scopedTrucks = getScopedTrucks();
  const scopeTag = scopedDepots ? (scopedDepots.length===1 ? scopedDepots[0].code : (getOpsScope()||'').toUpperCase()) : null;

  const storageVal = scopedDepots ? scopedDepots.reduce((s,d)=>s+d.tanks.reduce((s2,t)=>s2+t.capacity*t.level,0),0) : k.totalStorage;
  const storageCap = scopedDepots ? scopedDepots.reduce((s,d)=>s+d.tanks.reduce((s2,t)=>s2+t.capacity,0),0) : k.totalCapacity;
  const transitVal = scopedDepots ? scopedTrucks.reduce((s,t)=>s+t.compartments.reduce((s2,c)=>s2+c.capacity*c.level,0),0) : k.inTransit;
  const fleetOnlineScoped = scopedDepots ? scopedTrucks.filter(t=>t.status!=='Idle').length : k.fleetOnline;
  const fleetTotalScoped = scopedDepots ? scopedTrucks.length : k.fleetTotal;
  const deliveriesScoped = scopedDepots ? scopedTrucks.reduce((s,t)=>s+t.deliveriesToday,0) : k.deliveriesToday;
  const criticalScoped = scopedDepots
    ? ALERTS.filter(a=>a.type==='crit' && scopedTrucks.some(t=>t.id===a.entity)).length
    : k.criticalAlerts;

  // Depot loses these categorically (not their job); Ops-regional just
  // sees them narrowed to the region instead of losing them.
  const depotOnlyLock = isDepot ? 'exec,ops' : null;

  const items = [
    { label: scopeTag ? `Fuel in storage \u2014 ${scopeTag}` : 'Fuel in storage', val:fmtNum(storageVal/1000,2), unit:'ML', delta:`${storageCap? fmtNum(storageVal/storageCap*100,0):0}% of capacity`, cls:'flat', href: scopedDepots ? `depot.html?id=${scopedDepots[0].id}` : 'depot.html' },
    { label: scopeTag ? `Fuel in transit \u2014 ${scopeTag}` : 'Fuel in transit', val:fmtNum(transitVal/1000,2), unit:'ML', delta: scopedDepots ? `${scopedTrucks.length} tankers in region` : `${TRUCKS.length + 138} tankers loaded`, cls:'flat', href:'fleet.html', restrict: depotOnlyLock },
    { label: scopeTag ? `Deliveries today \u2014 ${scopeTag}` : 'Deliveries today', val:fmtNum(deliveriesScoped), unit:'', delta: scopedDepots ? 'this region' : '+ 12 vs. yesterday', cls:'up', href:'fleet.html?status=Delivering', restrict: depotOnlyLock },
    { label: scopeTag ? `Fleet available \u2014 ${scopeTag}` : 'Fleet available', val:`${fleetOnlineScoped}/${fleetTotalScoped}`, unit:'', delta: scopedDepots ? 'in region' : `${k.fleetTotal-k.fleetOnline} offline / maintenance`, cls:'flat', href:'fleet.html', restrict: depotOnlyLock },
    { label:'Stock variance', val:k.lossPct.toFixed(2), unit:'%', delta: scopedDepots ? 'fleet-wide, consolidated' : 'within 0.30% tolerance', cls:'up', href:'#loss-bar', restrict: depotOnlyLock },
    { label:'Revenue (24h)', val:'$'+fmtNum(k.revenue/1000,0), unit:'k', delta:'+3.1% week on week', cls:'up', restrict:'exec' },
    { label: scopeTag ? `Critical alerts \u2014 ${scopeTag}` : 'Critical alerts', val:criticalScoped, unit:'', delta: criticalScoped>0? 'needs attention':'nominal', cls:criticalScoped>0?'down':'flat', href:'#alerts-feed' },
  ];
  el.innerHTML = items.map(i=>`
    <div class="kpi ${i.href?'kpi-link':''}" ${i.href?`onclick="go('${i.href}')"`:''} ${i.restrict?`data-restrict="${i.restrict}"`:''}>
      <div class="eyebrow">${i.label}</div>
      <div class="val">${i.val}<span class="unit">${i.unit}</span></div>
      <div class="delta ${i.cls}">${i.delta}</div>
    </div>`).join('');
}

function renderLossBar(){
  const el = document.getElementById('loss-bar');
  if (!el) return;
  const k = computeKpis();
  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:12px; color:var(--text-dim); margin-bottom:8px;">
      <span>Expected: ${fmtNum(k.expected)} L</span>
      <span>Actual: ${fmtNum(k.actual)} L</span>
      <span style="color:var(--sage)">Variance: ${fmtNum(k.expected-k.actual)} L (${k.lossPct.toFixed(2)}%)</span>
    </div>
    <div class="progress"><span style="width:${(k.actual/k.expected*100).toFixed(2)}%; background:var(--sage);"></span></div>`;
}

/* ------------------------------------------------------------------
   Real map (Leaflet + CARTO dark basemap, no API key required).
   Route lines are genuine trunk-road corridors between real
   coordinates — not turn-by-turn road-snapped, but real geography.
   ------------------------------------------------------------------ */
let leafletMap = null;
const truckMarkers = {};
const depotMarkers = {};

function truckColor(t){
  return t.riskScore > 0.75 ? '#E5555B' : t.status === 'Delivering' ? '#6FBE8F' : '#E8A23D';
}
function truckDivIcon(t){
  return L.divIcon({
    className: 'truck-marker-wrap',
    html: `<span class="truck-pin" style="background:${truckColor(t)}"></span>`,
    iconSize: [16,16], iconAnchor: [8,8],
  });
}
function truckTooltipHtml(t){
  const driverLine = roleAllowed('ops,depot') ? ` \u00b7 driver ${t.driver}` : '';
  return `<strong>${t.id}</strong> \u2014 ${t.route.name}<br><span class="mono" style="color:var(--text-faint); font-size:11px;">${t.status} \u00b7 ${Math.round(t.speed)} km/h${driverLine}</span>`;
}

function initLeafletMap(){
  const mapEl = document.getElementById('map');
  if (!mapEl || typeof L === 'undefined') return;

  leafletMap = L.map('map', { scrollWheelZoom:false, attributionControl:true }).setView([-19.2, 29.6], 6);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd', maxZoom: 18,
  }).addTo(leafletMap);

  ROUTES.forEach(r=>{
    L.polyline(r.path, { color:'#5A7091', weight:2.5, opacity:0.7, dashArray:'1 7', lineCap:'round' }).addTo(leafletMap);
  });

  DEPOTS.forEach(d=>{
    const icon = L.divIcon({
      className:'depot-marker-wrap',
      html:`<span class="depot-pin"><span class="depot-pin-code">${d.code}</span></span>`,
      iconSize:[36,36], iconAnchor:[18,18],
    });
    const m = L.marker(d.latlng, { icon, zIndexOffset:500 }).addTo(leafletMap);
    m.bindTooltip(`<strong>${d.name}</strong><br><span class="mono" style="font-size:11px; color:var(--text-faint);">${d.tanks.length} tanks \u00b7 ${d.pumps.length} pumps</span>`, { direction:'top', offset:[0,-16] });
    m.on('click', ()=>{ go(`depot.html?id=${d.id}`); });
    depotMarkers[d.id] = m;
  });

  TRUCKS.forEach(t=>{
    const p = pointOnRoute(t.route, t.progress);
    const m = L.marker(p, { icon: truckDivIcon(t) }).addTo(leafletMap);
    m.on('click', ()=>{ go(`truck.html?id=${t.id}`); });
    m.on('mouseover', ()=> m.bindTooltip(truckTooltipHtml(t), { direction:'top', offset:[0,-10] }).openTooltip());
    truckMarkers[t.id] = m;
  });
}

function updateMapPositions(){
  if (!leafletMap) return;
  TRUCKS.forEach(t=>{
    const m = truckMarkers[t.id];
    if (!m) return;
    m.setLatLng(pointOnRoute(t.route, t.progress));
    m.setIcon(truckDivIcon(t));
  });
}
function refreshMapTooltips(){
  // tooltip content (driver name) is regenerated on hover, so a role
  // change just needs no stale bound tooltip left open
  if (!leafletMap) return;
  Object.values(truckMarkers).forEach(m=> m.closeTooltip());
}
function updateMapScope(){
  if (!leafletMap) return;
  const scopedDepots = getScopedDepots();
  TRUCKS.forEach(t=>{
    const m = truckMarkers[t.id];
    if (!m) return;
    const inScope = !scopedDepots || scopedDepots.some(d=>routeTouchesDepot(t.route, d));
    const onMap = leafletMap.hasLayer(m);
    if (inScope && !onMap) m.addTo(leafletMap);
    if (!inScope && onMap) leafletMap.removeLayer(m);
  });
  if (scopedDepots && scopedDepots.length){
    if (scopedDepots.length === 1) leafletMap.setView(scopedDepots[0].latlng, 8);
    else leafletMap.fitBounds(scopedDepots.map(d=>d.latlng), { padding:[40,40] });
  } else {
    leafletMap.setView([-19.2, 29.6], 6);
  }
}

function renderTankfarmMini(){
  const el = document.getElementById('tankfarm-mini');
  if (!el) return;
  const list = getScopedDepots() || DEPOTS;
  el.innerHTML = list.map(d=>`
    <div class="card card-link" style="padding:16px;" onclick="go('depot.html?id=${d.id}')">
      <div class="panel-title" style="margin-bottom:12px;">
        <div>
          <h3 style="font-size:13.5px;">${d.name}</h3>
          <div class="eyebrow">${d.tanks.length} tanks \u00b7 ${d.pumps.length} pumps</div>
        </div>
        <span class="btn btn-ghost btn-sm">Open \u2192</span>
      </div>
      <div style="display:flex; gap:14px; overflow-x:auto; padding-bottom:4px;">
        ${d.tanks.map(tk=>tankGaugeHtml(tk)).join('')}
      </div>
    </div>`).join('');
}

function tankGaugeHtml(tk){
  const pct = Math.round(tk.level*100);
  const low = pct < 25;
  const st = tankStatus(tk);
  return `<div class="tank" style="flex:none; width:108px;">
    <div class="tank-body">
      <div class="tank-fill" style="height:${pct}%; ${low?'background:linear-gradient(180deg, var(--red), var(--red-dim));':''}"></div>
    </div>
    <div class="pct" style="${low?'color:var(--red)':''}">${pct}%</div>
    <div class="label">${tk.id} \u00b7 ${tk.product.split(' ')[0]}</div>
    <div class="meta">${fmtNum(tk.capacity*tk.level/1000,1)} kL</div>
    <span class="tag ${st.tag}" style="margin-top:6px;">${st.label}</span>
    <div class="meta" style="margin-top:2px; color:var(--text-dim);">${st.action}</div>
  </div>`;
}

function renderAlerts(targetId, limit){
  const el = document.getElementById(targetId);
  if (!el) return;
  const scopedDepots = getScopedDepots();
  const pool = scopedDepots
    ? ALERTS.filter(a=>{
        const truck = TRUCKS.find(t=>t.id===a.entity);
        return truck && scopedDepots.some(d=>routeTouchesDepot(truck.route, d));
      })
    : ALERTS;
  const list = pool.slice(0, limit || pool.length);
  el.innerHTML = list.length ? list.map(a=>`
    <div class="alert-row card-link" style="cursor:pointer;" onclick="if(!event.target.closest('.alert-ack-btn')) go('truck.html?id=${a.entity}')">
      <div class="alert-icon ${a.type}">${alertIconChar(a.type)}</div>
      <div class="body">
        <div class="head">
          <strong>${a.title}</strong>
          <span style="display:flex; align-items:center; gap:8px; flex:none;">
            <span class="time mono">${timeAgo(a.time)}</span>
            <button type="button" class="alert-ack-btn" data-restrict-action="ops,depot" onclick="event.stopPropagation(); acknowledgeAlert('${a.id}'); refreshRoleAwareUI();">Acknowledge</button>
          </span>
        </div>
        <div class="desc">${a.desc}</div>
      </div>
    </div>`).join('') : `<div style="color:var(--text-faint); font-size:13px; padding:16px 0;">No open alerts${scopedDepots?' in scope':''}.</div>`;
  applyRoleGating();
}

function renderFleetSnapshot(){
  const el = document.getElementById('fleet-snapshot');
  if (!el) return;
  const scopedDepots = getScopedDepots();
  const pool = getScopedTrucks();
  const rows = [...pool].sort((a,b)=>b.riskScore-a.riskScore).slice(0,6);
  const heading = document.getElementById('fleet-snapshot-scope');
  if (heading){
    heading.textContent = scopedDepots
      ? `Routed through ${scopedDepots.map(d=>d.name).join(', ')}`
      : 'Ranked by operational risk index';
  }
  el.innerHTML = (rows.length ? `<table class="data-table">
    <thead><tr><th>Vehicle</th><th>Route</th><th>Status</th><th>Truck fuel</th><th>Risk</th></tr></thead>
    <tbody>${rows.map(t=>`
      <tr class="clickable" onclick="go('truck.html?id=${t.id}')">
        <td><strong>${t.id}</strong><br><span class="mono" style="color:var(--text-faint); font-size:11px;">${t.reg}</span></td>
        <td>${t.route.name}</td>
        <td>${statusTag(t.status)}</td>
        <td class="mono">${Math.round(t.truckFuel*100)}%</td>
        <td>${riskTag(t.riskScore)}</td>
      </tr>`).join('')}</tbody></table>`
    : `<div style="color:var(--text-faint); font-size:13px; padding:16px 0;">No tankers currently routed through this site.</div>`);
}

/* ==================================================================
   FLEET PAGE
   ================================================================== */
function initFleet(){
  const params = new URLSearchParams(location.search);
  const statusParam = params.get('status');
  if (statusParam){
    const sel = document.getElementById('fleet-filter-status');
    if (sel && [...sel.options].some(o=>o.value===statusParam)) sel.value = statusParam;
  }
  renderFleetView();
  const search = document.getElementById('fleet-search');
  if (search) search.addEventListener('input', renderFleetView);
  const filterStatus = document.getElementById('fleet-filter-status');
  if (filterStatus) filterStatus.addEventListener('change', renderFleetView);
  LiveEngine.on(renderFleetView);
  roleAwareRenderers.push(renderFleetView);

  const cardsBtn = document.getElementById('view-cards-btn');
  const tableBtn = document.getElementById('view-table-btn');
  const cardsEl = document.getElementById('fleet-cards');
  const tableEl = document.getElementById('fleet-table-wrap');
  if (cardsBtn && tableBtn){
    cardsBtn.addEventListener('click', ()=>{
      cardsBtn.classList.add('active'); tableBtn.classList.remove('active');
      cardsEl.style.display = ''; tableEl.style.display = 'none';
    });
    tableBtn.addEventListener('click', ()=>{
      tableBtn.classList.add('active'); cardsBtn.classList.remove('active');
      tableEl.style.display = ''; cardsEl.style.display = 'none';
    });
  }
}

function renderFleetView(){
  const cardsEl = document.getElementById('fleet-cards');
  const tbody = document.querySelector('#fleet-table tbody');
  if (!cardsEl && !tbody) return;
  const q = (document.getElementById('fleet-search')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('fleet-filter-status')?.value || 'all';
  const scopedDepots = getScopedDepots();

  const scopeNote = document.getElementById('fleet-scope-note');
  if (scopeNote){
    scopeNote.style.display = scopedDepots ? 'flex' : 'none';
    if (scopedDepots) scopeNote.querySelector('strong').textContent = scopedDepots.map(d=>d.name).join(', ');
  }

  const rows = TRUCKS.filter(t=>{
    const matchesQ = !q || t.id.toLowerCase().includes(q) || t.driver.toLowerCase().includes(q) || t.route.name.toLowerCase().includes(q);
    const matchesS = statusFilter==='all' || t.status===statusFilter;
    const matchesSite = !scopedDepots || scopedDepots.some(d=>routeTouchesDepot(t.route, d));
    return matchesQ && matchesS && matchesSite;
  });

  document.getElementById('fleet-count').textContent = `${rows.length} of ${TRUCKS.length} demo vehicles`;

  if (cardsEl) cardsEl.innerHTML = rows.map(t=>fleetCardHtml(t)).join('') || `<div style="grid-column:1/-1; text-align:center; color:var(--text-faint); padding:32px;">No vehicles match this filter.</div>`;
  if (tbody) tbody.innerHTML = rows.map(t=>fleetRowHtml(t)).join('') || `<tr><td colspan="9" style="text-align:center; color:var(--text-faint); padding:32px;">No vehicles match this filter.</td></tr>`;
}

function fleetCardHtml(t){
  const seal = truckSealStatus(t);
  const integrity = truckIntegrityStatus(t);
  const driverLine = roleAllowed('ops,depot') ? t.driver : '\u2014 collated \u2014';
  return `<div class="card fleet-card card-link" onclick="go('truck.html?id=${t.id}')">
    <div class="fc-head">
      <div><div class="fc-id">${t.id}</div><div class="mono fc-reg">${t.reg}</div></div>
      ${statusTag(t.status)}
    </div>
    <div class="fc-route">${t.route.name}${t.route.hasBorder ? ` \u00b7 via ${t.route.borderName}`:''}</div>
    <div class="fc-row"><span class="k">Driver</span><span class="v">${driverLine}</span></div>
    <div class="fc-row"><span class="k">Cargo</span><span class="v">${cargoSummary(t)}</span></div>
    <div class="fc-row"><span class="k">Compartments</span><span class="v">${t.compartments.length}</span></div>
    <div class="fc-row"><span class="k">Seal status</span><span class="v"><span class="tag ${seal.tag}">${seal.label}</span></span></div>
    <div class="fc-row"><span class="k">Fuel integrity</span><span class="v"><span class="tag ${integrity.tag}">${integrity.label}</span></span></div>
    <div class="fc-row"><span class="k">ETA</span><span class="v mono">${Math.round(t.etaMin)} min</span></div>
    <div class="fc-row"><span class="k">Last checkpoint</span><span class="v">${lastCheckpoint(t)}</span></div>
    <div class="fc-foot"><span class="eyebrow">Risk</span>${riskTag(t.riskScore)}</div>
  </div>`;
}

function fleetRowHtml(t){
  const loadPct = Math.round((t.compartments.reduce((s,c)=>s+c.capacity*c.level,0) / t.compartments.reduce((s,c)=>s+c.capacity,0))*100);
  const driverCell = roleAllowed('ops,depot')
    ? `<span class="avatar">${t.driver.split(' ').map(s=>s[0]).join('')}</span>${t.driver}`
    : `<span class="mono" style="color:var(--text-faint); font-size:11.5px;">\u2014 collated \u2014</span>`;
  return `<tr class="clickable" onclick="go('truck.html?id=${t.id}')">
      <td><strong>${t.id}</strong><br><span class="mono" style="color:var(--text-faint); font-size:11px;">${t.reg}</span></td>
      <td class="badge-driver">${driverCell}</td>
      <td>${t.route.name}</td>
      <td>${statusTag(t.status)}</td>
      <td class="mono">${Math.round(t.speed)} km/h</td>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="progress" style="width:60px;"><span style="width:${loadPct}%"></span></div>
          <span class="mono" style="font-size:11.5px; color:var(--text-dim);">${loadPct}%</span>
        </div>
      </td>
      <td class="mono">${Math.round(t.truckFuel*100)}%</td>
      <td class="mono">${Math.round(t.etaMin)} min</td>
      <td>${riskTag(t.riskScore)}</td>
    </tr>`;
}

/* ==================================================================
   TRUCK DETAIL PAGE
   ================================================================== */
function currentTruck(){
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  return TRUCKS.find(t=>t.id===id) || TRUCKS[0];
}

function initTruck(){
  const t = currentTruck();
  renderTruckHeader(t);
  renderTruckCompartments(t);
  renderTruckMeta(t);
  renderTruckFuelHistory(t);
  renderTruckFuelStatus(t);
  renderTruckAlerts(t);
  renderTruckSwitcher(t);

  LiveEngine.on(()=>{
    renderTruckHeader(t);
    renderTruckCompartments(t);
    renderTruckMeta(t);
    renderTruckFuelStatus(t);
  });
  roleAwareRenderers.push(()=>renderTruckAlerts(t));
}

function renderTruckSwitcher(current){
  const el = document.getElementById('truck-switcher');
  if (!el) return;
  el.innerHTML = TRUCKS.map(t=>`<option value="${t.id}" ${t.id===current.id?'selected':''}>${t.id} \u2014 ${t.route.name}</option>`).join('');
  el.addEventListener('change', ()=>{ go(`truck.html?id=${el.value}`); });
}

function renderTruckHeader(t){
  document.getElementById('truck-title').textContent = t.id;
  document.getElementById('truck-reg').textContent = t.reg;
  document.getElementById('truck-status-tag').outerHTML = statusTag(t.status).replace('<span', '<span id="truck-status-tag"');
  document.getElementById('truck-risk-tag').outerHTML = riskTag(t.riskScore).replace('<span', '<span id="truck-risk-tag"');
}

function renderTruckMeta(t){
  const el = document.getElementById('truck-meta-grid');
  const items = [
    ['Driver', t.driver],
    ['Route', t.route.name],
    ['Speed', `${Math.round(t.speed)} km/h`],
    ['ETA', `${Math.round(t.etaMin)} min`],
    ['Deliveries today', t.deliveriesToday],
    ['Idle time', `${Math.round(t.idleMin)} min`],
    ['Requested load', `${fmtNum(t.requestedLoad)} L`],
    ['Loaded volume', `${fmtNum(t.loadedLoad)} L`],
    ['Loading variance', `${fmtNum(t.loadedLoad - t.requestedLoad)} L`],
  ];
  el.innerHTML = items.map(([k,v])=>`
    <div style="padding:10px 0; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:12px;">
      <span class="eyebrow" style="text-transform:none; letter-spacing:0;">${k}</span>
      <span class="mono" style="font-size:13px;">${v}</span>
    </div>`).join('');
}

function renderTruckCompartments(t){
  const el = document.getElementById('truck-compartments');
  el.innerHTML = t.compartments.map(c=>`
    <div class="tank">
      <div class="tank-body" style="width:78px; height:140px;">
        <div class="tank-fill" style="height:${Math.round(c.level*100)}%;"></div>
      </div>
      <div class="pct">${Math.round(c.level*100)}%</div>
      <div class="label">${c.id} \u00b7 ${c.product}</div>
      <div class="meta">${fmtNum(c.capacity*c.level)} / ${fmtNum(c.capacity)} L</div>
    </div>`).join('');
}

function renderTruckFuelHistory(t){
  const el = document.getElementById('truck-fuel-graph');
  if (!el) return;
  // synthetic 24-point sparkline as SVG polyline
  const points = Array.from({length:24}, (_,i)=> {
    const base = 0.9 - (i/24)*0.55;
    return clamp(base + rnd(-0.04,0.04), 0.05, 1);
  });
  const w = 560, h = 120, pad = 8;
  const coords = points.map((p,i)=> `${(i/(points.length-1))*(w-pad*2)+pad},${h-pad-p*(h-pad*2)}`).join(' ');
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">
    <polyline points="${coords}" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <polygon points="${pad},${h-pad} ${coords} ${w-pad},${h-pad}" fill="url(#g1)" opacity="0.25"/>
    <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--cyan)"/><stop offset="100%" stop-color="transparent"/></linearGradient></defs>
  </svg>`;
}

function renderTruckFuelStatus(t){
  const el = document.getElementById('truck-fuel-status');
  if (!el) return;
  const st = truckFuelStatus(t);
  const varPct = (st.variance*100);
  const varStr = `${varPct>=0?'+':''}${varPct.toFixed(1)}%`;
  const items = [
    ['Truck fuel', `${Math.round(t.truckFuel*100)}%`],
    ['Expected', `${Math.round(st.expected*100)}%`],
    ['Variance', varStr],
    ['Status', st.label],
  ];
  el.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px;">
      ${items.map(([k,v],i)=>`
        <div>
          <div class="eyebrow">${k}</div>
          <div class="mono" style="font-size:16px; font-weight:600; margin-top:4px; ${i===3?`color:var(--${st.tag==='ok'?'sage':st.tag==='warn'?'amber':'red'})`:''}">${v}</div>
        </div>`).join('')}
    </div>`;
}

function renderTruckAlerts(t){
  const el = document.getElementById('truck-alerts');
  if (!el) return;
  const rows = ALERTS.filter(a=>a.entity===t.id);
  el.innerHTML = rows.length ? rows.map(a=>`
    <div class="alert-row">
      <div class="alert-icon ${a.type}">${alertIconChar(a.type)}</div>
      <div class="body">
        <div class="head">
          <strong>${a.title}</strong>
          <span style="display:flex; align-items:center; gap:8px; flex:none;">
            <span class="time mono">${timeAgo(a.time)}</span>
            <button type="button" class="alert-ack-btn" data-restrict-action="ops,depot" onclick="acknowledgeAlert('${a.id}'); refreshRoleAwareUI();">Acknowledge</button>
          </span>
        </div>
        <div class="desc">${a.desc}</div>
      </div>
    </div>`).join('') : `<div style="color:var(--text-faint); font-size:13px; padding:12px 0;">No alerts for this vehicle in the current session.</div>`;
  applyRoleGating();
}

/* ==================================================================
   CHAIN OF CUSTODY PAGE
   ================================================================== */
function currentCustodyTruck(){
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (id){
    const found = TRUCKS.find(t=>t.id===id);
    if (found) return found;
  }
  // default to a rich example: an in-transit truck on a border route
  return TRUCKS.find(t=>t.status==='In transit' && t.route.hasBorder) || TRUCKS[0];
}

function initCustody(){
  const t = currentCustodyTruck();
  renderCustodySwitcher(t);
  renderShipmentHead(t);
  renderCustodySteps(t);

  LiveEngine.on(()=>{ renderShipmentHead(t); renderCustodySteps(t); });
  roleAwareRenderers.push(()=>renderCustodySteps(t));
}

function renderCustodySwitcher(current){
  const el = document.getElementById('custody-switcher');
  if (!el) return;
  el.innerHTML = TRUCKS.map(t=>`<option value="${t.id}" ${t.id===current.id?'selected':''}>${t.id} \u2014 ${t.route.name}</option>`).join('');
  el.onchange = ()=>{ go(`custody.html?id=${el.value}`); };
}

function renderShipmentHead(t){
  const el = document.getElementById('shipment-head');
  if (!el) return;
  const driverLine = roleAllowed('ops,depot') ? t.driver : '\u2014 collated \u2014';
  const items = [
    ['Shipment', t.id],
    ['Route', t.route.name],
    ['Product', cargoSummary(t)],
    ['Driver', driverLine],
    ['Status', t.status],
  ];
  el.innerHTML = items.map(([k,v])=>`<div><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
}

function renderCustodySteps(t){
  const el = document.getElementById('custody-steps');
  if (!el) return;
  const chain = getCustodyChain(t);
  const iconFor = s => s==='complete' ? '\u2713' : s==='active' ? '\u25CF' : '\u25CB';
  el.innerHTML = chain.steps.map(step=>{
    const showDriver = step.driver && roleAllowed('ops,depot');
    const gpsStr = step.gps ? `${step.gps[0].toFixed(4)}, ${step.gps[1].toFixed(4)}` : null;
    return `<div class="custody-step ${step.status}">
      <div class="dot">${step.status==='active' ? '<span class="pulse"></span>' : ''}${iconFor(step.status)}</div>
      <div class="custody-card">
        <div class="cc-head">
          <h4>${step.label}</h4>
          <span class="tag ${step.status==='complete'?'ok':step.status==='active'?'warn':''}">${step.status}</span>
        </div>
        <div class="cc-location">${step.location}</div>
        <div class="cc-detail">${step.detail}</div>
        <div class="cc-meta-row">
          ${gpsStr ? `<span>GPS <strong>${gpsStr}</strong></span>` : ''}
          <span>Time <strong>${new Date(step.time).toLocaleString('en-ZA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}</strong></span>
          ${showDriver ? `<span>Driver <strong>${step.driver}</strong></span>` : ''}
          ${step.signature ? `<span>Signed <strong>${step.signature}</strong></span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}
function currentDepot(){
  if (getRole() === 'depot') return getMyDepot();
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  return DEPOTS.find(d=>d.id===id) || DEPOTS[0];
}

function initDepot(){
  const d = currentDepot();
  renderDepotHeader(d);
  renderDepotTanks(d);
  renderDepotPumps(d);
  renderDepotLoadingBay(d);
  renderDepotAlarms(d);
  renderDepotValves(d);
  renderDepotReconciliation(d);
  renderDepotSwitcher(d);

  LiveEngine.on(()=>{
    renderDepotTanks(d);
    renderDepotReconciliation(d);
    renderDepotPumps(d);
    renderDepotLoadingBay(d);
    renderDepotAlarms(d);
    renderDepotValves(d);
  });
  roleAwareRenderers.push(()=>renderDepotPumps(d), ()=>renderDepotSwitcher(d));

  // if the technician's assigned site changes (or role changes) while
  // already on this page, jump to the correct scoped URL
  document.addEventListener('role-changed', ()=>{
    const resolved = currentDepot();
    if (resolved.id !== d.id) go(`depot.html?id=${resolved.id}`);
  });
}

function renderDepotSwitcher(current){
  const el = document.getElementById('depot-switcher');
  if (!el) return;
  const isDepot = getRole() === 'depot';
  if (isDepot){
    el.innerHTML = `<option value="${current.id}">\uD83D\uDD12 ${current.name}</option>`;
    el.disabled = true;
    el.title = 'Depot Technician access is scoped to your assigned site';
  } else {
    el.disabled = false;
    el.title = '';
    el.innerHTML = DEPOTS.map(d=>`<option value="${d.id}" ${d.id===current.id?'selected':''}>${d.name}</option>`).join('');
    el.onchange = ()=>{ go(`depot.html?id=${el.value}`); };
  }
}

function renderDepotHeader(d){
  document.getElementById('depot-title').textContent = d.name;
  document.getElementById('depot-region').textContent = `${d.region} \u00b7 ${d.tanks.length} tanks \u00b7 ${d.pumps.length} pumps`;
}

function renderDepotTanks(d){
  const el = document.getElementById('depot-tanks');
  el.innerHTML = d.tanks.map(tk=>`
    <div class="card" style="padding:16px; display:flex; flex-direction:column; align-items:center; gap:10px;">
      ${tankGaugeHtml(tk)}
      <div style="width:100%; border-top:1px solid var(--line); margin-top:6px; padding-top:10px; font-size:11.5px; color:var(--text-dim); display:flex; justify-content:space-between; width:100%;">
        <span>Temp</span><span class="mono">${tk.temp.toFixed(1)}\u00b0C</span>
      </div>
      <div style="width:100%; display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-dim);">
        <span>Water</span><span class="mono" style="${tk.water>2?'color:var(--amber)':''}">${tk.water} mm</span>
      </div>
    </div>`).join('');
}

function renderDepotPumps(d){
  const el = document.getElementById('depot-pumps');
  if (!el) return;
  const map = { dispensing:'ok', online:'info', maintenance:'warn' };
  const hint = roleAllowed('depot') ? '' :
    `<div class="action-lock-note">\uD83D\uDD12 Pump control requires Depot Technician access \u2014 click a role above to preview.</div>`;
  el.innerHTML = d.pumps.map(p=>`
    <button type="button" class="pump-btn" data-restrict-action="depot" onclick="togglePump('${d.id}','${p.id}'); refreshRoleAwareUI();">
      <span class="mono" style="font-size:13px;">${p.id}</span>
      <span style="display:flex; align-items:center; gap:12px;">
        <span class="mono" style="font-size:11.5px; color:${p.status==='dispensing'?'var(--cyan)':'var(--text-faint)'};">${p.flowRate>0 ? `${p.flowRate} L/min` : '\u2014'}</span>
        <span class="tag ${map[p.status]}">${p.status}</span>
      </span>
    </button>`).join('') + hint;
}

function renderDepotLoadingBay(d){
  const el = document.getElementById('depot-loading-bay');
  if (!el) return;
  const loading = TRUCKS.filter(t=>t.route.originDepotId===d.id && t.status==='Loading');
  const driverLine = t => roleAllowed('ops,depot') ? t.driver : '\u2014 collated \u2014';
  el.innerHTML = loading.length ? loading.map(t=>`
    <div class="loading-bay-row card-link" style="cursor:pointer;" onclick="go('truck.html?id=${t.id}')">
      <div>
        <strong style="font-size:13px;">${t.id}</strong>
        <div class="eyebrow" style="margin-top:2px;">${t.compartments.length} compartments \u00b7 ${fmtNum(t.loadedLoad)} / ${fmtNum(t.requestedLoad)} L \u00b7 driver ${driverLine(t)}</div>
      </div>
      <span style="display:flex; align-items:center; gap:8px;">
        <span class="tag ok">RFID verified</span>
        <span class="tag warn">Loading</span>
      </span>
    </div>`).join('') : `<div style="color:var(--text-faint); font-size:13px; padding:16px 0;">No tankers currently loading at this site.</div>`;
}

function renderDepotAlarms(d){
  const el = document.getElementById('depot-alarms');
  if (!el) return;
  const alarms = depotAlarms(d);
  el.innerHTML = alarms.length ? alarms.map(a=>`
    <div class="alert-row">
      <div class="alert-icon ${a.tag}">${a.tag==='crit'?'\u2715':'!'}</div>
      <div class="body">
        <div class="head"><strong>${a.title}</strong></div>
        <div class="desc">${a.detail}</div>
      </div>
    </div>`).join('') : `<div style="color:var(--text-faint); font-size:13px; padding:16px 0;">No active alarms \u2014 all systems nominal.</div>`;
}

function renderDepotValves(d){
  const el = document.getElementById('depot-valves');
  if (!el) return;
  el.innerHTML = depotValves(d).map(v=>`
    <div class="valve-row">
      <span><span class="valve-dot" style="background:${v.open?'var(--cyan)':'var(--text-faint)'};"></span>${v.id}</span>
      <span class="mono" style="color:var(--text-dim); font-size:11.5px;">${v.detail}</span>
    </div>`).join('');
}

function renderDepotReconciliation(d){
  const el = document.getElementById('depot-reconciliation');
  if (!el) return;
  const opening = 452000 + rint(-2000,2000);
  const deliveries = rint(28000,52000);
  const dispensed = rint(30000,54000);
  const closing = opening + deliveries - dispensed;
  const expected = opening + deliveries - dispensed;
  const variance = ((expected-closing)/expected*100);
  el.innerHTML = `
    <div class="grid" style="grid-template-columns:repeat(4,1fr); gap:12px;">
      <div class="kpi"><div class="eyebrow">Opening stock</div><div class="val" style="font-size:19px;">${fmtNum(opening)}<span class="unit">L</span></div></div>
      <div class="kpi"><div class="eyebrow">+ Deliveries</div><div class="val" style="font-size:19px;">${fmtNum(deliveries)}<span class="unit">L</span></div></div>
      <div class="kpi"><div class="eyebrow">\u2212 Dispensed</div><div class="val" style="font-size:19px;">${fmtNum(dispensed)}<span class="unit">L</span></div></div>
      <div class="kpi"><div class="eyebrow">Closing stock</div><div class="val" style="font-size:19px; color:var(--sage);">${fmtNum(closing)}<span class="unit">L</span></div></div>
    </div>
    <div style="margin-top:14px; font-family:var(--font-mono); font-size:12px; color:var(--text-dim);">
      Variance vs. metered expectation: <span style="color:${Math.abs(variance)>0.3?'var(--amber)':'var(--sage)'}">${variance.toFixed(3)}%</span> \u00b7 tolerance threshold \u00b10.300%
    </div>`;
}
