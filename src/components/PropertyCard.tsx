import Link from "next/link";
import type { Property } from "@/types";
import { getCluster } from "@/data/clusters";
import PropertyImage from "./PropertyImage";

export default function PropertyCard({
  property,
  matchReason,
}: {
  property: Property;
  matchReason?: string;
}) {
  const primaryCluster = getCluster(property.clusters[0]);

  return (
    <Link
      href={`/stays/${property.slug}`}
      className="group block animate-fade-in"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border-hairline border">
        <PropertyImage
          imageUrl={`/photos/${property.slug}/1.jpg`}
          website={property.website}
          query={`${property.name} ${property.location} ${property.type}`}
          alt={property.name}
          className="absolute inset-0"
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
