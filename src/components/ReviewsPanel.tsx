"use client";
import { useState } from "react";
import reviewsData from "@/data/property-reviews.json";
import generativeSummariesData from "@/data/semantic/generative-summaries.json";

type ReviewEntry = {
  rating: number | null;
  ratingCount: number;
  editorial: string | null;
  reviews: { text: string; rating: number; time: string; author: string }[];
  fetchedAt: string;
};

type GenerativeSummaryEntry = {
  placeId: string;
  displayName: string;
  generativeSummary: string | null;
  editorialSummary: string | null;
  reviews: any[];
  fetchedAt: string;
};

const allReviews = reviewsData as Record<string, ReviewEntry>;
const allGenerativeSummaries = generativeSummariesData as Record<string, GenerativeSummaryEntry>;
const SHOW_PLACE_SUMMARY = process.env.NEXT_PUBLIC_SHOW_PLACE_SUMMARY === "true";

function ExpandableReview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 300;

  return (
    <span>
      {isLong && !expanded ? text.slice(0, 300) + "…" : text}
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-spice-400 hover:text-spice-300 ml-1 text-xs font-medium transition-colors"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </span>
  );
}

export default function ReviewsPanel({ propertySlug }: { propertySlug: string }) {
  const data = allReviews[propertySlug];
  const summaryData = SHOW_PLACE_SUMMARY ? allGenerativeSummaries[propertySlug] : null;

  if (!data || (!data.rating && data.reviews.length === 0)) {
    return (
      <div className="text-sm text-muted leading-relaxed max-w-xl">
        We haven&apos;t pulled public guest reviews for this stay yet. The host&apos;s site
        and Google Maps listing are the best sources for first-hand stories.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Aggregate rating */}
      {data.rating && (
        <div className="flex items-center gap-3">
          <span className="font-display text-4xl text-spice-400">{data.rating}</span>
          <div>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < Math.round(data.rating!) ? "text-spice-400" : "text-ink-600"}>★</span>
              ))}
            </div>
            <div className="text-xs text-muted">{data.ratingCount.toLocaleString()} Google reviews</div>
          </div>
        </div>
      )}

      {/* Google Places generative summary (feature flagged) */}
      {SHOW_PLACE_SUMMARY && summaryData?.generativeSummary && (
        <div className="bg-ink-800/40 border border-spice-500/20 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-spice-400 mb-2">Google Places Summary</div>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {summaryData.generativeSummary}
          </p>
        </div>
      )}

      {/* Editorial summary */}
      {data.editorial && (
        <p className="text-sm text-foreground/80 italic leading-relaxed">
          {data.editorial}
        </p>
      )}

      {/* Top quotes — full text with expand/collapse */}
      {data.reviews.length > 0 && (
        <div className="space-y-5">
          {data.reviews.slice(0, 3).map((rv, i) => (
            <figure
              key={i}
              className="border-l-2 border-spice-500/40 pl-5 animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <blockquote className="text-sm leading-relaxed">
                &ldquo;<ExpandableReview text={rv.text} />&rdquo;
              </blockquote>
              <figcaption className="text-xs text-muted mt-2">
                — {rv.author} · {"★".repeat(rv.rating)} · {rv.time}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className="text-[10px] text-faint">
        Source: Google Maps · fetched {new Date(data.fetchedAt).toLocaleDateString()}
      </div>
    </div>
  );
}
