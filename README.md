# ⚡ Lahore EV Finder

A free, open-source map of every EV charging station in Lahore. No build step, no framework, **no API keys, no accounts, no paid services**. It is plain HTML, CSS and JavaScript, so any static host can serve it.

## Features

- Live charger data from OpenStreetMap (`amenity=charging_station`) through the free Overpass API, with four mirror servers tried in order
- Saved data (1 hour) and an offline app shell, so the map still opens without a connection
- Marker clustering, search, **AC / DC** filters, saved ⭐ chargers, sort by name / power / nearest
- "Nearest charger" button using browser geolocation (location never leaves your device)
- Detail card: connector types, power, access, fee, hours, phone, website
- Directions via free URL links (Google Maps and OpenStreetMap/OSRM), no key needed
- Shareable deep links (`#node/123456`)
- **Export GeoJSON** of the filtered chargers, ready to open in [RustGIS Web](https://web.rustgis.app/) or the RustGIS desktop app
- Light and dark themes, responsive layout with a mobile bottom sheet, keyboard shortcuts (`/` search, `Esc` close)

## Run locally

```bash
python3 -m http.server 8000     # or: npx serve .
# open http://localhost:8000
```

(Opening `index.html` directly from disk also draws the map, but the service worker and some browser APIs need `http://localhost` or HTTPS.)

## Deploy for free

| Host | How |
|---|---|
| **GitHub Pages** | Push to `main`; the included workflow `.github/workflows/pages.yml` publishes it. Enable *Settings → Pages → Source: GitHub Actions*. |
| **Cloudflare Pages / Netlify / Vercel** | Import the repo, no build command, output directory `/` (root). |

## Using the export in RustGIS

1. Click **Export GeoJSON** (it exports whatever your current filters show).
2. Open <https://web.rustgis.app/> or the desktop app and load `lahore-ev-chargers.geojson`.
3. Each feature carries name, operator, AC/DC kind, max kW, sockets, access, fee, hours and the OSM source link.

## Data, maps and attribution

- Charger data: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL. Missing or wrong? Use **Improve this data** in any station card and everyone benefits.
- Basemap: [CARTO](https://carto.com/attributions) raster tiles (free for light use), falling back to the OpenStreetMap tile server automatically if CARTO is blocked. Please respect the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and don't hammer it; for heavy traffic, host your own tiles.
- Map library: [Leaflet](https://leafletjs.com/) and Leaflet.markercluster, loaded from unpkg.
- Overpass API is a shared community service that can rate-limit or be slow. The app retries across mirrors and falls back to saved data.

**Limits you should know about:** OpenStreetMap shows where chargers are and, when mapped, their connectors, but it does **not** show live availability or whether a charger is working. Always confirm with the operator before a long trip. The four "starter" records in `js/data.js` use approximate locations and are hidden automatically once OSM has a station within 400 m.

## Project layout

```
index.html            page shell
css/styles.css        design system (themes, cards, map pins, mobile sheet)
js/core.js            pure logic: OSM parsing, distance, GeoJSON (works in Node too)
js/app.js             map + UI
js/data.js            tiny offline starter set
sw.js                 offline app shell
manifest.webmanifest  installable PWA
```

## License

MIT. Map and charger data stay under their providers' licences.
