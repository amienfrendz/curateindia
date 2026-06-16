"use client";
import reviewsData from "@/data/property-reviews.json";

type ReviewEntry = {
  rating: number | null;
  ratingCount: number;
  editorial: string | null;
  reviews: { text: string; rating: number; time: string; author: string }[];
  fetchedAt: string;
};

const allReviews = reviewsData as Record<string, ReviewEntry>;

export default function ReviewsPanel({ propertySlug }: { propertySlug: string }) {
  const data = allReviews[propertySlug];

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

      {/* Editorial summary */}
      {data.editorial && (
        <p className="text-sm text-foreground/80 italic leading-relaxed">
          {data.editorial}
        </p>
      )}

      {/* Top quotes */}
      {data.reviews.length > 0 && (
        <div className="space-y-5">
          {data.reviews.slice(0, 3).map((rv, i) => (
            <figure
              key={i}
              className="border-l-2 border-spice-500/40 pl-5 animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <blockquote className="text-sm leading-relaxed text-balance">
                &ldquo;{rv.text.length > 200 ? rv.text.slice(0, 200) + "…" : rv.text}&rdquo;
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
