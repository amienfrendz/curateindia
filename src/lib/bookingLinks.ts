import type { Property } from "@/types";
import bookingLinksData from "@/data/booking-links.json";

type LinkEntry = { name: string; label: string; url: string; verified: boolean };
const ALL_LINKS = bookingLinksData as Record<string, LinkEntry[]>;

export function buildBookingLinks(p: Property) {
  const cached = ALL_LINKS[p.slug];
  if (cached && cached.length > 0) {
    // Filter out unverified host sites, keep everything else
    return cached
      .filter((l) => l.verified || l.name !== "direct")
      .map(({ name, label, url }) => ({ name, label, url }));
  }

  // Fallback for properties not in the JSON (new additions)
  const q = encodeURIComponent(`${p.name} ${p.location}`);
  const links = [];
  if (p.website) links.push({ name: "direct", label: "Host\u2019s site", url: p.website });
  links.push({ name: "google-hotels", label: "Google Hotels", url: `https://www.google.com/travel/hotels/search?q=${q}` });
  links.push({ name: "booking", label: "Booking.com", url: `https://www.booking.com/searchresults.html?ss=${q}` });
  links.push({ name: "makemytrip", label: "MakeMyTrip", url: `https://www.makemytrip.com/hotels/hotel-listing/?txtCityHotel=${q}` });
  links.push({ name: "airbnb", label: "Airbnb", url: `https://www.airbnb.co.in/s/${q}/homes` });
  return links;
}
