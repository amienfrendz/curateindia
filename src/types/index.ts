export type ClusterSlug =
  | "wildlife-birding-photography"
  | "art-craft"
  | "plantation-experiences"
  | "culinary-immersion"
  | "heritage-cultural"
  | "spirituality"
  | "wellness-ayurveda"
  | "trekking-adventure"
  | "tribal-village-life"
  | "slow-living-sustainability"
  | "marine-water-living"
  | "astronomy-stargazing"
  | "festivals-seasonal"
  | "music-dance";

export type Cluster = {
  slug: ClusterSlug;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  icon: string;
  accent: string;
  unsplashId: string;
  imageUrl?: string; // resolved from sidecar or LLM enrichment
};

export type PropertyType =
  | "haveli"
  | "villa"
  | "bungalow"
  | "cottage"
  | "hut"
  | "homestay"
  | "houseboat"
  | "farmstay"
  | "estate"
  | "ashram"
  | "treehouse";

export type PropertySource = "editorial" | "aggregator" | "host-submitted" | "community" | "llm-discovery";
export type PropertyStatus = "active" | "dormant" | "closed" | "candidate";

export type Property = {
  id: string;
  slug: string;
  name: string;
  type: PropertyType;
  location: string;
  state: string;
  region:
    | "Himalayas"
    | "North"
    | "Northeast"
    | "Central"
    | "West"
    | "South"
    | "East"
    | "Coast"
    | "Islands"
    | "Ladakh-Spiti";
  rooms?: number;
  clusters: ClusterSlug[];
  signatureExperiences: string[];
  food?: string;
  host?: string;
  priceTier: "₹" | "₹₹" | "₹₹₹" | "₹₹₹₹";
  blurb: string;
  website?: string;
  unsplashId: string;
  imageUrl?: string; // resolved hero image — set by enrichment or editorially
  // ── future-DB fields (defaulted by the repo layer for now) ─────────────
  addedAt?: string;          // ISO date
  lastVerified?: string;     // ISO date — for freshness badges
  source?: PropertySource;
  status?: PropertyStatus;
};

export type SearchHit = {
  propertyId: string;
  reason: string;
  matchScore: number;
};

export type AvailabilityResult = {
  status: "likely-available" | "limited" | "likely-full" | "unknown";
  note: string;
  sources: { label: string; url: string }[];
  fetchedAt: string;
};

export type ReviewSummary = {
  highlights: string[];
  quotes: { text: string; source: string; sourceUrl?: string }[];
  sentiment: "raves" | "loved" | "mixed" | "limited";
  fetchedAt: string;
};
