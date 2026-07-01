import type { Property } from "@/types";
import PropertyCard from "./PropertyCard";
import PropertyCardWithGallery from "./PropertyCardWithGallery";

const SHOW_TILE_GALLERY = process.env.NEXT_PUBLIC_SHOW_TILE_GALLERY === "true";

export default function PropertyCardWrapper({
  property,
  matchReason,
}: {
  property: Property;
  matchReason?: string;
}) {
  if (SHOW_TILE_GALLERY) {
    return <PropertyCardWithGallery property={property} matchReason={matchReason} />;
  }
  return <PropertyCard property={property} matchReason={matchReason} />;
}
