import { NextRequest, NextResponse } from "next/server";
import { chatJSON } from "@/lib/githubModels";
import { getAllProperties } from "@/lib/repo";
import { semanticSearch, isSemanticSearchEnabled, hasEmbeddings } from "@/lib/semanticSearch";
import { embedQuery } from "@/lib/embedQuery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────

type IntentExtraction = {
  intent: string;
  travelConstraints: string;
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

// ── Stage 1: Intent extraction (tiny LLM call — no catalogue) ──────────

async function extractIntent(query: string): Promise<IntentExtraction> {
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
  "travelConstraints": "Natural language summary of ALL travel/logistics constraints — origin city, max travel time, transport mode (flight, drive, train), max car ride, weather preferences, who is travelling (elderly, kids, couple). Empty string if none mentioned.",
  "clusters": ["matching cluster slugs from: ${clusterSlugs.join(", ")}"],
  "mood": ["e.g. peaceful, romantic, adventure, family, luxury, offbeat, spiritual"],
  "budget": "any | budget | mid | luxury",
  "propertyTypes": ["e.g. homestay, villa, cottage, hut, treehouse, houseboat, farmstay, bungalow, haveli, estate, ashram"],
  "keywords": ["important descriptors — e.g. cool weather, hill station, beach, forest, river, tribal, heritage, remote, coffee, tea, wildlife"]
}

Rules:
- travelConstraints: capture the user's EXACT logistics constraints in natural language. Examples: "Direct flight from Hyderabad plus max 2-3 hour car ride", "Drivable from Bangalore within 6 hours", "Within 4 hours flying time and 2 hours car time from Delhi". If no constraints, empty string.
- clusters: match broadly — "food" → culinary-immersion, "wildlife" → wildlife-birding-photography, "nature" → wildlife + slow-living. Include multiple if relevant.
- keywords: extract specific descriptors the user cares about. Be thorough.
- Leave arrays empty if no signal — do NOT guess.`;

  try {
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
    // Fallback: basic keyword extraction if all LLMs fail
    const queryLower = query.toLowerCase();
    return {
      intent: query,
      travelConstraints: "",
      clusters: [],
      mood: [],
      budget: "any",
      propertyTypes: [],
      keywords: queryLower.split(/\s+/).filter(w => w.length > 3),
    };
  }
}

// ── Stage 2: Experience-based pre-filter (zero LLM cost) ───────────────
// Scores on experience/cluster/mood/keywords ONLY — no geography.
// Geography is the LLM's job in Stage 3.

function scoreProperty(
  p: { name: string; location: string; state: string; type: string; clusters: string[]; blurb: string; priceTier: string; region: string },
  intent: IntentExtraction,
  queryLower: string,
): number {
  let score = 0;
  const text = `${p.name} ${p.location} ${p.state} ${p.type} ${p.region} ${p.blurb}`.toLowerCase();

  // Cluster match (strongest experience signal)
  for (const c of intent.clusters) {
    if (p.clusters.includes(c)) score += 10;
  }

  // Property type match
  for (const t of intent.propertyTypes) {
    if (p.type.toLowerCase() === t.toLowerCase()) score += 5;
  }

  // Keyword match in property text
  for (const kw of intent.keywords) {
    if (text.includes(kw.toLowerCase())) score += 3;
  }

  // Budget alignment
  if (intent.budget === "budget" && (p.priceTier === "₹" || p.priceTier === "₹₹")) score += 4;
  if (intent.budget === "luxury" && p.priceTier === "₹₹₹₹") score += 4;
  if (intent.budget === "mid" && (p.priceTier === "₹₹" || p.priceTier === "₹₹₹")) score += 2;

  // Mood alignment
  const moods = intent.mood.map(m => m.toLowerCase());
  if (moods.some(m => ["peaceful", "serene", "calm", "relaxing"].includes(m))) {
    if (p.clusters.includes("slow-living-sustainability")) score += 5;
  }
  if (moods.includes("adventure")) {
    if (p.clusters.includes("trekking-adventure")) score += 5;
  }
  if (moods.includes("spiritual")) {
    if (p.clusters.includes("spirituality")) score += 5;
  }
  if (moods.includes("offbeat")) {
    if (p.clusters.includes("tribal-village-life") || p.clusters.includes("astronomy-stargazing")) score += 4;
  }
  if (moods.includes("romantic")) {
    if (p.clusters.includes("slow-living-sustainability") || p.clusters.includes("marine-water-living")) score += 3;
  }

  // Direct state/region name in query (light boost, not a gate)
  if (queryLower.includes(p.state.toLowerCase())) score += 6;
  if (queryLower.includes(p.region.toLowerCase())) score += 3;

  // Direct word overlap for catch-all queries
  const words = queryLower.split(/\s+/).filter(w => w.length > 3);
  for (const w of words) {
    if (text.includes(w)) score += 1;
  }

  return score;
}

// ── Stage 3: LLM matching with travel constraint reasoning ─────────────

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const properties = await getAllProperties();
    const queryLower = query.toLowerCase();

    // Stage 1: Extract intent (tiny LLM call — just the query, no catalogue)
    const intent = await extractIntent(query);

    // ── Semantic search path (feature-flagged) ─────────────────────────────
    let subset: typeof properties;
    let cachedQueryVector: number[] = [];

    if (isSemanticSearchEnabled() && hasEmbeddings()) {
      // Use semantic retrieval: embed query → cosine similarity → top properties
      try {
        cachedQueryVector = await embedQuery(query);
      } catch {
        cachedQueryVector = [];
      }

      if (cachedQueryVector.length > 0) {
        const semanticHits = semanticSearch(cachedQueryVector, undefined, { topProperties: 25 });
        const semanticSlugs = new Set(semanticHits.map(h => h.slug));

        // Merge: semantic results first, then fill with keyword-scored properties
        const semanticProps = properties.filter(p => semanticSlugs.has(p.slug));
        const keywordScored = properties
          .filter(p => !semanticSlugs.has(p.slug))
          .map(p => ({ p, score: scoreProperty(p, intent, queryLower) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 25 - semanticProps.length)
          .map(s => s.p);

        subset = [...semanticProps, ...keywordScored].slice(0, 25);
      } else {
        // Embedding failed, fall through to keyword scoring
        const scored = properties.map((p) => ({
          p,
          score: scoreProperty(p, intent, queryLower),
        }));
        scored.sort((a, b) => b.score - a.score);
        subset = scored.slice(0, 25).map(s => s.p);
      }
    } else {
      // Original keyword-based pre-filter (semantic search disabled)
      const scored = properties.map((p) => ({
        p,
        score: scoreProperty(p, intent, queryLower),
      }));
      scored.sort((a, b) => b.score - a.score);
      subset = scored.slice(0, 25).map(s => s.p);
    }

    // Stage 3: LLM picks the best matches, reasoning about geography + travel constraints
    const compact = subset.map((p) => (
      `${p.id}|${p.name}|${p.type}|${p.location},${p.state}|${p.clusters.join("+")}|${p.priceTier}`
    )).join("\n");

    const travelNote = intent.travelConstraints
      ? `\n\nTRAVEL CONSTRAINTS (apply these strictly when ranking):\n${intent.travelConstraints}\nUse your knowledge of Indian airports, flight routes, and driving distances to evaluate each property's accessibility.`
      : "";

    // Build semantic evidence context if available (reuse cached vector)
    let semanticContext = "";
    if (isSemanticSearchEnabled() && hasEmbeddings() && cachedQueryVector.length > 0) {
      try {
        const hits = semanticSearch(cachedQueryVector, undefined, { topProperties: 15 });
        const evidenceLines = hits.map(h => {
          const topEvidence = h.evidence.slice(0, 5).map(e => e.text || e.photo || "").join("; ");
          return `${h.slug}: ${topEvidence}`;
        }).join("\n");
        if (evidenceLines) {
          semanticContext = `\n\nSEMANTIC EVIDENCE FROM REVIEWS & PHOTOS (use this to EXCLUDE properties that violate user's "no X" criteria):\n${evidenceLines}\n\nIMPORTANT: If evidence mentions stairs, pool, steps, steep access, etc. and the user said "no stairs" or "no pool" — that property MUST be excluded. The evidence PROVES the property has what the user does NOT want.`;
        }
      } catch { /* ignore — semantic is enhancement, not critical */ }
    }

    const system = `You are CurateIndia's concierge — an expert on Indian travel, geography, flight routes, and driving distances.

The user wants: "${intent.intent}"${travelNote}${semanticContext}

From the shortlisted properties below, pick the ones that BEST match the user's request. Consider:
1. Experience fit — does the property offer what the user is looking for?
2. Accessibility — can the user realistically reach it given their travel constraints?
3. Suitability — is it right for their travel party (elderly, kids, couples, etc.)?
4. EXCLUSIONS (CRITICAL — apply BEFORE ranking):
   - Parse the user's query for ANY "no X" / "without X" / "not X" criteria
   - Check the SEMANTIC EVIDENCE above for each property
   - If evidence mentions the thing the user wants to AVOID (e.g., "swimming pool", "staircase", "steps", "steep"), EXCLUDE that property completely
   - Also use your own knowledge: if you know a property has pools/stairs/etc. even without explicit evidence, exclude it
   - When in doubt, EXCLUDE. A false exclusion is better than recommending something unsafe for a family with an infant.
5. SAFETY — with infants/toddlers: unfenced pools, steep stairs, elevated structures without railings are ALL dealbreakers. Exclude aggressively.

Return ONLY JSON:
{"intent":"${intent.intent}","hits":[{"propertyId":"exact id","reason":"1 vivid sentence explaining why this fits AND how to get there","matchScore":0.0-1.0}]}

Rules:
- Up to 8 hits, desc by matchScore. Quality over quantity — if only 3 fit well, return 3.
- Only use IDs from the list below. Never invent.
- In the "reason" field, mention the nearest airport or driving route if travel constraints were specified.
- If excluding a property due to user's "no X" criteria, do NOT include it at all — do not explain why it was excluded.
- DOUBLE CHECK: Before finalizing, re-read the user's exclusion criteria and verify NONE of your recommended properties violate them.`;

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
        if (is429 && attempt < MATCH_MODELS.length - 1) continue;
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
      ? "Our search is temporarily busy. Please try again in a minute."
      : "Something went wrong with the search. Please try again.";
    return NextResponse.json({ error: userMsg }, { status });
  }
}
