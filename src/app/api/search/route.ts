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

    // Split catalogue into chunks and run a quick pre-filter via cluster/keyword match,
    // then send only relevant subset to LLM.
    const queryLower = query.toLowerCase();
    
    // Score each property for relevance to the query (lightweight keyword match)
    const scored = properties.map((p) => {
      let score = 0;
      const text = `${p.name} ${p.location} ${p.state} ${p.type} ${p.clusters.join(" ")} ${p.blurb} ${p.priceTier}`.toLowerCase();
      const words = queryLower.split(/\s+/).filter(w => w.length > 2);
      for (const w of words) {
        if (text.includes(w)) score += 1;
      }
      // Boost if cluster matches
      for (const c of p.clusters) {
        if (queryLower.includes(c.replace(/-/g, " "))) score += 3;
      }
      return { p, score };
    });

    // Take top 40 by keyword relevance, plus 20 random others for diversity
    scored.sort((a, b) => b.score - a.score);
    const topRelevant = scored.slice(0, 40).map(s => s.p);
    const rest = scored.slice(40);
    // Shuffle rest and take 20
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const diverseSample = rest.slice(0, 20).map(s => s.p);
    const subset = [...topRelevant, ...diverseSample];

    const compact = subset.map((p) => (
      `${p.id}|${p.name}|${p.type}|${p.location},${p.state}|${p.clusters.join("+")}|${p.priceTier}`
    )).join("\n");

    const system = `You are CurateIndia's concierge. Match the user's request to properties from the catalogue.

Return ONLY JSON:
{"intent":"1-2 sentence restatement in second person","hits":[{"propertyId":"exact id","reason":"1-sentence why it fits","matchScore":0.0-1.0}]}

Rules: up to 12 hits, desc by matchScore. Only use IDs from the catalogue. Never invent.`;

    const userMsg = `Query: "${query}"\n\nCatalogue (${subset.length} properties, format: id|name|type|location|clusters|price):\n${compact}`;

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
