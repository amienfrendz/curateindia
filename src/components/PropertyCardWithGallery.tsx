"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Property } from "@/types";
import { getCluster } from "@/data/clusters";
import PropertyImage from "./PropertyImage";
import galleryData from "@/data/property-gallery.json";

type GalleryEntry = {
  photos: Array<{
    file: string;
    category?: string;
  }>;
};

// Preview only the first few photos in the tile carousel (quick triage, not the full gallery).
const MAX_TILE_PHOTOS = 5;

export default function PropertyCardWithGallery({
  property,
  matchReason,
}: {
  property: Property;
  matchReason?: string;
}) {
  const primaryCluster = getCluster(property.clusters[0]);
  const galleryEntry = (galleryData as Record<string, GalleryEntry>)[property.slug];
  const rawPhotos = galleryEntry?.photos ?? [];
  const slides =
    rawPhotos.length > 0
      ? rawPhotos.slice(0, MAX_TILE_PHOTOS).map((p) => p.file)
      : [`/photos/${property.slug}/1.jpg`];
  const total = slides.length;
  const hasMultiple = total > 1;

  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Touch state kept in a ref to avoid re-renders during drag.
  const touchState = useRef({ startX: 0, startY: 0, dx: 0, locked: null as boolean | null });
  // True while/after a horizontal swipe, so the tap-to-navigate is cancelled.
  const didSwipe = useRef(false);

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(i, total - 1));
    currentRef.current = next;
    setCurrent(next);
    const track = trackRef.current;
    if (track) {
      track.style.transition = "transform 300ms cubic-bezier(.25,.1,.25,1)";
      track.style.transform = `translateX(-${next * 100}%)`;
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    goTo(currentRef.current - 1);
  };
  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    goTo(currentRef.current + 1);
  };
  const handleDot = (e: React.MouseEvent, i: number) => {
    e.preventDefault();
    e.stopPropagation();
    goTo(i);
  };

  // If the tap was actually a swipe, cancel the link navigation.
  const handleClickCapture = (e: React.MouseEvent) => {
    if (didSwipe.current) {
      e.preventDefault();
      e.stopPropagation();
      didSwipe.current = false;
    }
  };

  // Native touch listeners with { passive: false } so horizontal swipes can preventDefault —
  // this reproduces the smooth drag-to-follow + snap animation used by the stay-page gallery.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !hasMultiple) return;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      touchState.current = { startX: t.clientX, startY: t.clientY, dx: 0, locked: null };
      didSwipe.current = false;
      const track = trackRef.current;
      if (track) track.style.transition = "none";
    }

    function onTouchMove(e: TouchEvent) {
      const ts = touchState.current;
      const t = e.touches[0];
      const dx = t.clientX - ts.startX;
      const dy = t.clientY - ts.startY;

      if (ts.locked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        ts.locked = Math.abs(dx) > Math.abs(dy);
      }

      if (ts.locked === true) {
        e.preventDefault();
        ts.dx = dx;
        didSwipe.current = true;
        const track = trackRef.current;
        if (track) {
          track.style.transform = `translateX(calc(-${currentRef.current * 100}% + ${dx}px))`;
        }
      }
    }

    function onTouchEnd() {
      const ts = touchState.current;
      if (ts.locked === true) {
        const cur = currentRef.current;
        if (ts.dx > 60 && cur > 0) goTo(cur - 1);
        else if (ts.dx < -60 && cur < total - 1) goTo(cur + 1);
        else goTo(cur);
      }
      touchState.current = { startX: 0, startY: 0, dx: 0, locked: null };
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, hasMultiple]);

  return (
    <Link
      href={`/stays/${property.slug}`}
      className="group block animate-fade-in"
      onClickCapture={handleClickCapture}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border-hairline border select-none">
        {/* Sliding photo track */}
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-hidden"
          style={{ touchAction: "pan-y" }}
        >
          <div
            ref={trackRef}
            className="flex h-full w-full will-change-transform"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {slides.map((src, i) => (
              <div key={i} className="relative h-full w-full shrink-0">
                <PropertyImage
                  imageUrl={src}
                  website={property.website}
                  query={`${property.name} ${property.location} ${property.type}`}
                  alt={`${property.name} — photo ${i + 1}`}
                  className="absolute inset-0"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900 via-transparent to-transparent" />

        {/* Top row: type + rooms on the left, price tier on the right — flex so they never overlap */}
        <div className="pointer-events-none absolute top-3 inset-x-3 z-10 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-2 min-w-0">
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full glass whitespace-nowrap">
              {property.type}
            </span>
            {property.rooms && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full glass whitespace-nowrap">
                {property.rooms} {property.rooms === 1 ? "room" : "rooms"}
              </span>
            )}
          </div>
          <span className="text-xs px-2 py-1 rounded-full glass shrink-0">
            {property.priceTier}
          </span>
        </div>

        {/* Gallery arrows — hover-capable (desktop) devices only, so a single tap opens the stay page on touch */}
        {hasMultiple && current > 0 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-ink-900 shadow-md opacity-0 transition-opacity hover:bg-white [@media(hover:hover)]:group-hover:opacity-100"
            aria-label="Previous photo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        )}
        {hasMultiple && current < total - 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-ink-900 shadow-md opacity-0 transition-opacity hover:bg-white [@media(hover:hover)]:group-hover:opacity-100"
            aria-label="Next photo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        )}

        {/* footer */}
        <div className="absolute bottom-0 inset-x-0 z-10 p-4">
          {hasMultiple && (
            <div className="flex items-center gap-1.5 mb-2.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => handleDot(e, i)}
                  aria-label={`Photo ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current ? "w-4 bg-white" : "w-1.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
            {primaryCluster && (
              <>
                <span>{primaryCluster.icon}</span>
                <span className="uppercase tracking-wider">{primaryCluster.shortName}</span>
              </>
            )}
          </div>
          <div className="font-display text-xl leading-tight text-balance">
            {property.name}
          </div>
          <div className="text-xs text-muted mt-0.5">
            {property.location} · {property.state}
          </div>
        </div>
      </div>

      {matchReason && (
        <div className="text-xs text-sand-400 mt-2 italic line-clamp-2">{matchReason}</div>
      )}
    </Link>
  );
}
