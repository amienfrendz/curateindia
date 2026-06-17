import { NextRequest, NextResponse } from "next/server";
import { chatJSON } from "@/lib/githubModels";
import { getAllProperties } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────

type IntentExtraction = {
  intent: string;
  nearbyStates: string[];
  clusters: string[];
  mood: string[];
  budget: string;
  propertyTypes: string[];
  keywords: string[];
};

type MatchResponse = {
  intent: string;
  hits: { propertyId: string; reason: string; matchScore: number }[];
};

// ── Geographic proximity map ───────────────────────────────────────────────

const GEO_PROXIMITY: Record<string, string[]> = {
  bangalore: ["Karnataka", "Kerala", "Tamil Nadu", "Goa", "Andhra Pradesh", "Telangana", "Puducherry"],
  bengaluru: ["Karnataka", "Kerala", "Tamil Nadu", "Goa", "Andhra Pradesh", "Telangana", "Puducherry"],
  delhi: ["Rajasthan", "Uttarakhand", "Himachal Pradesh", "Uttar Pradesh", "Haryana", "Punjab", "Madhya Pradesh"],
  ncr: ["Rajasthan", "Uttarakhand", "Himachal Pradesh", "Uttar Pradesh", "Haryana", "Punjab"],
  gurgaon: ["Rajasthan", "Uttarakhand", "Himachal Pradesh", "Uttar Pradesh", "Haryana", "Punjab"],
  noida: ["Rajasthan", "Uttarakhand", "Himachal Pradesh", "Uttar Pradesh", "Haryana"],
  mumbai: ["Maharashtra", "Goa", "Gujarat", "Madhya Pradesh", "Rajasthan", "Karnataka"],
  pune: ["Maharashtra", "Goa", "Gujarat", "Karnataka", "Madhya Pradesh"],
  kolkata: ["West Bengal", "Sikkim", "Odisha", "Jharkhand", "Assam", "Meghalaya"],
  chennai: ["Tamil Nadu", "Kerala", "Andhra Pradesh", "Karnataka", "Puducherry", "Telangana"],
  hyderabad: ["Telangana", "Andhra Pradesh", "Karnataka", "Maharashtra", "Goa"],
  ahmedabad: ["Gujarat", "Rajasthan", "Madhya Pradesh", "Maharashtra"],
  jaipur: ["Rajasthan", "Uttarakhand", "Himachal Pradesh", "Uttar Pradesh", "Gujarat", "Madhya Pradesh"],
  lucknow: ["Uttar Pradesh", "Uttarakhand", "Madhya Pradesh", "Rajasthan", "Bihar"],
  guwahati: ["Assam", "Meghalaya", "Arunachal Pradesh", "Nagaland", "Manipur", "Sikkim", "West Bengal"],
  kochi: ["Kerala", "Tamil Nadu", "Karnataka", "Goa"],
  cochin: ["Kerala", "Tamil Nadu", "Karnataka", "Goa"],
};

// ── Stage 1: Intent extraction (tiny LLM call — no catalogue) ──────────

async function extractIntent(query: string): Promise<IntentExtraction> {
  const allStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Jammu & Kashmir", "Ladakh", "Puducherry", "Lakshadweep",
  ];

  const clusterSlugs = [
    "wildlife-birding-photography", "art-craft", "plantation-experiences",
    "culinary-immersion", "heritage-cultural", "spirituality", "wellness-ayurveda",
    "trekking-adventure", "tribal-village-life", "slow-living-sustainability",
    "marine-water-living", "astronomy-stargazing", "festivals-seasonal", "music-dance",
  ];

  const system = `Extract structured travel intent from the user's query. You are an expert on Indian geography and travel.

Return ONLY JSON:
{
  "intent": "1-2 sentence restatement of what the user wants, in second person",
  "nearbyStates": ["states the user can realistically reach — infer from city mentioned, travel context, or stated preference. Use: ${allStates.join(", ")}"],
  "clusters": ["matching cluster slugs from: ${clusterSlugs.join(", ")}"],
  "mood": ["e.g. peaceful, romantic, adventure, family, luxury, offbeat, spiritual"],
  "budget": "any | budget | mid | luxury",
  "propertyTypes": ["e.g. homestay, villa, cottage, hut, treehouse, houseboat, farmstay, bungalow, haveli, estate, ashram"],
  "keywords": ["other important terms for matching — e.g. river, mountain, beach, coffee, tribal"]
}

Rules:
- nearbyStates: if user says "from Bangalore", include Karnataka + neighbouring states. If "weekend", limit to drivable distance. If no location mentioned, leave empty.
- clusters: match broadly — "food" → culinary-immersion, "nature" → wildlife + slow-living, etc. Include multiple if relevant.
- Leave arrays empty if no signal — do NOT guess.`;

  try {
    // Use gpt-4.1-nano for intent extraction — cheapest model, separate quota
    // Falls back to mistral-small if nano is rate-limited
    return await chatJSON<IntentExtraction>({
      system,
      user: query,
      model: "openai/gpt-4.1-nano",
      temperature: 0.1,
    });
  } catch (e: unknown) {
    const is429 = e instanceof Error && e.message.includes("429");
    if (is429) {
      try {
        return await chatJSON<IntentExtraction>({
          system,
          user: query,
          model: "mistral-small-2503",
          temperature: 0.1,
        });
      } catch { /* fall through to keyword fallback */ }
    }
    // Fallback: basic keyword extraction if LLM fails
    const queryLower = query.toLowerCase();
    const detectedStates: string[] = [];
    for (const [city, states] of Object.entries(GEO_PROXIMITY)) {
      if (queryLower.includes(city)) detectedStates.push(...states);
    }
    return {
      intent: query,
      nearbyStates: Array.from(new Set(detectedStates)),
      clusters: [],
      mood: [],
      budget: "any",
      propertyTypes: [],
      keywords: queryLower.split(/\s+/).filter(w => w.length > 3),
    };
  }
}

// ── Stage 2: Smart pre-filter (zero LLM cost) ─────────────────────────

function scoreProperty(
  p: { name: string; location: string; state: string; type: string; clusters: string[]; blurb: string; priceTier: string; region: string },
  intent: IntentExtraction,
  queryLower: string,
): number {
  let score = 0;
  const text = `${p.name} ${p.location} ${p.state} ${p.type} ${p.region} ${p.blurb}`.toLowerCase();

  // Geographic match (strongest signal)
  if (intent.nearbyStates.length > 0) {
    if (intent.nearbyStates.includes(p.state)) score += 15;
    // Slight penalty if states were specified but property isn't in them
    else score -= 5;
  }

  // Cluster match
  for (const c of intent.clusters) {
    if (p.clusters.includes(c)) score += 8;
  }

  // Property type match
  for (const t of intent.propertyTypes) {
    if (p.type.toLowerCase() === t.toLowerCase()) score += 4;
  }

  // Keyword match
  for (const kw of intent.keywords) {
    if (text.includes(kw.toLowerCase())) score += 2;
  }

  // Budget alignment
  if (intent.budget === "budget" && (p.priceTier === "₹" || p.priceTier === "₹₹")) score += 3;
  if (intent.budget === "luxury" && p.priceTier === "₹₹₹₹") score += 3;
  if (intent.budget === "mid" && (p.priceTier === "₹₹" || p.priceTier === "₹₹₹")) score += 2;

  // Mood alignment
  const moods = intent.mood.map(m => m.toLowerCase());
  if (moods.includes("peaceful") || moods.includes("serene") || moods.includes("calm")) {
    if (p.clusters.includes("slow-living-sustainability")) score += 4;
  }
  if (moods.includes("adventure")) {
    if (p.clusters.includes("trekking-adventure")) score += 4;
  }
  if (moods.includes("spiritual")) {
    if (p.clusters.includes("spirituality")) score += 4;
  }
  if (moods.includes("offbeat")) {
    if (p.clusters.includes("tribal-village-life") || p.clusters.includes("astronomy-stargazing")) score += 3;
  }

  // Direct state name in query
  if (queryLower.includes(p.state.toLowerCase())) score += 10;

  return score;
}

// ── Stage 3: Final LLM matching (small, focused call) ─────────────────

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const properties = await getAllProperties();
    const queryLower = query.toLowerCase();

    // Stage 1: Extract intent (tiny LLM call)
    const intent = await extractIntent(query);

    // Stage 2: Score and filter (free)
    const scored = properties.map((p) => ({
      p,
      score: scoreProperty(p, intent, queryLower),
    }));
    scored.sort((a, b) => b.score - a.score);

    // Take top 20 — smart filter means fewer, better candidates
    const subset = scored.slice(0, 20).map(s => s.p);

    // Stage 3: Final matching (small focused LLM call)
    const compact = subset.map((p) => (
      `${p.id}|${p.name}|${p.type}|${p.location},${p.state}|${p.clusters.join("+")}|${p.priceTier}`
    )).join("\n");

    const system = `You are CurateIndia's concierge. The user wants: "${intent.intent}"

From the shortlisted properties below, pick the best matches. Explain why each fits in one vivid sentence.

Return ONLY JSON:
{"intent":"${intent.intent}","hits":[{"propertyId":"exact id","reason":"1-sentence why","matchScore":0.0-1.0}]}

Rules:
- Up to 8 hits, desc by matchScore.
- Only return properties that genuinely fit — if only 3 fit, return 3.
- Only use IDs from the list below. Never invent.`;

    const userMsg = `Shortlist (${subset.length} properties):\n${compact}`;

    // Rotate matching model across 3 free models with separate daily quotas
    const MATCH_MODELS = [
      "openai/gpt-4o-mini",
      "openai/gpt-4.1-mini",
      "Llama-3.3-70B-Instruct",
    ];
    const modelIndex = Math.floor(Date.now() / 1000) % MATCH_MODELS.length;
    let llm: MatchResponse | null = null;

    for (let attempt = 0; attempt < MATCH_MODELS.length; attempt++) {
      const model = MATCH_MODELS[(modelIndex + attempt) % MATCH_MODELS.length];
      try {
        llm = await chatJSON<MatchResponse>({
          system,
          user: userMsg,
          model,
          temperature: 0.3,
        });
        break;
      } catch (e: unknown) {
        const is429 = e instanceof Error && e.message.includes("429");
        if (is429 && attempt < MATCH_MODELS.length - 1) continue; // try next model
        throw e;
      }
    }

    if (!llm) throw new Error("All models rate-limited");

    const validIds = new Set(properties.map((p) => p.id));
    const validHits = (llm.hits || [])
      .filter((h) => validIds.has(h.propertyId))
      .slice(0, 8)
      .map((h) => {
        const property = properties.find((p) => p.id === h.propertyId)!;
        return {
          propertyId: h.propertyId,
          reason: h.reason,
          matchScore: h.matchScore,
          property,
        };
      });

    return NextResponse.json({ intent: intent.intent, hits: validHits });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "search failed";
    const status = msg.includes("429") ? 429 : 500;
    const userMsg = status === 429
      ? "Our AI is temporarily rate-limited. Please try again in a minute."
      : "Something went wrong with the search. Please try again.";
    return NextResponse.json({ error: userMsg }, { status });
  }
}
