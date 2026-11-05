"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type ChargerType = "AC" | "DC" | "AC/DC" | "Unknown";

type Charger = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: ChargerType;
  powerKw: number | null;
  connectors: string[];
  operator: string | null;
  address: string | null;
  area: string | null;
  access: string | null;
  openingHours: string | null;
  osmUrl: string;
};

type ApiPayload = {
  chargers: Charger[];
  count: number;
  source: string;
  fetchedAt: string;
  error?: string;
};

type Filter = "ALL" | "DC" | "AC";
type UserLocation = { lat: number; lon: number };

const LAHORE_CENTER: [number, number] = [74.3587, 31.5204];
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

function distanceKm(from: UserLocation, to: Charger): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(to.lat - from.lat);
  const dLon = radians(to.lon - from.lon);
  const lat1 = radians(from.lat);
  const lat2 = radians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function powerLabel(power: number | null): string {
  return power ? `${Number.isInteger(power) ? power : power.toFixed(1)} kW` : "Power TBA";
}

function chargerKindLabel(type: ChargerType): string {
  if (type === "AC/DC") return "AC + DC";
  if (type === "Unknown") return "Type unlisted";
  return `${type} charging`;
}

function accessLabel(access: string | null): string {
  if (!access) return "Access not listed";
  if (access === "private") return "Private access";
  if (access === "customers") return "For customers";
  if (access === "yes" || access === "permissive") return "Public access";
  return access.replaceAll("_", " ");
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function ChargerCard({
  charger,
  selected,
  userLocation,
  onClick,
}: {
  charger: Charger;
  selected: boolean;
  userLocation: UserLocation | null;
  onClick: () => void;
}) {
  const typeClass =
    charger.type === "DC" || charger.type === "AC/DC"
      ? "type-dc"
      : charger.type === "AC"
        ? "type-ac"
        : "type-unknown";
  const distance = userLocation ? distanceKm(userLocation, charger) : null;

  return (
    <button
      type="button"
      className={`station-card ${selected ? "station-card-selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className={`station-card-icon ${typeClass}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13.4 2.8 5.8 13h5.1l-.5 8.2 7.8-10.5h-5.1l.3-7.9Z" />
        </svg>
      </span>
      <span className="station-card-content">
        <span className="station-card-title">{charger.name}</span>
        <span className="station-card-subtitle">
          {charger.area || charger.address || charger.operator || "Lahore"}
          {distance !== null ? ` · ${distance.toFixed(1)} km` : ""}
        </span>
        <span className="station-card-tags">
          <span className={`station-type-tag ${typeClass}`}>
            {charger.type === "Unknown" ? "TYPE TBA" : charger.type}
          </span>
          {charger.connectors.slice(0, 2).map((connector) => (
            <span className="station-connector" key={connector}>{connector}</span>
          ))}
        </span>
      </span>
      <span className="station-card-power">{powerLabel(charger.powerKw)}</span>
    </button>
  );
}

export default function ChargerMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);

  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceTime, setSourceTime] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<Charger | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const loadChargers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/chargers", { cache: "no-store" });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load charger data.");
      }
      if (!Array.isArray(payload.chargers)) {
        throw new Error("The charger service returned an unexpected response.");
      }
      setChargers(payload.chargers);
      setSourceTime(payload.fetchedAt || null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong while loading.";
      setLoadError(message);
      setChargers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChargers();
  }, [loadChargers]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: LAHORE_CENTER,
      zoom: 11.25,
      minZoom: 9,
      maxZoom: 19,
      maxBounds: [
        [73.72, 31.08],
        [74.93, 31.88],
      ],
      attributionControl: false,
      cooperativeGestures: true,
    });

    map.addControl(
      new NavigationControl({ showCompass: false, visualizePitch: false }),
      "top-right",
    );
    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: "EV locations © OpenStreetMap contributors",
      }),
      "bottom-right",
    );

    map.on("load", () => setMapReady(true));
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const visibleChargers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return chargers
      .filter((charger) => {
        if (filter === "DC" && charger.type !== "DC" && charger.type !== "AC/DC") return false;
        if (filter === "AC" && charger.type !== "AC" && charger.type !== "AC/DC") return false;
        if (!term) return true;
        const haystack = [
          charger.name,
          charger.operator,
          charger.address,
          charger.area,
          ...charger.connectors,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => {
        if (userLocation) return distanceKm(userLocation, a) - distanceKm(userLocation, b);
        return (b.powerKw ?? 0) - (a.powerKw ?? 0) || a.name.localeCompare(b.name);
      });
  }, [chargers, filter, search, userLocation]);

  const stats = useMemo(() => {
    const dc = chargers.filter((charger) => charger.type === "DC" || charger.type === "AC/DC").length;
    const ac = chargers.filter((charger) => charger.type === "AC" || charger.type === "AC/DC").length;
    const powerKnown = chargers.filter((charger) => charger.powerKw !== null).length;
    return { total: chargers.length, dc, ac, powerKnown };
  }, [chargers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = visibleChargers.map((charger) => {
      const element = document.createElement("button");
      const tone =
        charger.type === "DC" || charger.type === "AC/DC"
          ? "pin-dc"
          : charger.type === "AC"
            ? "pin-ac"
            : "pin-unknown";
      element.type = "button";
      element.className = `map-pin ${tone}${selected?.id === charger.id ? " map-pin-selected" : ""}`;
      element.setAttribute("aria-label", `Select ${charger.name}`);
      element.setAttribute("title", charger.name);
      element.innerHTML = "<span></span>";
      element.addEventListener("click", () => {
        setSelected(charger);
      });
      return new MapLibreMarker({ element, anchor: "center" })
        .setLngLat([charger.lon, charger.lat])
        .addTo(map);
    });
  }, [visibleChargers, mapReady, selected]);

  useEffect(() => {
    if (!selected || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [selected.lon, selected.lat],
      zoom: Math.max(mapRef.current.getZoom(), 14.2),
      speed: 1.15,
      curve: 1.35,
      essential: true,
    });
  }, [selected]);

  const handleLocate = () => {
    if (!("geolocation" in navigator)) {
      setLocationMessage("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setUserLocation(nextLocation);
        mapRef.current?.flyTo({
          center: [nextLocation.lon, nextLocation.lat],
          zoom: 13.4,
          speed: 1.1,
          essential: true,
        });
        setLocating(false);
      },
      () => {
        setLocationMessage("Location permission was unavailable. You can still explore the map.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handleExport = () => {
    const geojson = {
      type: "FeatureCollection",
      name: "Lahore EV charging stations",
      features: visibleChargers.map((charger) => ({
        type: "Feature",
        id: charger.id,
        geometry: {
          type: "Point",
          coordinates: [charger.lon, charger.lat],
        },
        properties: {
          name: charger.name,
          operator: charger.operator,
          charger_type: charger.type,
          power_kw: charger.powerKw,
          connectors: charger.connectors,
          area: charger.area,
          address: charger.address,
          access: charger.access,
          opening_hours: charger.openingHours,
          source: "OpenStreetMap",
          osm_url: charger.osmUrl,
        },
      })),
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lahore-ev-chargers.geojson";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const focusLahore = () => {
    mapRef.current?.flyTo({
      center: LAHORE_CENTER,
      zoom: 11.25,
      speed: 1.15,
      essential: true,
    });
    setSelected(null);
  };

  const updatedLabel = sourceTime
    ? new Intl.DateTimeFormat("en-PK", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(sourceTime))
    : null;

  return (
    <div className="explorer-layout">
      <aside className="explorer-panel" aria-label="Charger search and directory">
        <div className="explorer-scroll">
          <div className="eyebrow"><span className="eyebrow-dot" /> LAHORE · PAKISTAN</div>
          <h1 className="hero-title">
            Find your<br />
            next <span>charge.</span>
          </h1>
          <p className="hero-description">
            Your city, fully charged. Explore mapped EV charging points across Lahore.
          </p>

          <div className="stats-grid" aria-label="Mapped charger statistics">
            <div className="stat-card stat-primary">
              <span className="stat-number">{loading ? "—" : stats.total}</span>
              <span className="stat-label">Mapped stations</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{loading ? "—" : stats.dc}</span>
              <span className="stat-label">DC capable</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{loading ? "—" : stats.ac}</span>
              <span className="stat-label">AC capable</span>
            </div>
          </div>

          <div className="search-block">
            <label className="search-label" htmlFor="charger-search">EXPLORE CHARGERS</label>
            <div className="search-field">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="m16 16 4.2 4.2" />
              </svg>
              <input
                id="charger-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search area, station or operator"
                autoComplete="off"
              />
              {search ? (
                <button type="button" className="clear-search" onClick={() => setSearch("")} aria-label="Clear search">
                  ×
                </button>
              ) : null}
            </div>
            <div className="filter-row" aria-label="Filter chargers by type">
              {(["ALL", "DC", "AC"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`filter-chip ${filter === value ? "filter-chip-active" : ""}`}
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                >
                  {value === "ALL" ? "All chargers" : `${value} charging`}
                </button>
              ))}
            </div>
          </div>

          <div className="directory-heading">
            <div>
              <span className="section-kicker">THE NETWORK</span>
              <h2>Charging points</h2>
            </div>
            <span className="result-count">{loading ? "…" : visibleChargers.length.toString().padStart(2, "0")} <span>shown</span></span>
          </div>

          {loading ? (
            <div className="loading-list" aria-live="polite">
              <div className="loading-line" />
              <div className="loading-line" />
              <div className="loading-line" />
            </div>
          ) : loadError ? (
            <div className="empty-state empty-error" role="alert">
              <span className="empty-icon">!</span>
              <strong>Couldn’t reach the charger directory</strong>
              <p>{loadError}</p>
              <button type="button" className="text-action" onClick={() => void loadChargers()}>
                Try again <span aria-hidden="true">↗</span>
              </button>
            </div>
          ) : visibleChargers.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><PinIcon /></span>
              <strong>{chargers.length === 0 ? "No mapped stations returned" : "No matching stations"}</strong>
              <p>
                {chargers.length === 0
                  ? "There may be chargers that have not yet been added to OpenStreetMap. Check the community directories or help map one."
                  : "Try another search or switch the charger filter."}
              </p>
              {search || filter !== "ALL" ? (
                <button type="button" className="text-action" onClick={() => { setSearch(""); setFilter("ALL"); }}>
                  Clear filters <span aria-hidden="true">↗</span>
                </button>
              ) : null}
            </div>
          ) : (
            <div className="station-list" aria-live="polite">
              {visibleChargers.map((charger) => (
                <ChargerCard
                  key={charger.id}
                  charger={charger}
                  selected={selected?.id === charger.id}
                  userLocation={userLocation}
                  onClick={() => setSelected(charger)}
                />
              ))}
            </div>
          )}

          <div className="directory-links">
            <span className="section-kicker">MORE WAYS TO FIND A CHARGE</span>
            <a href="https://evlink.pk/map/?city=lahore" target="_blank" rel="noreferrer">
              EV Link Lahore directory <span aria-hidden="true">↗</span>
            </a>
            <a href="https://chargepk.com/ev-charging-stations-lahore.html" target="_blank" rel="noreferrer">
              ChargePK Lahore directory <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <div className="export-panel">
          <div className="export-copy">
            <span className="export-symbol">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
              </svg>
            </span>
            <span>
              <strong>Take your data further</strong>
              <small>Export this view for RustGIS analysis.</small>
            </span>
          </div>
          <div className="export-actions">
            <button
              type="button"
              className="export-button"
              onClick={handleExport}
              disabled={loading || visibleChargers.length === 0}
            >
              Export GeoJSON <span aria-hidden="true">↓</span>
            </button>
            <a className="rustgis-link" href="https://web.rustgis.app/" target="_blank" rel="noreferrer">
              Open RustGIS ↗
            </a>
          </div>
        </div>
      </aside>

      <section className="map-panel" aria-label="Interactive map of Lahore EV charging stations">
        <div ref={mapContainerRef} className="map-canvas" />
        <div className="map-top-overlay">
          <div className="map-status-card">
            <span className="map-status-icon"><PinIcon /></span>
            <span>
              <strong>LAHORE NETWORK MAP</strong>
              <small>{loading ? "Loading public map data…" : loadError ? "Data source unavailable" : `${stats.total} mapped locations`}</small>
            </span>
          </div>
          <div className="map-action-group">
            <button type="button" className="map-action-button" onClick={focusLahore}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v3m0 12v3M3 12h3m12 0h3M7 7l2 2m6 6 2 2m0-10-2 2m-6 6-2 2" />
                <circle cx="12" cy="12" r="5" />
              </svg>
              Lahore
            </button>
            <button type="button" className="map-action-button map-action-locate" onClick={handleLocate} disabled={locating}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="2" />
                <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
              </svg>
              {locating ? "Locating…" : "Near me"}
            </button>
          </div>
        </div>

        {locationMessage ? (
          <div className="map-message" role="status">
            {locationMessage}
            <button type="button" onClick={() => setLocationMessage(null)} aria-label="Dismiss message">×</button>
          </div>
        ) : null}

        {!mapReady ? (
          <div className="map-loading" aria-live="polite">
            <span className="map-loading-pulse" />
            <span>Preparing the city map…</span>
          </div>
        ) : null}

        <div className="map-bottom-left">
          {selected ? (
            <div className="selected-station-card">
              <button type="button" className="selected-close" onClick={() => setSelected(null)} aria-label="Close station details">×</button>
              <span className="selected-kicker">SELECTED CHARGER</span>
              <strong>{selected.name}</strong>
              <span className="selected-meta">
                {chargerKindLabel(selected.type)} · {powerLabel(selected.powerKw)}
              </span>
              <span className="selected-meta">{selected.area || selected.address || "Location mapped in Lahore"}</span>
              <span className="selected-actions">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lon}&travelmode=driving`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get directions ↗
                </a>
                <a href={selected.osmUrl} target="_blank" rel="noreferrer">OSM record ↗</a>
              </span>
            </div>
          ) : (
            <div className="map-hint-card">
              <span className="map-hint-dot" />
              Select a pin to view station details
            </div>
          )}
        </div>

        <div className="map-bottom-right">
          <span className="legend-item"><i className="legend-dot legend-dc" /> DC fast</span>
          <span className="legend-item"><i className="legend-dot legend-ac" /> AC</span>
          <span className="legend-item"><i className="legend-dot legend-unknown" /> Unspecified</span>
        </div>

        <div className="map-footnote">
          <span>DATA FROM OPENSTREETMAP</span>
          <span>{updatedLabel ? `Retrieved ${updatedLabel}` : "Community mapped · not live status"}</span>
        </div>
      </section>
    </div>
  );
}
