# Lahore EV Finder

A fast, responsive Lahore-only EV charging map. The web app uses MapLibre GL JS for the interactive map and fetches publicly mapped charging stations from OpenStreetMap through a cached Vercel Route Handler.

## Features

- Lahore map with searchable charger listings and map markers.
- AC/DC filters, connector and charging-power details when mapped.
- Browser geolocation and Google Maps directions.
- GeoJSON export that can be opened in RustGIS for deeper geospatial analysis.
- No map API key or proprietary map SDK required.

## Data quality

The live directory is based on OpenStreetMap's `amenity=charging_station` features within the Lahore bounding box. It reflects what has been mapped in OSM, not every real-world charger. Charging status is not live; unknown power, connectors, access, and opening hours stay explicitly unknown rather than being guessed. Users should confirm station access and operation before travelling.

## RustGIS workflow

RustGIS is a standalone GIS application, not a drop-in React map widget. Use **Export GeoJSON** in the app, then open the downloaded `lahore-ev-chargers.geojson` in [RustGIS Web](https://web.rustgis.app/) or the desktop application. The export contains the visible filtered features and their OSM attribution/source IDs.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production build

```bash
npm run typecheck
npm run build
npm start
```

## Deploy to Vercel

Import `whoissajo/find-my-charger` into Vercel. Framework preset: **Next.js**. Root directory: repository root. No environment variables are required. Every push to `main` can deploy to production through Vercel's Git integration; pull requests can receive preview deployments.

## Data and map providers

- Charger records: [OpenStreetMap](https://www.openstreetmap.org/) via the [Overpass API](https://overpass-api.de/). OpenStreetMap contributors are credited in the map.
- Basemap: [CARTO](https://carto.com/), using its public Positron style and vector tiles.
- Map renderer: [MapLibre GL JS](https://maplibre.org/).
- Geospatial export/analysis: [RustGIS](https://github.com/opengeos/RustGIS).

The Overpass service is a shared community service and may occasionally rate-limit or be unavailable. The API route tries a fallback instance and the UI displays a clear source error rather than fabricating records.

## License

Project source is released under the MIT License. Map and charger data remain subject to their respective provider terms and attribution requirements.
