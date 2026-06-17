import Link from "next/link";
import { notFound } from "next/navigation";
import { getPropertyBySlug, getAllProperties } from "@/lib/repo";
import { getCluster } from "@/data/clusters";
import { buildBookingLinks, getGoogleMapsUrl } from "@/lib/bookingLinks";
import PropertyImage from "@/components/PropertyImage";
import PropertyCard from "@/components/PropertyCard";
import ReviewsPanel from "@/components/ReviewsPanel";
import AvailabilityBadge from "@/components/AvailabilityBadge";
import ShareButton from "@/components/ShareButton";
import pricingData from "@/data/property-pricing.json";
import reviewsData from "@/data/property-reviews.json";

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
  const mapsUrl = getGoogleMapsUrl(property);
  const all = await getAllProperties();
  const related = all
    .filter(
      (p) =>
        p.id !== property.id &&
        p.clusters.some((c) => property.clusters.includes(c))
    )
    .slice(0, 4);

  const reviewEntry = (reviewsData as Record<string, { rating: number | null; ratingCount: number }>)[property.slug];
  const rating = reviewEntry?.rating;
  const ratingCount = reviewEntry?.ratingCount;

  return (
    <main className="min-h-screen pb-20">
      {/* HERO */}
      <section className="relative h-[40vh] sm:h-[55vh] lg:h-[70vh] min-h-[280px] sm:min-h-[400px] overflow-hidden">
        <PropertyImage
          imageUrl={property.imageUrl}
          website={property.website}
          query={`${property.name} ${property.location} ${property.type}`}
          alt={property.name}
          className="absolute inset-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 px-4 sm:px-8 pb-6 sm:pb-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
              {property.clusters.map((slug) => {
                const c = getCluster(slug);
                if (!c) return null;
                return (
                  <Link
                    key={slug}
                    href={`/clusters/${slug}`}
                    className="text-[10px] sm:text-xs uppercase tracking-wider px-2 sm:px-3 py-1 sm:py-1.5 rounded-full glass hover:bg-ink-700 transition-colors"
                  >
                    {c.icon} {c.shortName}
                  </Link>
                );
              })}
            </div>
            <h1 className="font-display text-2xl sm:text-5xl lg:text-7xl text-balance leading-[1.1] max-w-4xl">
              {property.name}
            </h1>
            <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-2">
              <span className="text-xs sm:text-base text-foreground/80">
                {property.location} · {property.state} ·{" "}
                <span className="text-spice-400">{property.priceTier}</span>
              </span>
              {/* Action buttons: Share + Directions */}
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <ShareButton name={property.name} slug={property.slug} />
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-ink-800 hover:bg-ink-700 border border-hairline transition-colors"
                    title="Get directions"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                      <circle cx="12" cy="9" r="2.5"/>
                    </svg>
                    Directions
                  </a>
                )}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* BODY */}
      <section className="px-4 sm:px-8 py-8 sm:py-12">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr,360px] gap-8 sm:gap-10">
          {/* LEFT */}
          <div className="space-y-8 sm:space-y-12">
            {/* Quick facts */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Fact label="Type" value={property.type} />
              {property.rooms && <Fact label="Rooms" value={`${property.rooms}`} />}
              <Fact label="Region" value={property.region} />
              {rating && (
                <Fact label="Rating" value={`★ ${rating}${ratingCount ? ` (${ratingCount.toLocaleString()})` : ""}`} />
              )}
              <Fact label="Approx. rate" value={getPriceRange(property.slug, property.priceTier)} />
              {getPriceIncludes(property.slug) && (
                <Fact label="Includes" value={getPriceIncludes(property.slug)!} />
              )}
            </div>

            {/* Blurb */}
            <p className="font-display text-xl sm:text-2xl lg:text-3xl text-balance leading-snug">
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
                    className="flex gap-3 sm:gap-4 text-sm sm:text-base leading-relaxed animate-slide-up"
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
                <p className="text-base sm:text-lg leading-relaxed text-foreground/90 max-w-2xl">
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
                <p className="text-base sm:text-lg leading-relaxed text-foreground/90 max-w-2xl font-display italic">
                  {property.host}
                </p>
              </div>
            )}

            {/* Reviews */}
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-spice-400 mb-4">
                What guests say
              </div>
              <ReviewsPanel propertySlug={property.slug} />
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
        <section className="px-4 sm:px-8 py-10 sm:py-16 border-t border-hairline">
          <div className="max-w-6xl mx-auto">
            <div className="text-xs uppercase tracking-[0.3em] text-spice-400 mb-2">
              You might also love
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl mb-6 sm:mb-8">Similar curations</h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
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
    <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-hairline bg-ink-800/50">
      <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-faint">{label}</div>
      <div className="text-xs sm:text-sm capitalize">{value}</div>
    </div>
  );
}

function getPriceRange(slug: string, tier: string): string {
  const pricing = (pricingData as Record<string, { lowINR: number; highINR: number; basis: string; includes: string }>)[slug];
  if (pricing) {
    const low = pricing.lowINR >= 1000 ? `₹${Math.round(pricing.lowINR / 1000)}k` : `₹${pricing.lowINR}`;
    const high = pricing.highINR >= 1000 ? `₹${Math.round(pricing.highINR / 1000)}k` : `₹${pricing.highINR}`;
    return `${low}–${high}/night`;
  }
  switch (tier) {
    case "₹": return "₹500–₹2,500/night";
    case "₹₹": return "₹2,500–₹8,000/night";
    case "₹₹₹": return "₹8,000–₹20,000/night";
    case "₹₹₹₹": return "₹20,000–₹60,000+/night";
    default: return tier;
  }
}

function getPriceIncludes(slug: string): string | null {
  const pricing = (pricingData as Record<string, { lowINR: number; highINR: number; basis: string; includes: string }>)[slug];
  return pricing?.includes || null;
}
