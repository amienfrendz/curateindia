"use client";
import { useEffect, useState } from "react";
import { SkeletonAvailability } from "./Skeletons";
import type { AvailabilityResult } from "@/types";

const STATUS_COPY: Record<AvailabilityResult["status"], { label: string; color: string }> = {
  "likely-available": { label: "Likely available", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  "limited": { label: "Limited", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  "likely-full": { label: "Likely full", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  "unknown": { label: "Check directly", color: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
};

export default function AvailabilityBadge({
  propertySlug,
  bookingLinks,
}: {
  propertySlug: string;
  bookingLinks: { name: string; label: string; url: string }[];
}) {
  const [data, setData] = useState<AvailabilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkin, setCheckin] = useState<string>("");
  const [checkout, setCheckout] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/availability?slug=${propertySlug}${checkin ? `&checkin=${checkin}` : ""}${checkout ? `&checkout=${checkout}` : ""}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!cancelled && d) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [propertySlug, checkin, checkout]);

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonAvailability />
        <BookingButtons links={bookingLinks} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="glass rounded-2xl p-5">
        <div className="text-xs uppercase tracking-wider text-spice-400 mb-2">Availability</div>
        <div className="text-sm text-muted">Couldn&apos;t reach inventory sources right now.</div>
        <BookingButtons links={bookingLinks} />
      </div>
    );
  }

  const statusStyle = STATUS_COPY[data.status];

  return (
    <div className="glass rounded-2xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-spice-400">Live availability</div>
        <span className={`text-xs px-2 py-1 rounded-full border ${statusStyle.color}`}>
          {statusStyle.label}
        </span>
      </div>

      <div className="text-sm text-foreground/90 leading-relaxed mb-3">{data.note}</div>

      <div className="flex gap-2 mb-4">
        <input
          type="date"
          value={checkin}
          onChange={(e) => setCheckin(e.target.value)}
          className="flex-1 bg-ink-800 border border-hairline rounded-lg px-3 py-2 text-sm"
          aria-label="Check-in"
        />
        <input
          type="date"
          value={checkout}
          onChange={(e) => setCheckout(e.target.value)}
          className="flex-1 bg-ink-800 border border-hairline rounded-lg px-3 py-2 text-sm"
          aria-label="Check-out"
        />
      </div>

      <BookingButtons links={bookingLinks} />

      <div className="text-[10px] text-faint mt-3">
        Inferred from public sources · {new Date(data.fetchedAt).toLocaleString()}
      </div>
    </div>
  );
}

function BookingButtons({ links }: { links: { name: string; label: string; url: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.name}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-2 rounded-lg bg-ink-800 hover:bg-ink-700 border border-hairline transition-colors"
        >
          {l.label} →
        </a>
      ))}
    </div>
  );
}
