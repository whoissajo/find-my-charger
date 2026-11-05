# Lahore EV Finder

A fast, responsive Lahore-only EV charging directory. The map is rendered with Leaflet and public raster tiles (no WebGL requirement). Charger locations are loaded from OpenStreetMap through a Vercel Route Handler, with published Open Charge Map listings bundled as a first-paint/offline-service fallback.

## Features

- Lahore map with searchable charger listings and markers visible immediately.
- AC/DC filters, mapped connector and charging-power details.
- Browser geolocation and Google Maps directions.
- GeoJSON export that can be opened in RustGIS for geospatial analysis.
- Responsive desktop and mobile layouts.
- No proprietary map SDK or map API key required.

## Charger coverage and data quality

The live directory queries OpenStreetMap's `amenity=charging_station` features inside the Lahore search bounding box. It also includes a small set of published Lahore records with source-published coordinates from Open Charge Map so the map is useful while Overpass is offline.

The bundled starter set is a fallback, not a complete inventory. It currently includes Total EV Charging Station (Gulberg III), HUBCO Green / Total Parco (Gulberg III), Go Green Avenue and EV Charger (Packages Mall), and Mall of Lahore (Cantt). Open Charge Map records can be old or not recently verified: the website labels them as source-reported, not live operational status. Connector details, access and opening hours are only shown when supplied by the source.

See the Open Charge Map records linked from the station details. Check with a station/operator before travelling.

## RustGIS workflow

RustGIS is a standalone GIS application, not a drop-in React map widget. Use **Export GeoJSON** in the app, then open the downloaded `lahore-ev-chargers.geojson` in [RustGIS Web](https://web.rustgis.app/) or the desktop application. The export contains the visible filtered features and their source IDs/URLs.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production checks

```bash
npm run typecheck
npm run build
npm start
```

## Deploy to Vercel

Import `whoissajo/find-my-charger` into Vercel. Framework preset: **Next.js**. Root directory: repository root. No environment variables are required. Every push to `main` can deploy to production through Vercel's Git integration; pull requests can receive preview deployments.

## Data and map providers

- Charger records: [OpenStreetMap](https://www.openstreetmap.org/) via the [Overpass API](https://overpass-api.de/), plus a curated fallback from [Open Charge Map](https://openchargemap.org/). Both source records are linked from station details.
- Basemap: [CARTO](https://carto.com/) raster tiles, with OpenStreetMap raster tiles as a fallback.
- Map renderer: [Leaflet](https://leafletjs.com/).
- Geospatial export/analysis: [RustGIS](https://github.com/opengeos/RustGIS).

OpenStreetMap data is © OpenStreetMap contributors and is available under the Open Database License (ODbL). Open Charge Map records identify their applicable source license and contributor attribution. CARTO and OpenStreetMap map-tile attributions are displayed on the map.

The Overpass service is a shared community service and may occasionally rate-limit or be unavailable. In that case, the site keeps the bundled published Lahore records visible and offers a retry rather than rendering an empty directory.

## License

Project source is released under the MIT License. Map and charger data remain subject to their respective provider terms and attribution requirements.
