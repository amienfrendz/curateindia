"use client";
import { useState } from "react";
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

export default function PropertyCardWithGallery({
  property,
  matchReason,
}: {
  property: Property;
  matchReason?: string;
}) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const primaryCluster = getCluster(property.clusters[0]);
  const galleryEntry = (galleryData as Record<string, GalleryEntry>)[property.slug];
  const galleryPhotos = galleryEntry?.photos || [];
  const hasMultiplePhotos = galleryPhotos.length > 1;

  // Get current photo (cycle through gallery on hover, fallback to first or default)
  const currentPhoto =
    galleryPhotos.length > 0
      ? `/photos/${property.slug}/${currentPhotoIndex + 1}.jpg`
      : `/photos/${property.slug}/1.jpg`;

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev === 0 ? galleryPhotos.length - 1 : prev - 1));
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev === galleryPhotos.length - 1 ? 0 : prev + 1));
  };

  return (
    <Link
      href={`/stays/${property.slug}`}
      className="group block animate-fade-in"
    >
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-2xl border-hairline border"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          setCurrentPhotoIndex(0);
        }}
      >
        <PropertyImage
          imageUrl={currentPhoto}
          website={property.website}
          query={`${property.name} ${property.location} ${property.type}`}
          alt={`${property.name} - photo ${currentPhotoIndex + 1}`}
          className="absolute inset-0 transition-opacity duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-transparent to-transparent" />

        {/* type chip + price tier */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full glass">
            {property.type}
          </span>
          {property.rooms && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full glass">
              {property.rooms} {property.rooms === 1 ? "room" : "rooms"}
            </span>
          )}
        </div>
        <div className="absolute top-3 right-3 text-xs px-2 py-1 rounded-full glass">
          {property.priceTier}
        </div>

        {/* Photo counter + gallery nav (show on hover only) */}
        {hasMultiplePhotos && isHovering && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2">
            <div className="text-[10px] text-white px-2 py-1 rounded-full bg-ink-900/80 backdrop-blur-sm">
              {currentPhotoIndex + 1} / {galleryPhotos.length}
            </div>
          </div>
        )}

        {/* Gallery navigation arrows (show on hover only) */}
        {hasMultiplePhotos && isHovering && (
          <>
            <button
              onClick={handlePrevPhoto}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-ink-900/70 hover:bg-ink-900 text-white transition-colors"
              aria-label="Previous photo"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button
              onClick={handleNextPhoto}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-ink-900/70 hover:bg-ink-900 text-white transition-colors"
              aria-label="Next photo"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </>
        )}

        {/* footer */}
        <div className="absolute bottom-0 inset-x-0 p-4">
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
