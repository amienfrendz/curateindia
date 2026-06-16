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
      "Stay at the edge of tiger reserves and biodiversity hotspots. Naturalist-led safaris, hide photography, and dawn birding walks led by hosts who often double as conservationists.",
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
      "Block printing in Bagru, pottery in Andhra, Pichwai painting in Nathdwara, weaving in Kutch. Stay where the loom or wheel is still part of the household.",
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
      "Colonial-era planter's bungalows on working tea, coffee and spice estates. Walk the gardens at first flush, watch cupping rooms, and dine on estate-grown produce.",
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
      "Hands-on kitchens with grandmothers and chefs: Chettinad, Syrian Christian, Kashmiri Wazwan, Punjabi heartland, Naga smoked meats. Forage, grind, and plate.",
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
      "Sleep inside living heritage — restored havelis, plantation bungalows, palace wings and Franco-Tamil mansions where the family still lives upstairs.",
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
      "Yoga TTC ashrams in Rishikesh, Buddhist monastery stays in Ladakh and Sikkim, silent retreats in the Aravallis, and pilgrim circuits with experienced gurus.",
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
      "Doctor-led Ayurveda residences, Siddha and naturopathy retreats, and slow yoga in plantation settings. 7-21 day protocols with cooked-for-you sattvic meals.",
    icon: "🌿",
    accent: "from-emerald-700/60 to-teal-900/80",
    unsplashId: "1545389336-cf090694435e",
  },
  {
    slug: "trekking-adventure",
    name: "Trekking & Adventure",
    shortName: "Trekking",
    tagline: "Walk the Himalayas, paddle the Konkan",
    description:
      "Slow Kumaon village walks, high-altitude treks in Spiti and Sikkim, river rafting in Tirthan, kayaking in Sundarbans. Hosts who guide their own trails.",
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
      "Bhunga huts in Kutch, Apatani longhouses in Ziro, Baiga villages in Kanha, Bhotiya hamlets in Kumaon. Hosted by the village itself, with your stay funding the panchayat.",
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
      "Properties built from local materials, run on renewable energy, and committed to circular economies. The point of these stays is to stay still.",
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
      "Sleep on a Dal Lake shikara, dive Andaman reefs, drift through Kerala backwaters, watch otters from a Konkan villa. Properties where water is the front yard.",
    icon: "🌊",
    accent: "from-cyan-800/60 to-blue-900/80",
    unsplashId: "1602002418082-a4443e081dd1",
  },
  {
    slug: "astronomy-stargazing",
    name: "Astronomy & Stargazing",
    shortName: "Stargazing",
    tagline: "Bortle 1 skies in Spiti, Ladakh & Hanle",
    description:
      "Stay where the Milky Way is the only ceiling. Telescope-equipped lodges in Hanle (India's first dark sky reserve), Nubra and remote Spiti villages.",
    icon: "🌌",
    accent: "from-indigo-950/60 to-violet-900/80",
    unsplashId: "1419242902214-272b3f66ee7a",
  },
  {
    slug: "festivals-seasonal",
    name: "Festivals & Seasonal Experiences",
    shortName: "Festivals",
    tagline: "Pongal, Hornbill, Rann Utsav, Holi",
    description:
      "Time-bound stays for India's great festivals and seasons — first monsoon in the Sahyadris, mango harvest in the Konkan, Ziro music fest, Hornbill in Nagaland.",
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
      "Manganiar evenings in the Thar, Theyyam in north Malabar, Bhangra in rural Punjab, Bihu in Assam, Sufi Qawwali in Nizamuddin. Hosts arrange intimate baithaks.",
    icon: "🎶",
    accent: "from-fuchsia-800/60 to-rose-900/80",
    unsplashId: "1583317099768-4eef7e91f8a4",
  },
];

export function getCluster(slug: string): Cluster | undefined {
  return CLUSTERS.find((c) => c.slug === slug);
}
