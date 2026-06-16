import type { Property } from "@/types";

function enc(s: string) {
  return encodeURIComponent(s);
}

export function buildBookingLinks(p: Property, dates?: { checkin?: string; checkout?: string }) {
  const q = `${p.name} ${p.location}`;
  const ci = dates?.checkin || "";
  const co = dates?.checkout || "";

  const links = [
    {
      name: "Google Hotels",
      label: "Google",
      url: `https://www.google.com/travel/hotels/search?q=${enc(q)}${
        ci && co ? `&checkin=${ci}&checkout=${co}` : ""
      }`,
    },
    {
      name: "Booking.com",
      label: "Booking.com",
      url: `https://www.booking.com/searchresults.html?ss=${enc(q)}${
        ci ? `&checkin=${ci}` : ""
      }${co ? `&checkout=${co}` : ""}`,
    },
    {
      name: "Airbnb",
      label: "Airbnb",
      url: `https://www.airbnb.co.in/s/${enc(q)}/homes${
        ci && co ? `?checkin=${ci}&checkout=${co}` : ""
      }`,
    },
    {
      name: "Bing Travel",
      label: "Bing",
      url: `https://www.bing.com/travel/hotel-search?q=${enc(q)}`,
    },
  ];

  if (p.website) {
    links.unshift({ name: "Direct", label: "Host's site", url: p.website });
  }
  return links;
}

export function unsplash(id: string, w = 1200) {
  return `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;
}
