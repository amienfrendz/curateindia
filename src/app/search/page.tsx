import ConversationalSearch from "@/components/ConversationalSearch";
import Link from "next/link";

export const metadata = {
  title: "Ask curateIndia",
  description: "Describe what you want — mood, food, landscape, dates — and we'll match.",
};

export default function SearchPage() {
  return (
    <main className="min-h-screen px-5 sm:px-8 py-16">
      <div className="max-w-5xl mx-auto">
        <Link href="/" className="text-xs uppercase tracking-[0.3em] text-spice-400 mb-6 inline-block">
          ← Home
        </Link>
        <h1 className="font-display text-5xl sm:text-7xl text-balance mb-4">
          Tell us what you want.
          <br />
          <span className="italic text-sand-400">No filters. Just words.</span>
        </h1>
        <p className="text-base text-muted max-w-2xl mb-10">
          Mood, food, weather, distance from a city, festival timing, who&apos;s travelling —
          describe it the way you would to a friend. We&apos;ll do the curation.
        </p>

        <ConversationalSearch />
      </div>
    </main>
  );
}
