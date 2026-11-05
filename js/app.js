/* Lahore EV Finder — UI. Free stack only: Leaflet + OpenStreetMap/Overpass + CARTO/OSM tiles. */
(function () {
  'use strict';
  const C = window.EVCore;
  const $ = (s, r) => (r || document).querySelector(s);

  const ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
  ];
  const CACHE_KEY = 'lev:cache:v1';
  const CACHE_TTL = 60 * 60 * 1000; // 1 h
  const BOLT = '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>';

  const state = {
    all: [], list: [], markers: new Map(),
    type: 'all', favOnly: false, q: '', sort: 'name',
    user: null, selected: null, live: false, updated: null,
    favs: new Set(load('lev:favs', [])), tileStyle: 'auto'
  };

  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function safeUrl(u) {
    try { const x = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; }
  }

  /* ---------------- Theme ---------------- */
  const root = document.documentElement;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function theme() { return load('lev:theme', null) || (mq.matches ? 'dark' : 'light'); }
  function applyTheme() {
    root.dataset.theme = theme();
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = theme() === 'dark' ? '#0b1220' : '#f4f7fb';
    if (window.map) applyTiles();
  }
  $('#themeBtn').onclick = () => { save('lev:theme', theme() === 'dark' ? 'light' : 'dark'); applyTheme(); };
  mq.addEventListener && mq.addEventListener('change', () => { if (!load('lev:theme', null)) applyTheme(); });

  /* ---------------- Map ---------------- */
  const map = window.map = L.map('map', { zoomControl: false, preferCanvas: true, minZoom: 9, maxZoom: 19 })
    .setView(C.CENTER, 12);
  L.control.zoom({ position: 'topright' }).addTo(map);

  const OSMA = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const ESRI = 'Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, and the GIS User Community';
  const TILES = {
    light: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', sub: 'abcd', attr: OSMA + ' &copy; <a href="https://carto.com/attributions">CARTO</a>' },
    dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', sub: 'abcd', attr: OSMA + ' &copy; <a href="https://carto.com/attributions">CARTO</a>' },
    osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', sub: 'abc', attr: OSMA },
    sat: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', sub: '', attr: ESRI,
      labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}' },
    esri: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', sub: '', attr: ESRI },
    topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', sub: 'abc', maxNative: 17,
      attr: 'Map data: ' + OSMA + ', <a href="https://viewfinderpanoramas.org">SRTM</a> | Style: <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' }
  };
  const STYLES = [['auto', 'Auto (light / dark)'], ['osm', 'OpenStreetMap'], ['esri', 'Esri Streets'], ['sat', 'Satellite'], ['topo', 'Terrain']];
  const styleName = k => (STYLES.find(s => s[0] === k) || STYLES[0])[1].replace(/ \(.*\)/, '');
  let tileLayer = null, labelLayer = null, tileErrors = 0;
  function applyTiles() {
    const key = state.tileStyle === 'auto' ? (theme() === 'dark' ? 'dark' : 'light') : state.tileStyle;
    const t = TILES[key];
    if (tileLayer) map.removeLayer(tileLayer);
    if (labelLayer) { map.removeLayer(labelLayer); labelLayer = null; }
    tileErrors = 0;
    tileLayer = L.tileLayer(t.url, { subdomains: t.sub || 'abc', attribution: t.attr, maxZoom: 19, maxNativeZoom: t.maxNative || 19, detectRetina: false }).addTo(map);
    if (t.labels) labelLayer = L.tileLayer(t.labels, { maxZoom: 19, maxNativeZoom: 19, pane: 'shadowPane', opacity: .95 }).addTo(map);
    tileLayer.on('tileerror', () => {
      // If this tile host is blocked on the network, fall back to plain OSM tiles.
      if (++tileErrors === 6 && key !== 'osm') { setStyle('osm'); toast('Tiles unavailable here — switched to OpenStreetMap'); }
    });
  }
  function setStyle(k) {
    state.tileStyle = k; save('lev:tiles', k);
    $('#styleBtn').textContent = 'Map: ' + styleName(k);
    applyTiles(); renderStyleMenu();
  }
  function renderStyleMenu() {
    const m = $('#styleMenu');
    m.innerHTML = STYLES.map(([k, n]) => '<button role="menuitemradio" aria-checked="' + (k === state.tileStyle) + '" data-k="' + k + '">' + n + '</button>').join('');
  }
  const menu = document.createElement('div');
  menu.id = 'styleMenu'; menu.className = 'style-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
  $('#styleBtn').after(menu);
  menu.addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) { setStyle(b.dataset.k); menu.hidden = true; } });
  $('#styleBtn').onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', () => { menu.hidden = true; });
  if (STYLES.some(s => s[0] === load('lev:tiles', 'auto'))) state.tileStyle = load('lev:tiles', 'auto');
  $('#styleBtn').textContent = 'Map: ' + styleName(state.tileStyle);
  renderStyleMenu();

  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 48, spiderfyOnMaxZoom: true,
    iconCreateFunction: c => L.divIcon({ html: '<div class="cluster">' + c.getChildCount() + '</div>', className: '', iconSize: [42, 42] })
  });
  map.addLayer(cluster);
  let meMarker = null, meCircle = null;

  function pinClass(s) { return s.kinds.length === 2 ? 'both' : s.kinds[0] ? s.kinds[0].toLowerCase() : 'na'; }
  function pinIcon(s, sel) {
    return L.divIcon({ className: '', iconSize: [36, 36], iconAnchor: [18, 34],
      html: '<div class="pin ' + pinClass(s) + (sel ? ' sel' : '') + '"><i></i>' + BOLT + '</div>' });
  }

  /* ---------------- Data ---------------- */
  async function overpass() {
    let last;
    for (const ep of ENDPOINTS) {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 22000);
      try {
        const r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(C.overpassQuery()),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
        clearTimeout(to);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (!j || !Array.isArray(j.elements)) throw new Error('Bad response');
        return j;
      } catch (e) { clearTimeout(to); last = e; }
    }
    throw last || new Error('No Overpass server reachable');
  }

  function setStations(osm, live, updated) {
    state.all = C.mergeSeed(osm, C.fromSeed(window.EV_SEED || []));
    state.live = live; state.updated = updated || null;
    refresh(true);
  }

  async function loadData(force) {
    const cache = load(CACHE_KEY, null);
    const fresh = cache && Date.now() - cache.t < CACHE_TTL;
    if (cache && cache.elements) setStations(C.parseOverpass({ elements: cache.elements }), false, cache.t);
    else setStations([], false, null);
    if (fresh && !force) { banner('ok', 'Showing data saved ' + ago(cache.t) + ' from OpenStreetMap. <button id="bRetry">Refresh now</button>'); wireBanner(); hash(); return; }
    banner('', 'Fetching live chargers from OpenStreetMap…');
    try {
      const json = await overpass();
      const t = Date.now();
      save(CACHE_KEY, { t, elements: json.elements });
      setStations(C.parseOverpass(json), true, t);
      banner('ok', 'Live from OpenStreetMap · ' + state.all.filter(s => s.source === 'osm').length + ' stations · updated just now.');
      if (!state.all.some(s => s.source === 'osm')) banner('', 'OpenStreetMap returned no chargers right now. Showing starter records. <button id="bRetry">Retry</button>');
    } catch (e) {
      const have = state.all.some(s => s.source === 'osm');
      banner('', (have ? 'Couldn\'t reach OpenStreetMap — showing saved data from ' + ago(cache && cache.t) + '.' :
        'Couldn\'t reach OpenStreetMap (Overpass is a shared community service). Showing a small starter set.') + ' <button id="bRetry">Retry</button>');
    }
    wireBanner(); hash();
  }
  function wireBanner() { const b = $('#bRetry'); if (b) b.onclick = () => loadData(true); }
  function banner(kind, html) {
    const el = $('#banner'); el.hidden = false; el.className = 'banner ' + kind; el.innerHTML = html;
  }
  function ago(t) {
    if (!t) return 'earlier';
    const m = Math.round((Date.now() - t) / 60000);
    return m < 2 ? 'just now' : m < 90 ? m + ' min ago' : Math.round(m / 60) + ' h ago';
  }

  /* ---------------- Filtering / render ---------------- */
  function distOf(s) { return state.user ? C.haversine(state.user.lat, state.user.lon, s.lat, s.lon) : null; }

  function apply() {
    const q = state.q.trim().toLowerCase();
    let out = state.all.filter(s => {
      if (state.type !== 'all' && !s.kinds.includes(state.type)) return false;
      if (state.favOnly && !state.favs.has(s.id)) return false;
      if (q && !(s.name + ' ' + s.operator + ' ' + s.address + ' ' + s.area).toLowerCase().includes(q)) return false;
      return true;
    });
    out.forEach(s => { s._d = distOf(s); });
    if (state.sort === 'near' && state.user) out.sort((a, b) => a._d - b._d);
    else if (state.sort === 'power') out.sort((a, b) => (b.maxKw || 0) - (a.maxKw || 0) || a.name.localeCompare(b.name));
    else out.sort((a, b) => a.name.localeCompare(b.name));
    state.list = out;
  }

  function refresh(fit) {
    apply(); renderMarkers(); renderList(); renderStats();
    if (fit && !state.fitted && state.list.length && !state.selected) { state.fitted = true; fitAll(); }
  }

  function renderMarkers() {
    cluster.clearLayers(); state.markers.clear();
    const layers = state.list.map(s => {
      const m = L.marker([s.lat, s.lon], { icon: pinIcon(s, s.id === state.selected), title: s.name, keyboard: true });
      m.on('click', () => select(s.id, { pan: true }));
      state.markers.set(s.id, m);
      return m;
    });
    cluster.addLayers(layers);
  }

  function powerTag(s) {
    if (s.kinds.length === 0) return '';
    const kw = s.maxKw ? ' ' + (s.maxKw % 1 ? s.maxKw.toFixed(1) : s.maxKw) + ' kW' : '';
    return s.kinds.slice().reverse().map(k => '<span class="tag ' + k.toLowerCase() + '">' + k + (k === (s.kinds.includes('DC') ? 'DC' : 'AC') ? kw : '') + '</span>').join('');
  }

  function renderList() {
    const ul = $('#list');
    $('#countPill').textContent = state.list.length;
    $('#subtitle').textContent = state.list.length + ' charger' + (state.list.length === 1 ? '' : 's') +
      (state.live ? ' · live OpenStreetMap data' : state.all.some(s => s.source === 'osm') ? ' · saved OpenStreetMap data' : ' · starter set');
    if (!state.list.length) {
      ul.innerHTML = '<li class="empty">' + (state.all.length ? 'No chargers match these filters.' : 'Loading…') + '</li>';
      return;
    }
    ul.innerHTML = state.list.map((s, i) => {
      const cls = pinClass(s);
      const sockets = s.sockets.slice(0, 3).map(k => '<span class="tag">' + esc(k.label) + ' ×' + k.count + '</span>').join('');
      return '<li class="card' + (s.id === state.selected ? ' sel' : '') + '" data-id="' + esc(s.id) + '" tabindex="0" role="button" style="animation-delay:' + Math.min(i, 12) * 25 + 'ms">' +
        '<div class="ico ' + cls + '">' + BOLT.replace('<svg', '<svg width="22" height="22" fill="#fff"') + '</div>' +
        '<div class="meta"><h3>' + esc(s.name) + '</h3><p class="sub">' + esc([s.area, s.operator].filter(Boolean).join(' · ') || 'Lahore') + '</p>' +
        '<div class="tags">' + powerTag(s) + sockets + (s.approx ? '<span class="tag warn">approx. location</span>' : (!s.kinds.length ? '<span class="tag warn">details not mapped</span>' : '')) + '</div></div>' +
        '<div class="side"><span class="dist">' + C.formatDist(s._d) + '</span>' +
        '<button class="star" data-fav="' + esc(s.id) + '" aria-pressed="' + state.favs.has(s.id) + '" aria-label="Save charger" title="Save">★</button></div></li>';
    }).join('');
  }

  function renderStats() {
    const l = state.list;
    const dc = l.filter(s => s.kinds.includes('DC')).length, ac = l.filter(s => s.kinds.includes('AC')).length;
    const max = l.reduce((m, s) => Math.max(m, s.maxKw || 0), 0);
    $('#stats').innerHTML = [['Total', l.length], ['DC fast', dc], ['AC', ac], ['Max kW', max || '–']]
      .map(([k, v]) => '<div class="stat"><b>' + v + '</b><span>' + k + '</span></div>').join('');
  }

  /* ---------------- Selection / detail ---------------- */
  function select(id, opt) {
    opt = opt || {};
    const prev = state.selected;
    state.selected = id;
    const s = state.all.find(x => x.id === id);
    if (!s) return closeDetail();
    [prev, id].forEach(pid => {
      const m = state.markers.get(pid), st = state.all.find(x => x.id === pid);
      if (m && st) m.setIcon(pinIcon(st, pid === id));
    });
    document.querySelectorAll('.card.sel').forEach(c => c.classList.remove('sel'));
    const card = $('.card[data-id="' + CSS.escape(id) + '"]');
    if (card) { card.classList.add('sel'); if (opt.scroll) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    const m = state.markers.get(id);
    if (opt.pan !== false) {
      const go = () => map.flyTo([s.lat, s.lon], Math.max(map.getZoom(), 16), { duration: .7 });
      if (m && cluster.hasLayer(m)) cluster.zoomToShowLayer(m, go); else go();
    }
    showDetail(s);
    history.replaceState(null, '', '#' + encodeURIComponent(id));
    if (matchMedia('(max-width:860px)').matches) setSheet(false);
  }

  function closeDetail() {
    const prev = state.selected; state.selected = null;
    $('#detail').hidden = true;
    const m = state.markers.get(prev), st = state.all.find(x => x.id === prev);
    if (m && st) m.setIcon(pinIcon(st, false));
    document.querySelectorAll('.card.sel').forEach(c => c.classList.remove('sel'));
    history.replaceState(null, '', location.pathname + location.search);
  }

  function showDetail(s) {
    const d = distOf(s);
    const cls = pinClass(s);
    const gm = 'https://www.google.com/maps/dir/?api=1&destination=' + s.lat + ',' + s.lon;
    const osmDir = 'https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=' +
      (state.user ? state.user.lat + ',' + state.user.lon : '') + ';' + s.lat + ',' + s.lon;
    const gmView = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.name + ' ' + s.lat + ',' + s.lon);
    const osmPage = s.osm ? 'https://www.openstreetmap.org/' + s.osm.type + '/' + s.osm.id : '';
    const editUrl = s.osm ? 'https://www.openstreetmap.org/edit?' + s.osm.type + '=' + s.osm.id : 'https://www.openstreetmap.org/edit#map=18/' + s.lat + '/' + s.lon;
    const web = s.website ? safeUrl(s.website) : '';
    const kv = (k, v) => v ? '<div class="kv"><small>' + k + '</small><b>' + esc(v) + '</b></div>' : '';
    const feeTxt = s.fee === 'yes' ? 'Paid' : s.fee === 'no' ? 'Free' : s.fee;
    const sockets = s.sockets.length ? '<ul class="d-sockets">' + s.sockets.map(k =>
      '<li><span class="k"><i class="dot ' + (k.dc ? 'dc' : 'ac') + '"></i>' + esc(k.label) + '</span><span>×' + k.count + (k.kw ? ' · ' + k.kw + ' kW' : '') + '</span></li>').join('') + '</ul>' : '';
    const el = $('#detail');
    el.innerHTML =
      '<div class="d-head"><div class="ico ' + cls + '">' + BOLT.replace('<svg', '<svg width="22" height="22" fill="#fff"') + '</div>' +
      '<div><h2>' + esc(s.name) + '</h2><p>' + esc([s.operator, s.address].filter(Boolean).join(' · ') || 'Lahore, Pakistan') + '</p></div>' +
      '<button class="icon-btn d-close" id="dClose" aria-label="Close">✕</button></div>' +
      '<div class="d-grid">' +
      kv('Type', s.kinds.length ? s.kinds.join(' + ') : 'Not mapped') + kv('Max power', s.maxKw ? s.maxKw + ' kW' : '') +
      kv('Distance', d != null ? C.formatDist(d) : '') + kv('Access', s.access) + kv('Fee', feeTxt) + kv('Capacity', s.capacity ? s.capacity + ' vehicles' : '') +
      '</div>' + sockets +
      (s.hours ? '<div class="kv" style="margin-bottom:12px"><small>Opening hours</small><b>' + esc(s.hours) + '</b></div>' : '') +
      (s.phone ? '<div class="kv" style="margin-bottom:12px"><small>Phone</small><b><a href="tel:' + esc(s.phone.replace(/[^+\d]/g, '')) + '">' + esc(s.phone) + '</a></b></div>' : '') +
      '<div class="d-actions"><a class="btn" href="' + gm + '" target="_blank" rel="noopener">Directions</a>' +
      '<a class="btn ghost" href="' + esc(osmDir) + '" target="_blank" rel="noopener">OSM route</a>' +
      '<button class="btn ghost" id="dShare">Share</button>' +
      '<button class="btn ghost" id="dFav">' + (state.favs.has(s.id) ? '★ Saved' : '☆ Save') + '</button></div>' +
      (s.approx ? '<p class="note">This starter record has an <b>approximate</b> location and no connector details. Live OpenStreetMap data replaces it when a mapped station exists nearby. Confirm with the operator before travelling.</p>' :
        !s.kinds.length ? '<p class="note">Connector types and power aren\'t mapped for this station yet. You can add them on OpenStreetMap so everyone benefits.</p>' :
          '<p class="note">Crowd-sourced data from OpenStreetMap. Live availability isn\'t shown — check with the operator before travelling.</p>') +
      '<div class="d-links"><a href="' + esc(gmView) + '" target="_blank" rel="noopener">Latest on Google Maps ↗</a>' + (osmPage ? '<a href="' + osmPage + '" target="_blank" rel="noopener">View on OSM</a>' : '') +
      '<a href="' + editUrl + '" target="_blank" rel="noopener">Improve this data</a>' +
      (web ? '<a href="' + esc(web) + '" target="_blank" rel="noopener">Website</a>' : '') +
      '<a href="#" id="dCopy">Copy coordinates</a></div>';
    el.hidden = false;
    $('#dClose').onclick = closeDetail;
    $('#dFav').onclick = () => { toggleFav(s.id); showDetail(s); };
    $('#dShare').onclick = async () => {
      const url = location.origin + location.pathname + '#' + encodeURIComponent(s.id);
      try { if (navigator.share) await navigator.share({ title: s.name, url }); else throw 0; }
      catch (e) { copy(url, 'Link copied'); }
    };
    $('#dCopy').onclick = ev => { ev.preventDefault(); copy(s.lat.toFixed(6) + ', ' + s.lon.toFixed(6), 'Coordinates copied'); };
  }

  function copy(text, msg) {
    const done = () => toast(msg);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => toast(text));
    else toast(text);
  }

  function toggleFav(id) {
    state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
    save('lev:favs', [...state.favs]);
  }

  /* ---------------- Controls ---------------- */
  $('#list').addEventListener('click', e => {
    const star = e.target.closest('.star');
    if (star) { e.stopPropagation(); toggleFav(star.dataset.fav); star.setAttribute('aria-pressed', state.favs.has(star.dataset.fav)); if (state.favOnly) refresh(); if (state.selected === star.dataset.fav) showDetail(state.all.find(x => x.id === state.selected)); return; }
    const card = e.target.closest('.card');
    if (card) select(card.dataset.id, { pan: true });
  });
  $('#list').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('card')) { e.preventDefault(); select(e.target.dataset.id, { pan: true }); }
  });

  document.querySelectorAll('.chip[data-type]').forEach(b => b.onclick = () => {
    state.type = b.dataset.type;
    document.querySelectorAll('.chip[data-type]').forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on); });
    refresh();
  });
  $('#favChip').onclick = e => {
    state.favOnly = !state.favOnly; e.currentTarget.classList.toggle('active', state.favOnly); e.currentTarget.setAttribute('aria-pressed', state.favOnly); refresh();
  };
  let qt; $('#q').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { state.q = e.target.value; refresh(); }, 120); });
  $('#sortSel').onchange = e => {
    state.sort = e.target.value;
    if (state.sort === 'near' && !state.user) locate(true); else refresh();
  };
  $('#fitBtn').onclick = () => { fitAll(); };
  $('#nearBtn').onclick = () => locate(false, true);
  $('#locateBtn').onclick = () => locate(false);
  $('#refreshBtn').onclick = () => loadData(true);
  $('#exportBtn').onclick = () => {
    if (!state.list.length) return toast('Nothing to export');
    const blob = new Blob([JSON.stringify(C.toGeoJSON(state.list), null, 2)], { type: 'application/geo+json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lahore-ev-chargers.geojson';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Exported ' + state.list.length + ' chargers — open the file in RustGIS');
  };

  function fitAll() {
    const pts = state.list.map(s => [s.lat, s.lon]);
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(.12), { maxZoom: 14 });
    else if (pts.length === 1) map.setView(pts[0], 15);
    else map.setView(C.CENTER, 12);
  }

  function locate(forSort, flyNearest) {
    if (!navigator.geolocation) return toast('Location isn\'t supported on this device');
    toast('Finding you…');
    navigator.geolocation.getCurrentPosition(p => {
      state.user = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
      const ll = [state.user.lat, state.user.lon];
      if (meMarker) { meMarker.setLatLng(ll); meCircle.setLatLng(ll).setRadius(state.user.acc); }
      else {
        meCircle = L.circle(ll, { radius: state.user.acc, color: '#1d7bff', weight: 1, fillOpacity: .08, interactive: false }).addTo(map);
        meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [18, 18] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
      }
      if (forSort || state.sort === 'near' || flyNearest) { state.sort = 'near'; $('#sortSel').value = 'near'; }
      refresh();
      const outside = !L.latLngBounds([C.BBOX.s, C.BBOX.w], [C.BBOX.n, C.BBOX.e]).contains(ll);
      if (flyNearest || forSort) {
        const n = state.list.filter(s => s._d != null).sort((a, b) => a._d - b._d)[0];
        if (n) { select(n.id, { pan: true, scroll: true }); toast('Nearest: ' + n.name + ' · ' + C.formatDist(n._d) + (outside ? ' (you appear to be outside Lahore)' : '')); }
      } else { map.flyTo(ll, 14, { duration: .8 }); if (outside) toast('You appear to be outside Lahore'); }
    }, err => {
      toast(err.code === 1 ? 'Location permission denied — enable it in your browser settings' : 'Couldn\'t get your location');
      if (state.sort === 'near') { state.sort = 'name'; $('#sortSel').value = 'name'; }
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  /* Bottom sheet (mobile) */
  function setSheet(open) { $('#panel').classList.toggle('open', open); document.body.classList.toggle('sheet-open', open); }
  $('#sheetToggle').onclick = () => setSheet(true);
  $('#grabber').onclick = () => setSheet(false);
  let ty = null;
  $('#panel').addEventListener('touchstart', e => { ty = e.target.closest('.grabber, .brand') ? e.touches[0].clientY : null; }, { passive: true });
  $('#panel').addEventListener('touchend', e => { if (ty != null && e.changedTouches[0].clientY - ty > 60) setSheet(false); ty = null; }, { passive: true });
  map.on('click', () => { if (state.selected) closeDetail(); });

  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); setSheet(true); $('#q').focus(); }
    if (e.key === 'Escape') { if (state.selected) closeDetail(); else setSheet(false); }
  });

  let tt;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 3500);
  }

  function hash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id && state.all.some(s => s.id === id) && state.selected !== id) select(id, { pan: true });
  }
  window.addEventListener('hashchange', hash);

  /* ---------------- Boot ---------------- */
  applyTheme();
  applyTiles();
  if (matchMedia('(max-width:860px)').matches) setSheet(false);
  $('#list').innerHTML = '<li class="skeleton"></li><li class="skeleton"></li><li class="skeleton"></li><li class="skeleton"></li>';
  loadData(false);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
