import type { Cluster } from "@/types";

// Unsplash photo IDs — public, free-license images representative of each cluster.
// Resolved at runtime via images.unsplash.com/photo-<id>?...
export const CLUSTERS: Cluster[] = [
  {
    slug: "wildlife-birding-photography",
    name: "Wildlife, Birding & Photography",
    shortName: "Wildlife & Birding",
    tagline: "Tigers, leopards, and 1,300+ bird species",
    description:
      "Stay at the edge of tiger reserves and biodiversity hotspots. Naturalist-led safaris, hide photography, and dawn birding walks led by hosts who are often conservationists themselves.",
    icon: "🐅",
    accent: "from-amber-700/60 to-emerald-900/80",
    unsplashId: "1549366021-9f761d450615",
  },
  {
    slug: "art-craft",
    name: "Art & Craft",
    shortName: "Art & Craft",
    tagline: "Live with master craftspeople",
    description:
      "Stay where the loom, kiln or printing block is still part of the household. Learn centuries-old techniques from master artisans — bronze casting, weaving, temple sculpture — and watch living traditions up close.",
    icon: "🎨",
    accent: "from-rose-700/60 to-amber-900/80",
    unsplashId: "1606293459339-aa5d34a7b0e1",
  },
  {
    slug: "plantation-experiences",
    name: "Plantation Experiences",
    shortName: "Plantations",
    tagline: "Tea, coffee, spice & cardamom country",
    description:
      "Heritage bungalows on working tea, coffee and spice estates. Walk the gardens at first flush, watch leaves being rolled and graded, and dine on produce grown steps from your room.",
    icon: "🍃",
    accent: "from-emerald-800/60 to-lime-900/80",
    unsplashId: "1561362874-29008fe48f08",
  },
  {
    slug: "culinary-immersion",
    name: "Culinary Immersion",
    shortName: "Culinary",
    tagline: "Cook with the family that knows the recipe",
    description:
      "Hands-on kitchens where generations of home cooks share regional recipes you won't find in restaurants. Forage, grind, and plate alongside the families who invented the dishes.",
    icon: "🌶️",
    accent: "from-red-800/60 to-orange-900/80",
    unsplashId: "1567188040759-fb8a883dc6d8",
  },
  {
    slug: "heritage-cultural",
    name: "Heritage & Cultural Immersion",
    shortName: "Heritage",
    tagline: "Havelis, palaces and 200-year-old homes",
    description:
      "Sleep inside living heritage — restored havelis, royal forts, colonial estates and ancestral mansions where the family still lives, and every room tells a story spanning centuries.",
    icon: "🏛️",
    accent: "from-stone-800/60 to-amber-900/80",
    unsplashId: "1524492412937-b28074a5d7da",
  },
  {
    slug: "spirituality",
    name: "Spirituality",
    shortName: "Spirituality",
    tagline: "Ashrams, monasteries and sacred geographies",
    description:
      "Yoga retreats, Buddhist monastery stays, silent meditation centres and pilgrim circuits guided by practitioners who have devoted their lives to the tradition.",
    icon: "🕉️",
    accent: "from-orange-700/60 to-yellow-900/80",
    unsplashId: "1548013146-72479768bada",
  },
  {
    slug: "wellness-ayurveda",
    name: "Wellness & Ayurveda",
    shortName: "Wellness",
    tagline: "Panchakarma, naturopathy and forest cures",
    description:
      "Physician-led Ayurveda residences, naturopathy retreats, and slow yoga in plantation settings. Multi-day protocols with personalised meals, designed to heal rather than holiday.",
    icon: "🌿",
    accent: "from-emerald-700/60 to-teal-900/80",
    unsplashId: "1545389336-cf090694435e",
  },
  {
    slug: "trekking-adventure",
    name: "Trekking & Adventure",
    shortName: "Trekking",
    tagline: "Walk the mountains, paddle the rivers",
    description:
      "Intimate lodges and homestays that double as base camps — for Himalayan treks, river kayaking, forest trails, and high-altitude crossings. Hosted by guides who know every path personally.",
    icon: "🏔️",
    accent: "from-sky-800/60 to-indigo-900/80",
    unsplashId: "1464822759023-fed622ff2c3b",
  },
  {
    slug: "tribal-village-life",
    name: "Tribal & Village Life",
    shortName: "Village Life",
    tagline: "The India that lives off OTAs",
    description:
      "Community-run stays in traditional villages — mud-walled homes, communal kitchens, craft cooperatives and forest hamlets. Your stay directly funds the families and communities that host you.",
    icon: "🛖",
    accent: "from-amber-900/60 to-stone-900/80",
    unsplashId: "1604999333679-b86d54738315",
  },
  {
    slug: "slow-living-sustainability",
    name: "Slow Living & Sustainability",
    shortName: "Slow Living",
    tagline: "Solar, mud, zero-waste, no Wi-Fi",
    description:
      "Properties built from local materials, run on renewable energy, and committed to circular economies. The point of these stays is to slow down, unplug, and be still.",
    icon: "🌾",
    accent: "from-lime-800/60 to-emerald-900/80",
    unsplashId: "1500382017468-9049fed747ef",
  },
  {
    slug: "marine-water-living",
    name: "Marine & Water Living",
    shortName: "Marine & Water",
    tagline: "Backwaters, reefs, mangroves and houseboats",
    description:
      "Stays where water is the front yard — island retreats, heritage houseboats, coral reef dive lodges, backwater cottages and riverside hideaways surrounded by mangrove and tide.",
    icon: "🌊",
    accent: "from-cyan-800/60 to-blue-900/80",
    unsplashId: "1602002418082-a4443e081dd1",
  },
  {
    slug: "astronomy-stargazing",
    name: "Astronomy & Stargazing",
    shortName: "Stargazing",
    tagline: "Where the Milky Way is the only ceiling",
    description:
      "Telescope-equipped lodges and dark-sky camps in India's remotest landscapes — where astrophysicist hosts guide you through constellations, planets and deep-sky objects with zero light pollution.",
    icon: "🌌",
    accent: "from-indigo-950/60 to-violet-900/80",
    unsplashId: "1419242902214-272b3f66ee7a",
  },
  {
    slug: "festivals-seasonal",
    name: "Festivals & Seasonal Experiences",
    shortName: "Festivals",
    tagline: "Time-bound stays for India's great moments",
    description:
      "Properties that come alive at specific times — monsoon retreats, harvest seasons, camel fairs, tribal festivals, and full-moon gatherings. These stays are worth planning your calendar around.",
    icon: "🪔",
    accent: "from-rose-800/60 to-orange-900/80",
    unsplashId: "1604608672516-f1b9b1d1a0ca",
  },
  {
    slug: "music-dance",
    name: "Music & Dance",
    shortName: "Music & Dance",
    tagline: "Folk, classical and ritual performance",
    description:
      "Stays that arrange intimate baithaks, courtyard concerts and ritual performances — from folk musicians to classical vocalists. Experience India's living musical traditions in the homes where they're preserved.",
    icon: "🎶",
    accent: "from-fuchsia-800/60 to-rose-900/80",
    unsplashId: "1583317099768-4eef7e91f8a4",
  },
];

export function getCluster(slug: string): Cluster | undefined {
  return CLUSTERS.find((c) => c.slug === slug);
}
