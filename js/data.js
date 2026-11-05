/* Starter records shown only until live OpenStreetMap data loads (or if every
 * Overpass mirror is unreachable). They are dropped automatically as soon as
 * OSM has a station within ~400 m. Coordinates are APPROXIMATE (area level),
 * and the UI says so. Always confirm with the operator before travelling. */
window.EV_SEED = [
  { id: 'seed/total-ev-gulberg', name: 'Total EV Charging Station', operator: 'Total Parco',
    area: 'Gulberg III', lat: 31.5122, lon: 74.3436 },
  { id: 'seed/hubco-gulberg', name: 'HUBCO Green / Total Parco', operator: 'HUBCO Green',
    area: 'Gulberg III', lat: 31.5139, lon: 74.3462 },
  { id: 'seed/go-green-packages', name: 'Go Green Avenue EV Charger', operator: 'Go Green',
    area: 'Packages Mall', lat: 31.4704, lon: 74.3575 },
  { id: 'seed/mall-of-lahore', name: 'Mall of Lahore EV Charger', operator: '',
    area: 'Cantt', lat: 31.5330, lon: 74.3700 }
];
