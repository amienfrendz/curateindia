import Link from "next/link";
import { Suspense } from "react";
import ClusterTile from "@/components/ClusterTile";
import PropertyCard from "@/components/PropertyCard";
import ConversationalSearch from "@/components/ConversationalSearch";
import { SkeletonCard, SkeletonClusterTile } from "@/components/Skeletons";
import { getAllClustersWithImages, getFeaturedProperties } from "@/lib/repo";

async function FeaturedGrid() {
  const featured = await getFeaturedProperties(12);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {featured.map((p) => (
        <PropertyCard key={p.id} property={p} />
      ))}
    </div>
  );
}

export default function Home() {
  const clusters = getAllClustersWithImages();
  return (
    <main className="min-h-screen">
      {/* HERO */}
      <section className="relative pt-16 pb-20 px-5 sm:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="font-display text-4xl sm:text-5xl lg:text-7xl xl:text-8xl leading-[1.05] text-balance animate-slide-up">
            Stay where India
            <br />
            <span className="italic text-sand-400">still lives.</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted max-w-2xl mx-auto text-balance animate-slide-up" style={{ animationDelay: "100ms" }}>
            A real-time concierge for India&apos;s small, hosted, experience-led stays —
            havelis, plantation bungalows, tribal homestays, houseboats, and more.
          </p>

          <div className="mt-10 animate-slide-up" style={{ animationDelay: "200ms" }}>
            <ConversationalSearch />
          </div>
        </div>
      </section>

      {/* EXPERIENCE CLUSTERS — front and centre */}
      <section id="clusters" className="px-5 sm:px-8 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-spice-400 mb-2">
                Experiences
              </div>
              <h2 className="font-display text-4xl sm:text-5xl text-balance">
                What do you want to feel?
              </h2>
            </div>
            <Link
              href="/search"
              className="hidden md:block text-sm text-muted hover:text-foreground transition-colors"
            >
              Or just describe it →
            </Link>
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 14 }).map((_, i) => (
                  <SkeletonClusterTile key={i} />
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {clusters.map((c) => (
                <ClusterTile key={c.slug} cluster={c} />
              ))}
            </div>
          </Suspense>
        </div>
      </section>

      {/* FEATURED STAYS */}
      <section className="px-5 sm:px-8 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-spice-400 mb-2">
                Today&apos;s curation
              </div>
              <h2 className="font-display text-4xl sm:text-5xl text-balance">
                Twelve worth waking up for.
              </h2>
            </div>
          </div>
          <Suspense
            fallback={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            }
          >
            <FeaturedGrid />
          </Suspense>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-5 sm:px-8 py-20 border-t border-hairline">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-balance mb-12">
            We don&apos;t take bookings.
            <br />
            <span className="italic text-sand-400">We take you to the right host.</span>
          </h2>
          <div className="grid sm:grid-cols-3 gap-8 text-left">
            {[
              {
                kicker: "01",
                title: "Describe what you want",
                body: "Mood, food, landscape, budget, dates — natural language, no filters.",
              },
              {
                kicker: "02",
                title: "We curate, not list",
                body: "We match your description against our hand-picked catalogue and explain why each stay fits.",
              },
              {
                kicker: "03",
                title: "Book with the host",
                body: "Direct links to Google Hotels, Booking, Airbnb — or the host's own site. No middleman.",
              },
            ].map((s) => (
              <div key={s.kicker}>
                <div className="text-spice-400 font-display text-3xl mb-2">{s.kicker}</div>
                <div className="font-display text-2xl mb-2">{s.title}</div>
                <div className="text-muted text-sm leading-relaxed">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-5 sm:px-8 py-8 border-t border-hairline text-center text-xs text-faint">
        curate<span className="text-spice-500">India</span> · MVP · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
