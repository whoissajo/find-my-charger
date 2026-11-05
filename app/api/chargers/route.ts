import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 1800;
export const maxDuration = 30;

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type Charger = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: "AC" | "DC" | "AC/DC" | "Unknown";
  powerKw: number | null;
  connectors: string[];
  operator: string | null;
  address: string | null;
  area: string | null;
  access: string | null;
  openingHours: string | null;
  osmUrl: string;
};

const LAHORE_BBOX = "31.20,74.00,31.70,74.60";
const OVERPASS_QUERY = `[out:json][timeout:25];
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
): Charger["type"] {
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

function normalizeElement(element: OverpassElement): Charger | null {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;

  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < 31.0 ||
    lat > 31.9 ||
    lon < 73.8 ||
    lon > 74.9
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
    id: `${element.type}-${element.id}`,
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
    osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

export async function GET() {
  const upstreamErrors: string[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("data", OVERPASS_QUERY);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "LahoreEVFinder/1.0",
        },
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(14000),
      });

      if (!response.ok) {
        upstreamErrors.push(`${new URL(endpoint).hostname}: HTTP ${response.status}`);
        continue;
      }

      const payload = (await response.json()) as { elements?: OverpassElement[] };
      if (!Array.isArray(payload.elements)) {
        upstreamErrors.push(`${new URL(endpoint).hostname}: unexpected response`);
        continue;
      }

      const seen = new Set<string>();
      const chargers = payload.elements
        .map(normalizeElement)
        .filter((item): item is Charger => {
          if (!item || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        })
        .sort((a, b) => (b.powerKw ?? 0) - (a.powerKw ?? 0) || a.name.localeCompare(b.name));

      return NextResponse.json(
        {
          chargers,
          count: chargers.length,
          source: "OpenStreetMap via Overpass API",
          fetchedAt: new Date().toISOString(),
          coverage: "Publicly mapped charging stations in the Lahore search area",
        },
        {
          headers: {
            "Cache-Control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600",
          },
        },
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "request failed";
      upstreamErrors.push(`${new URL(endpoint).hostname}: ${reason}`);
    }
  }

  return NextResponse.json(
    {
      chargers: [],
      count: 0,
      source: "OpenStreetMap via Overpass API",
      fetchedAt: new Date().toISOString(),
      error: "The public map data service is temporarily unavailable. Please retry shortly.",
      diagnostics: upstreamErrors,
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
