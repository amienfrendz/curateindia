import { NextRequest, NextResponse } from "next/server";
import { chatJSON } from "@/lib/githubModels";
import { getAllProperties } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LLMResponse = {
  intent: string;
  hits: { propertyId: string; reason: string; matchScore: number }[];
};

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const properties = await getAllProperties();
    // Compact catalogue for the LLM. Trim verbose fields to keep the prompt
    // under gpt-4o-mini's 8000-token request limit (catalogue is now 65+).
    const compact = properties.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      loc: `${p.location}, ${p.state}`,
      clusters: p.clusters,
      tier: p.priceTier,
      blurb: p.blurb,
    }));

    const system = `You are CurateIndia's conversational concierge. The user describes the kind of stay they want, in any tone — moods, food, landscapes, budgets, dates, occasions. You match against a curated catalogue of small Indian experiential stays (havelis, villas, bungalows, cottages, huts, homestays, houseboats, ashrams, farmstays, treehouses, mostly ≤10 rooms, hosted, family/community-run).

Return ONLY a JSON object with shape:
{
  "intent": "1-2 sentence restatement of what the user wants, in second person ('You're after...')",
  "hits": [{ "propertyId": "<exact id from catalogue>", "reason": "1-sentence specific reason this property fits — name the experience or food or host hook", "matchScore": 0.0-1.0 }]
}

Rules:
- Return up to 12 hits, ordered by matchScore (desc).
- Only use propertyIds that exist in the catalogue. Never invent.
- If the user's request is incompatible with the catalogue, return zero hits and explain in intent.
- Reasons must reference the property's actual experiences/food/location — no generic praise.`;

    const userMsg = `User query:\n"""${query}"""\n\nCatalogue (${compact.length} properties):\n${JSON.stringify(compact)}`;

    const llm = await chatJSON<LLMResponse>({
      system,
      user: userMsg,
      temperature: 0.3,
    });

    const validIds = new Set(properties.map((p) => p.id));
    const validHits = (llm.hits || [])
      .filter((h) => validIds.has(h.propertyId))
      .slice(0, 12)
      .map((h) => {
        const property = properties.find((p) => p.id === h.propertyId)!;
        return {
          propertyId: h.propertyId,
          reason: h.reason,
          matchScore: h.matchScore,
          property,
        };
      });

    return NextResponse.json({ intent: llm.intent || "", hits: validHits });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "search failed";
    const status = msg.includes("429") ? 429 : 500;
    const userMsg = status === 429
      ? "Our AI is temporarily rate-limited. Please try again in a minute."
      : "Something went wrong with the search. Please try again.";
    return NextResponse.json({ error: userMsg }, { status });
  }
}
