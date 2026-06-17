import ConversationalSearch from "@/components/ConversationalSearch";
import Link from "next/link";

export const metadata = {
  title: "Ask curateIndia",
  description: "Describe what you want — mood, food, landscape, dates — and we'll match.",
};

export default function SearchPage() {
  return (
    <main className="min-h-screen px-4 sm:px-8 py-10 sm:py-16">
      <div className="max-w-5xl mx-auto w-full min-w-0">
        <Link href="/" className="text-xs uppercase tracking-[0.3em] text-spice-400 mb-6 inline-block">
          ← Home
        </Link>
        <h1 className="font-display text-3xl sm:text-5xl lg:text-7xl text-balance mb-3 sm:mb-4">
          Tell us what you want.
          <br />
          <span className="italic text-sand-400">No filters. Just words.</span>
        </h1>
        <p className="text-sm sm:text-base text-muted max-w-2xl mb-8 sm:mb-10">
          Mood, food, weather, distance from a city, festival timing, who&apos;s travelling —
          describe it the way you would to a friend. We&apos;ll do the curation.
        </p>

        <ConversationalSearch />
      </div>
    </main>
  );
}
