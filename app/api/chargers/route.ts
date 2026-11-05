import { NextResponse } from "next/server";
import { STARTER_CHARGERS, type ChargerRecord } from "@/app/data/chargers";

export const runtime = "nodejs";
export const revalidate = 900;
export const maxDuration = 25;

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const LAHORE_BBOX = "31.20,74.00,31.70,74.60";
const OVERPASS_QUERY = `[out:json][timeout:15];
(
  node["amenity"="charging_station"](${LAHORE_BBOX});
  way["amenity"="charging_station"](${LAHORE_BBOX});
  relation["amenity"="charging_station"](${LAHORE_BBOX});
);
out center tags;`;

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const CONNECTOR_TAGS: Array<[string, string]> = [
  ["socket:type2_combo", "CCS2"],
  ["socket:ccs2", "CCS2"],
  ["socket:ccs", "CCS"],
  ["socket:chademo", "CHAdeMO"],
  ["socket:type2", "Type 2"],
  ["socket:type1", "Type 1"],
  ["socket:tesla_supercharger", "Tesla"],
  ["socket:schuko", "Schuko"],
  ["socket:gbt", "GB/T"],
];

function connectorList(tags: Record<string, string>): string[] {
  return CONNECTOR_TAGS
    .filter(([key]) => {
      const value = tags[key]?.trim().toLowerCase();
      return Boolean(value && value !== "no" && value !== "0" && value !== "false");
    })
    .map(([, label]) => label);
}

function powerValue(tags: Record<string, string>): number | null {
  const candidates = [
    tags["charging_station:output"],
    tags["socket:type2:output"],
    tags["socket:type2_combo:output"],
    tags["socket:ccs:output"],
    tags["socket:ccs2:output"],
    tags["socket:chademo:output"],
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const match = candidate.match(/(\d+(?:[.,]\d+)?)\s*kW/i);
    if (match) {
      const parsed = Number(match[1].replace(",", "."));
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1000) return parsed;
    }
  }
  return null;
}

function stationType(
  tags: Record<string, string>,
  connectors: string[],
): ChargerRecord["type"] {
  const output = [
    tags["charging_station:output"],
    tags["socket:type2:output"],
    tags["socket:ccs:output"],
    tags["socket:chademo:output"],
  ].filter(Boolean).join(" ").toUpperCase();

  const hasDc = /\bDC\b/.test(output) ||
    connectors.some((item) => /CCS|CHADEMO|TESLA/i.test(item));
  const hasAc = /\bAC\b/.test(output) ||
    connectors.some((item) => /TYPE 1|TYPE 2|SCHUKO|GB\/T/i.test(item));

  if (hasDc && hasAc) return "AC/DC";
  if (hasDc) return "DC";
  if (hasAc) return "AC";
  return "Unknown";
}

function normalizeElement(element: OverpassElement): ChargerRecord | null {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;

  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < 31.0 || lat > 31.9 || lon < 73.8 || lon > 74.9
  ) {
    return null;
  }

  const connectors = connectorList(tags);
  const streetLine = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
  ].filter(Boolean).join(", ");

  return {
    id: `osm-${element.type}-${element.id}`,
    name: tags.name || tags.brand || tags.operator || "EV charging station",
    lat,
    lon,
    type: stationType(tags, connectors),
    powerKw: powerValue(tags),
    connectors,
    operator: tags.operator || tags.network || tags.brand || null,
    address: tags["addr:full"] || streetLine || null,
    area: tags["addr:suburb"] || tags["addr:neighbourhood"] ||
      tags["addr:district"] || tags["addr:city"] || null,
    access: tags.access || null,
    openingHours: tags.opening_hours || null,
    source: "OpenStreetMap",
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    reportedStatus: null,
    osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

function mergeChargers(live: ChargerRecord[]): ChargerRecord[] {
  const combined = [...STARTER_CHARGERS];

  for (const charger of live) {
    const duplicate = combined.some((existing) => {
      const latDistance = Math.abs(existing.lat - charger.lat);
      const lonDistance = Math.abs(existing.lon - charger.lon);
      const sameName = existing.name.toLowerCase() === charger.name.toLowerCase();
      return sameName && latDistance < 0.001 && lonDistance < 0.001;
    });
    if (!duplicate) combined.push(charger);
  }

  return combined.sort((a, b) =>
    (b.powerKw ?? 0) - (a.powerKw ?? 0) || a.name.localeCompare(b.name),
  );
}

async function fetchLiveChargers(): Promise<{ chargers: ChargerRecord[]; endpoint: string }> {
  const failures: string[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("data", OVERPASS_QUERY);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "LahoreEVFinder/1.1 (https://github.com/whoissajo/find-my-charger)",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(7500),
      });

      if (!response.ok) {
        failures.push(`${url.hostname}: HTTP ${response.status}`);
        continue;
      }

      const payload = (await response.json()) as { elements?: OverpassElement[] };
      if (!Array.isArray(payload.elements)) {
        failures.push(`${url.hostname}: unexpected response`);
        continue;
      }

      const seen = new Set<string>();
      const chargers = payload.elements
        .map(normalizeElement)
        .filter((item): item is ChargerRecord => {
          if (!item || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      return { chargers, endpoint: url.hostname };
    } catch (error) {
      failures.push(
        `${new URL(endpoint).hostname}: ${error instanceof Error ? error.message : "request failed"}`,
      );
    }
  }

  throw new Error(failures.join(" | ") || "No OpenStreetMap data endpoint responded.");
}

export async function GET() {
  try {
    const live = await fetchLiveChargers();
    const chargers = mergeChargers(live.chargers);
    return NextResponse.json(
      {
        chargers,
        count: chargers.length,
        liveCount: live.chargers.length,
        source: "OpenStreetMap + Open Charge Map",
        liveSource: live.endpoint,
        fetchedAt: new Date().toISOString(),
        usingFallback: live.chargers.length === 0,
        note: live.chargers.length === 0
          ? "Showing published Lahore records while OpenStreetMap has no additional mapped stations in this search area."
          : "Community map records are combined with published charger listings.",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=1800",
        },
      },
    );
  } catch (error) {
    const chargers = mergeChargers([]);
    return NextResponse.json(
      {
        chargers,
        count: chargers.length,
        liveCount: 0,
        source: "Open Charge Map fallback",
        fetchedAt: new Date().toISOString(),
        usingFallback: true,
        note: "The live OpenStreetMap service is temporarily unavailable. Showing published Lahore charger records instead.",
        warning: error instanceof Error ? error.message : "OpenStreetMap is temporarily unavailable.",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=1800",
        },
      },
    );
  }
}
