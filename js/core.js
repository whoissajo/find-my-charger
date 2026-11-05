/* Pure logic (no DOM): OSM parsing, distance, GeoJSON. Works in browser and Node. */
(function (root) {
  'use strict';

  const BBOX = { s: 31.28, w: 74.1, n: 31.72, e: 74.55 }; // Lahore search box
  const CENTER = [31.5204, 74.3587];

  const SOCKETS = [
    ['type2', 'Type 2', false],
    ['type2_cable', 'Type 2 (cable)', false],
    ['type2_combo', 'CCS2', true],
    ['chademo', 'CHAdeMO', true],
    ['gb_ac', 'GB/T AC', false],
    ['gb_dc', 'GB/T DC', true],
    ['type1', 'Type 1', false],
    ['type1_combo', 'CCS1', true],
    ['tesla_supercharger', 'Tesla Supercharger', true],
    ['tesla_destination', 'Tesla', false],
    ['tesla_standard', 'Tesla', false],
    ['schuko', 'Schuko', false],
    ['typee', 'Type E', false],
    ['cee_blue', 'CEE Blue', false],
    ['cee_red_16a', 'CEE Red 16A', false],
    ['cee_red_32a', 'CEE Red 32A', false]
  ];

  function overpassQuery() {
    const b = `${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}`;
    return `[out:json][timeout:25];(node["amenity"="charging_station"](${b});` +
      `way["amenity"="charging_station"](${b});` +
      `relation["amenity"="charging_station"](${b}););out center tags;`;
  }

  /* "22 kW", "150000 W", "11;22 kW", "7.4kW" -> highest value in kW (or null) */
  function parsePower(v) {
    if (!v) return null;
    let best = null;
    const re = /(\d+(?:[.,]\d+)?)\s*(mw|kw|w)?/gi;
    let m;
    while ((m = re.exec(String(v)))) {
      let n = parseFloat(m[1].replace(',', '.'));
      const u = (m[2] || '').toLowerCase();
      if (u === 'mw') n *= 1000;
      else if (u === 'w' || (!u && n >= 1000)) n /= 1000;
      if (isFinite(n) && (best === null || n > best)) best = n;
    }
    return best;
  }

  function parseElement(el) {
    const t = el.tags || {};
    const lat = el.lat != null ? el.lat : el.center && el.center.lat;
    const lon = el.lon != null ? el.lon : el.center && el.center.lon;
    if (lat == null || lon == null) return null;

    const sockets = [];
    for (const [key, label, dc] of SOCKETS) {
      const raw = t['socket:' + key];
      if (!raw) continue;
      let count = parseInt(raw, 10);
      if (isNaN(count)) count = raw === 'yes' ? 1 : 0;
      if (!count) continue;
      sockets.push({ key, label, dc, count, kw: parsePower(t['socket:' + key + ':output']) });
    }

    let maxKw = null;
    for (const s of sockets) if (s.kw != null && (maxKw === null || s.kw > maxKw)) maxKw = s.kw;
    const generic = parsePower(t['charging_station:output'] || t.maxpower);
    if (generic != null && (maxKw === null || generic > maxKw)) maxKw = generic;

    const hasDC = sockets.some(s => s.dc) || (maxKw != null && maxKw >= 40);
    const hasAC = sockets.some(s => !s.dc);
    const kinds = [];
    if (hasAC) kinds.push('AC');
    if (hasDC) kinds.push('DC');

    const addr = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
    const area = t['addr:suburb'] || t['addr:neighbourhood'] || t['addr:city'] || '';
    const operator = t.operator || t.brand || t.network || '';

    return {
      id: el.type + '/' + el.id,
      osm: { type: el.type, id: el.id },
      source: 'osm',
      name: t.name || t.brand || t.operator || 'EV charging station',
      operator,
      lat, lon,
      address: [addr, area].filter(Boolean).join(', '),
      area,
      kinds,
      sockets,
      maxKw,
      capacity: parseInt(t.capacity, 10) || null,
      access: t.access || '',
      fee: t.fee || '',
      hours: t.opening_hours || '',
      phone: t.phone || t['contact:phone'] || '',
      website: t.website || t['contact:website'] || '',
      payment: Object.keys(t).filter(k => k.indexOf('payment:') === 0 && t[k] === 'yes')
        .map(k => k.slice(8).replace(/_/g, ' ')),
      approx: false
    };
  }

  function parseOverpass(json) {
    const out = [];
    const seen = new Set();
    for (const el of (json && json.elements) || []) {
      const s = parseElement(el);
      if (s && !seen.has(s.id)) { seen.add(s.id); out.push(s); }
    }
    return out;
  }

  function fromSeed(seed) {
    return seed.map(s => ({
      id: s.id, osm: null, source: 'seed', name: s.name, operator: s.operator || '',
      lat: s.lat, lon: s.lon, address: s.area, area: s.area, kinds: [], sockets: [],
      maxKw: null, capacity: null, access: '', fee: '', hours: '', phone: '', website: '',
      payment: [], approx: true
    }));
  }

  function haversine(aLat, aLon, bLat, bLon) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
    const x = Math.sin(dLat / 2) ** 2 +
      Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  /* Merge live OSM stations with starter seed: keep a seed record only if no
   * OSM station is within 400 m of it. */
  function mergeSeed(osm, seed) {
    const keep = seed.filter(s => !osm.some(o => haversine(s.lat, s.lon, o.lat, o.lon) < 400));
    return osm.concat(keep);
  }

  function formatDist(m) {
    if (m == null) return '';
    return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km';
  }

  function toGeoJSON(stations) {
    return {
      type: 'FeatureCollection',
      name: 'lahore-ev-chargers',
      features: stations.map(s => ({
        type: 'Feature',
        id: s.id,
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: {
          name: s.name,
          operator: s.operator || null,
          kinds: s.kinds.join('+') || null,
          max_power_kw: s.maxKw,
          sockets: s.sockets.map(k => k.label + ' x' + k.count + (k.kw ? ' ' + k.kw + 'kW' : '')).join('; ') || null,
          access: s.access || null,
          fee: s.fee || null,
          opening_hours: s.hours || null,
          address: s.address || null,
          approx_location: s.approx,
          source: s.source === 'osm'
            ? 'https://www.openstreetmap.org/' + s.osm.type + '/' + s.osm.id
            : 'starter record (approximate)',
          license: 'ODbL - OpenStreetMap contributors'
        }
      }))
    };
  }

  const api = { BBOX, CENTER, overpassQuery, parsePower, parseElement, parseOverpass,
    fromSeed, haversine, mergeSeed, formatDist, toGeoJSON };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EVCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
