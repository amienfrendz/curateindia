import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPropertyBySlug, getAllProperties } from "@/lib/repo";
import { getCluster } from "@/data/clusters";
import { buildBookingLinks } from "@/lib/bookingLinks";
import PropertyImage from "@/components/PropertyImage";
import PropertyCard from "@/components/PropertyCard";
import ReviewsPanel from "@/components/ReviewsPanel";
import AvailabilityBadge from "@/components/AvailabilityBadge";
import { SkeletonReviewBlock } from "@/components/Skeletons";

export async function generateStaticParams() {
  const all = await getAllProperties();
  return all.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const p = await getPropertyBySlug(params.slug);
  if (!p) return {};
  return {
    title: `${p.name} · curateIndia`,
    description: p.blurb,
  };
}

export default async function StayPage({ params }: { params: { slug: string } }) {
  const property = await getPropertyBySlug(params.slug);
  if (!property) notFound();

  const links = buildBookingLinks(property);
  const all = await getAllProperties();
  const related = all
    .filter(
      (p) =>
        p.id !== property.id &&
        p.clusters.some((c) => property.clusters.includes(c))
    )
    .slice(0, 4);

  return (
    <main className="min-h-screen pb-20">
      {/* HERO */}
      <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
        <PropertyImage
          imageUrl={property.imageUrl}
          website={property.website}
          query={`${property.name} ${property.location} ${property.type}`}
          alt={property.name}
          className="absolute inset-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 px-5 sm:px-8 pb-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap gap-2 mb-4">
              {property.clusters.map((slug) => {
                const c = getCluster(slug);
                if (!c) return null;
                return (
                  <Link
                    key={slug}
                    href={`/clusters/${slug}`}
                    className="text-xs uppercase tracking-wider px-3 py-1.5 rounded-full glass hover:bg-ink-700 transition-colors"
                  >
                    {c.icon} {c.shortName}
                  </Link>
                );
              })}
            </div>
            <h1 className="font-display text-5xl sm:text-7xl text-balance leading-[1.05] max-w-4xl">
              {property.name}
            </h1>
            <div className="mt-3 text-base text-foreground/80">
              {property.location} · {property.state} ·{" "}
              <span className="text-spice-400">{property.priceTier}</span>
            </div>
          </div>
        </div>
      </section>

      {/* BODY */}
      <section className="px-5 sm:px-8 py-12">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr,360px] gap-10">
          {/* LEFT */}
          <div className="space-y-12">
            {/* Quick facts */}
            <div className="flex flex-wrap gap-3">
              <Fact label="Type" value={property.type} />
              {property.rooms && <Fact label="Rooms" value={`${property.rooms}`} />}
              <Fact label="Region" value={property.region} />
              {property.host && <Fact label="Host" value={property.host} />}
              <Fact label="Approx. rate" value={getPriceRange(property.priceTier)} />
            </div>

            {/* Blurb */}
            <p className="font-display text-2xl sm:text-3xl text-balance leading-snug">
              {property.blurb}
            </p>

            {/* Signature experiences */}
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-spice-400 mb-4">
                Signature experiences
              </div>
              <ul className="space-y-3">
                {property.signatureExperiences.map((exp, i) => (
                  <li
                    key={i}
                    className="flex gap-4 text-base leading-relaxed animate-slide-up"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className="text-sand-400 font-display text-2xl leading-none mt-0.5">
                      ·
                    </span>
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Food */}
            {property.food && (
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-spice-400 mb-3">
                  At the table
                </div>
                <p className="text-lg leading-relaxed text-foreground/90 max-w-2xl">
                  {property.food}
                </p>
              </div>
            )}

            {/* Host */}
            {property.host && (
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-spice-400 mb-3">
                  Hosted by
                </div>
                <p className="text-lg leading-relaxed text-foreground/90 max-w-2xl font-display italic">
                  {property.host}
                </p>
              </div>
            )}

            {/* Reviews */}
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-spice-400 mb-4">
                What guests say
              </div>
              <Suspense
                fallback={
                  <div className="space-y-6">
                    <SkeletonReviewBlock />
                    <SkeletonReviewBlock />
                  </div>
                }
              >
                <ReviewsPanel propertySlug={property.slug} />
              </Suspense>
            </div>
          </div>

          {/* RIGHT — sticky booking */}
          <aside className="lg:sticky lg:top-24 lg:self-start space-y-4">
            <AvailabilityBadge propertySlug={property.slug} bookingLinks={links} />
          </aside>
        </div>
      </section>

      {/* RELATED */}
      {related.length > 0 && (
        <section className="px-5 sm:px-8 py-16 border-t border-hairline">
          <div className="max-w-6xl mx-auto">
            <div className="text-xs uppercase tracking-[0.3em] text-spice-400 mb-2">
              You might also love
            </div>
            <h2 className="font-display text-3xl sm:text-4xl mb-8">Similar curations</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {related.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2 rounded-xl border border-hairline bg-ink-800/50">
      <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
      <div className="text-sm capitalize">{value}</div>
    </div>
  );
}

function getPriceRange(tier: string): string {
  switch (tier) {
    case "₹": return "₹500–₹2,500/night";
    case "₹₹": return "₹2,500–₹8,000/night";
    case "₹₹₹": return "₹8,000–₹20,000/night";
    case "₹₹₹₹": return "₹20,000–₹60,000+/night";
    default: return tier;
  }
}
