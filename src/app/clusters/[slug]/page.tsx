import Link from "next/link";
import { notFound } from "next/navigation";
import { getCluster, CLUSTERS } from "@/data/clusters";
import { getClusterWithImage, getPropertiesByCluster } from "@/lib/repo";
import PropertyCardWrapper from "@/components/PropertyCardWrapper";
import ClusterImage from "@/components/ClusterImage";
import type { ClusterSlug } from "@/types";

export async function generateStaticParams() {
  return CLUSTERS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const cluster = getCluster(params.slug);
  if (!cluster) return {};
  return {
    title: `${cluster.name} · curateIndia`,
    description: cluster.description,
  };
}

export default async function ClusterPage({ params }: { params: { slug: string } }) {
  const cluster = getClusterWithImage(params.slug as ClusterSlug);
  if (!cluster) notFound();

  const properties = await getPropertiesByCluster(params.slug as ClusterSlug);

  return (
    <main className="min-h-screen">
      {/* HERO */}
      <section className="relative h-[45vh] sm:h-[55vh] lg:h-[60vh] min-h-[320px] sm:min-h-[400px] flex items-end overflow-hidden">
        <ClusterImage
          imageUrl={cluster.imageUrl}
          query={`${cluster.name} india ${cluster.tagline}`}
          alt={cluster.name}
          className="absolute inset-0"
        />
        <div className={`absolute inset-0 bg-gradient-to-t ${cluster.accent}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/30 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pb-12 w-full">
          <Link href="/" className="text-xs uppercase tracking-[0.3em] text-spice-400 mb-4 inline-block">
            ← All experiences
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{cluster.icon}</span>
            <span className="text-xs uppercase tracking-[0.3em] text-sand-400">
              {properties.length} {properties.length === 1 ? "stay" : "stays"} curated
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl lg:text-7xl text-balance leading-[1.05]">
            {cluster.name}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-foreground/80 max-w-2xl text-balance">
            {cluster.description}
          </p>
        </div>
      </section>

      {/* GRID */}
      <section className="px-5 sm:px-8 py-12">
        <div className="max-w-7xl mx-auto">
          {properties.length === 0 ? (
            <div className="text-muted text-sm">
              We&apos;re still curating stays in this cluster. Check back soon.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {properties.map((p) => (
                <PropertyCardWrapper key={p.id} property={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* OTHER CLUSTERS */}
      <section className="px-5 sm:px-8 py-16 border-t border-hairline">
        <div className="max-w-7xl mx-auto">
          <div className="text-xs uppercase tracking-[0.3em] text-spice-400 mb-6">
            Or explore
          </div>
          <div className="flex flex-wrap gap-3">
            {CLUSTERS.filter((c) => c.slug !== cluster.slug).map((c) => (
              <Link
                key={c.slug}
                href={`/clusters/${c.slug}`}
                className="text-sm px-4 py-2 rounded-full bg-ink-800 hover:bg-ink-700 border border-hairline transition-colors"
              >
                {c.icon} {c.shortName}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
