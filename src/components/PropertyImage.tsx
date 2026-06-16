"use client";
import { useEffect, useState } from "react";

type Props = {
  imageUrl?: string | null;
  website?: string;
  query: string;
  alt: string;
  className?: string;
};

const PLACEHOLDER =
  "https://upload.wikimedia.org/wikipedia/commons/9/99/Mehrangarh_Fort_sanhita.jpg";

export default function PropertyImage({
  imageUrl,
  website,
  query,
  alt,
  className = "",
}: Props) {
  const [src, setSrc] = useState<string>(imageUrl || PLACEHOLDER);

  useEffect(() => {
    if (imageUrl) {
      setSrc(imageUrl);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams();
    if (website) params.set("url", website);
    params.set("q", query);
    params.set("v", "3");

    fetch(`/api/image?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.image) setSrc(data.image);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imageUrl, website, query]);

  return (
    <div className={`overflow-hidden bg-ink-800 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={(e) => {
          if (e.currentTarget.src !== PLACEHOLDER) e.currentTarget.src = PLACEHOLDER;
        }}
        className="h-full w-full object-cover object-top"
      />
    </div>
  );
}
