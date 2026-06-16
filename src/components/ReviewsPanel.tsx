"use client";
import { useEffect, useState } from "react";
import { SkeletonReviewBlock } from "./Skeletons";
import type { ReviewSummary } from "@/types";

export default function ReviewsPanel({ propertySlug }: { propertySlug: string }) {
  const [data, setData] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reviews?slug=${propertySlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) {
          if (d) setData(d);
          else setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [propertySlug]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonReviewBlock />
        <SkeletonReviewBlock />
      </div>
    );
  }

  if (error || !data || (data.highlights.length === 0 && data.quotes.length === 0)) {
    return (
      <div className="text-sm text-muted leading-relaxed max-w-xl">
        We haven&apos;t pulled public guest reviews for this stay yet. The host&apos;s site
        and TripAdvisor/Google listings (linked on the right) are the best sources for
        first-hand stories.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {data.highlights.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-spice-400 mb-3">
            What guests keep saying
          </div>
          <div className="flex flex-wrap gap-2">
            {data.highlights.map((h, i) => (
              <span
                key={i}
                className="text-sm px-3 py-1.5 rounded-full bg-ink-800 border border-hairline"
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.quotes.length > 0 && (
        <div className="space-y-5">
          {data.quotes.map((q, i) => (
            <figure
              key={i}
              className="border-l-2 border-spice-500/40 pl-5 animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <blockquote className="font-display text-xl leading-snug text-balance">
                &ldquo;{q.text}&rdquo;
              </blockquote>
              <figcaption className="text-xs text-muted mt-2">
                — {q.source}
                {q.sourceUrl && (
                  <>
                    {" · "}
                    <a
                      href={q.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-dotted hover:text-foreground"
                    >
                      read source
                    </a>
                  </>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className="text-[10px] text-faint">
        Pulled from public reviews · {new Date(data.fetchedAt).toLocaleString()}
      </div>
    </div>
  );
}
