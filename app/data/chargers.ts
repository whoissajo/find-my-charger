export type ChargerType = "AC" | "DC" | "AC/DC" | "Unknown";

export type ChargerRecord = {
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
  source: "OpenStreetMap" | "Open Charge Map";
  sourceUrl: string;
  reportedStatus: string | null;
  osmUrl?: string;
};

/**
 * Curated Lahore entries with published coordinates from Open Charge Map.
 * These are fallback records so the first screen remains useful even if
 * Overpass is temporarily unavailable. Their reported status is not live.
 */
export const STARTER_CHARGERS: ChargerRecord[] = [
  {
    id: "ocm-498562",
    name: "Total EV Charging Station",
    lat: 31.51696318509223,
    lon: 74.35249662944645,
    type: "DC",
    powerKw: 120,
    connectors: ["CCS2 · 120 kW"],
    operator: "HUBCO Green",
    address: "MM Alam Road, Block B1",
    area: "Gulberg III",
    access: "Public · Pay at location",
    openingHours: null,
    source: "Open Charge Map",
    sourceUrl: "https://openchargemap.org/poi/details/498562",
    reportedStatus: "Operational · source-reported",
  },
  {
    id: "ocm-475594",
    name: "HUBCO Green · Total Parco",
    lat: 31.505640968650813,
    lon: 74.34909998837318,
    type: "DC",
    powerKw: 120,
    connectors: ["CCS2 · 120 kW"],
    operator: "HUBCO Green",
    address: "MM Alam Road",
    area: "Gulberg III",
    access: "Public · Pay at location",
    openingHours: null,
    source: "Open Charge Map",
    sourceUrl: "https://openchargemap.io/poi/details/475594",
    reportedStatus: "Operational · source-reported",
  },
  {
    id: "ocm-478137",
    name: "Go Green Avenue Charging Station",
    lat: 31.47173538135366,
    lon: 74.35603842888437,
    type: "AC/DC",
    powerKw: 120,
    connectors: ["CCS2 · 120 kW", "Type 2 · 22 kW"],
    operator: null,
    address: "Packages Mall, Entrance 3",
    area: "Packages Mall",
    access: "Public · Pay at location",
    openingHours: null,
    source: "Open Charge Map",
    sourceUrl: "https://openchargemap.org/poi/details/478137",
    reportedStatus: "Operational · source-reported",
  },
  {
    id: "ocm-478374",
    name: "EV Charger · Packages Mall",
    lat: 31.472972368570154,
    lon: 74.3558336459774,
    type: "DC",
    powerKw: 50,
    connectors: ["CCS2 · 50 kW"],
    operator: null,
    address: "Packages Mall, Nishtar Town",
    area: "Packages Mall",
    access: "Public · Pay at location",
    openingHours: "10:00 AM – 10:00 PM",
    source: "Open Charge Map",
    sourceUrl: "https://openchargemap.io/poi/details/478374",
    reportedStatus: "Operational · source-reported",
  },
  {
    id: "ocm-480716",
    name: "Mall of Lahore",
    lat: 31.52929538531833,
    lon: 74.37872389999885,
    type: "DC",
    powerKw: 180,
    connectors: ["CCS2 · 180 kW"],
    operator: null,
    address: "172 Tufail Road",
    area: "Lahore Cantt",
    access: "Public · Membership required",
    openingHours: null,
    source: "Open Charge Map",
    sourceUrl: "https://openchargemap.org/poi/details/480716",
    reportedStatus: "Operational · source-reported",
  },
];
