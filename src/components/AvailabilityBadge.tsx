"use client";

export default function AvailabilityBadge({
  bookingLinks,
}: {
  propertySlug: string;
  bookingLinks: { name: string; label: string; url: string }[];
}) {
  return (
    <div className="glass rounded-2xl p-5 animate-fade-in">
      <div className="text-xs uppercase tracking-wider text-spice-400 mb-3">
        Book this stay
      </div>
      <p className="text-sm text-muted mb-4 leading-relaxed">
        We don&apos;t take bookings — these links go directly to the host or your preferred platform.
      </p>
      <div className="flex flex-wrap gap-2">
        {bookingLinks.map((l) => (
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
    </div>
  );
}
