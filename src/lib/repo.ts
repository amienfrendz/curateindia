// Single source of truth for property reads.
// Today: static TS file. Tomorrow: Firestore/Cosmos — only this file changes.
import { PROPERTIES as RAW } from "@/data/properties";
import { CLUSTERS } from "@/data/clusters";
import propertyImages from "@/data/property-images.json";
import clusterImages from "@/data/cluster-images.json";
import type { Cluster, ClusterSlug, Property } from "@/types";

const TODAY = new Date().toISOString().slice(0, 10);

const PROP_IMG = propertyImages as Record<string, string>;
const CLUSTER_IMG = clusterImages as Record<string, string>;

function hydrate(p: Property): Property {
  return {
    addedAt: TODAY,
    lastVerified: TODAY,
    source: "editorial",
    status: "active",
    ...p,
    imageUrl: p.imageUrl || PROP_IMG[p.slug] || undefined,
  };
}

// Comma-separated batch names to disable (e.g. "jun-2026,jul-2026")
const DISABLED_BATCHES = (process.env.DISABLE_BATCHES || "").split(",").filter(Boolean);

const ALL = RAW.map(hydrate).filter(
  (p) => !p.batch || !DISABLED_BATCHES.includes(p.batch)
);

export async function getAllProperties(): Promise<Property[]> {
  return ALL.filter((p) => p.status === "active");
}

export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  return ALL.find((p) => p.slug === slug && p.status === "active") ?? null;
}

export async function getPropertiesByCluster(slug: ClusterSlug): Promise<Property[]> {
  return ALL.filter((p) => p.clusters.includes(slug) && p.status === "active");
}

export async function getFeaturedProperties(limit = 9): Promise<Property[]> {
  const dayIndex = Math.floor(Date.now() / 86400000);
  const seen = new Set<ClusterSlug>();
  const featured: Property[] = [];
  const shuffled = [...ALL].sort((a, b) => {
    return ((a.id + dayIndex).localeCompare(b.id + dayIndex));
  });
  for (const p of shuffled) {
    const c = p.clusters[0];
    if (!seen.has(c)) {
      seen.add(c);
      featured.push(p);
      if (featured.length >= limit) break;
    }
  }
  return featured;
}

export function totalCount(): number {
  return ALL.length;
}

export function lastUpdatedAt(): string {
  return ALL.reduce(
    (acc, p) => (p.lastVerified && p.lastVerified > acc ? p.lastVerified : acc),
    "1970-01-01"
  );
}

export function getClusterWithImage(slug: ClusterSlug): Cluster | undefined {
  const c = CLUSTERS.find((c) => c.slug === slug);
  if (!c) return undefined;
  return { ...c, imageUrl: c.imageUrl || CLUSTER_IMG[slug] };
}

export function getAllClustersWithImages(): Cluster[] {
  return CLUSTERS.map((c) => ({ ...c, imageUrl: c.imageUrl || CLUSTER_IMG[c.slug] }));
}
