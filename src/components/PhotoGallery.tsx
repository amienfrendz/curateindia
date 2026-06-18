"use client";
import { useState, useRef, useCallback, useEffect } from "react";

export type GalleryPhoto = {
  file: string;
  type: "host" | "guest";
  category?: string;
  author: string;
  widthPx: number;
  heightPx: number;
};

type Props = {
  photos: GalleryPhoto[];
  propertyName: string;
  hero?: boolean;
};

export default function PhotoGallery({ photos, propertyName, hero = false }: Props) {
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const touchDeltaRef = useRef(0);
  const [dragging, setDragging] = useState(false);

  const total = photos.length;
  if (!total) return null;

  const goTo = (i: number) => setCurrent(Math.max(0, Math.min(i, total - 1)));

  return (
    <>
      <div className={`relative overflow-hidden bg-ink-900 select-none ${hero ? "w-full h-full" : "rounded-xl sm:rounded-2xl"}`}>
        <div
          className={`relative overflow-hidden ${hero ? "h-full" : "aspect-[4/3]"}`}
          onTouchStart={(e) => {
            touchStartRef.current = e.touches[0].clientX;
            touchDeltaRef.current = 0;
            setDragging(true);
          }}
          onTouchMove={(e) => {
            if (touchStartRef.current === null) return;
            touchDeltaRef.current = e.touches[0].clientX - touchStartRef.current;
          }}
          onTouchEnd={() => {
            setDragging(false);
            if (touchDeltaRef.current > 50 && current > 0) goTo(current - 1);
            else if (touchDeltaRef.current < -50 && current < total - 1) goTo(current + 1);
            touchStartRef.current = null;
            touchDeltaRef.current = 0;
          }}
        >
          <div
            className={`flex h-full ${dragging ? "" : "transition-transform duration-300 ease-out"}`}
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {photos.map((photo, i) => (
              <div key={photo.file} className="shrink-0 w-full h-full relative">
                {Math.abs(i - current) <= 1 && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photo.file}
                    alt={`${propertyName} — ${photo.author}`}
                    className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    onClick={() => setLightbox(true)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Prev/Next arrows */}
        {current > 0 && (
          <button
            onClick={() => goTo(current - 1)}
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-ink-900/70 hover:bg-ink-900/90 backdrop-blur-sm border border-hairline transition-colors z-10"
            aria-label="Previous photo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        {current < total - 1 && (
          <button
            onClick={() => goTo(current + 1)}
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-ink-900/70 hover:bg-ink-900/90 backdrop-blur-sm border border-hairline transition-colors z-10"
            aria-label="Next photo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}

        {/* Bottom bar */}
        <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-3 py-2.5 bg-gradient-to-t from-ink-900/80 to-transparent pointer-events-none">
          <div className="flex items-center gap-1 pointer-events-auto">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all ${i === current ? "w-2 h-2 bg-white" : "w-1.5 h-1.5 bg-white/40"}`}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-white/80">
            <span className={`px-1.5 py-0.5 rounded ${photos[current].type === "host" ? "bg-spice-500/80 text-ink-900" : "bg-ink-800/80 border border-white/20"}`}>
              {photos[current].type === "host" ? "Host" : "Guest"}
            </span>
            <span>{current + 1}/{total}</span>
          </div>
        </div>
      </div>

      {lightbox && <Lightbox photos={photos} propertyName={propertyName} initial={current} onClose={() => setLightbox(false)} />}
    </>
  );
}

function Lightbox({ photos, propertyName, initial, onClose }: {
  photos: GalleryPhoto[]; propertyName: string; initial: number; onClose: () => void;
}) {
  const [idx, setIdx] = useState(initial);
  const touchStartRef = useRef<number | null>(null);
  const total = photos.length;

  const goPrev = useCallback(() => setIdx((i) => (i - 1 + total) % total), [total]);
  const goNext = useCallback(() => setIdx((i) => (i + 1) % total), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose, goPrev, goNext]);

  const photo = photos[idx];

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/95 flex flex-col"
      onClick={onClose}
      onTouchStart={(e) => { touchStartRef.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartRef.current === null) return;
        const diff = e.changedTouches[0].clientX - touchStartRef.current;
        if (diff > 60) goPrev(); else if (diff < -60) goNext();
        touchStartRef.current = null;
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 shrink-0">
        <span className="text-xs sm:text-sm text-muted">{idx + 1} / {total}</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] sm:text-xs text-muted">
            {photo.type === "host" ? "📷 Host" : `📸 ${photo.author}`}
          </span>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-muted hover:text-foreground transition-colors p-2" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-16 pb-4 min-h-0 relative">
        <button onClick={(e) => { e.stopPropagation(); goPrev(); }} className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-ink-800/80 hover:bg-ink-700 border border-hairline transition-colors z-10" aria-label="Previous">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); goNext(); }} className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-ink-800/80 hover:bg-ink-700 border border-hairline transition-colors z-10" aria-label="Next">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.file}
          alt={`${propertyName} — ${photo.author}`}
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="sm:hidden text-center text-[10px] text-faint pb-3">Swipe · Tap outside to close</div>
    </div>
  );
}
