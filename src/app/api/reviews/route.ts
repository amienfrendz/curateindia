import { NextRequest, NextResponse } from "next/server";
import { chatJSON } from "@/lib/githubModels";
import { getPropertyBySlug } from "@/lib/repo";
import type { ReviewSummary } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE = new Map<string, { at: number; data: ReviewSummary }>();
const TTL_MS = 24 * 60 * 60 * 1000;

async function fetchSnippets(query: string): Promise<string> {
  try {
    const res = await fetch(
      `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 6000);
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const property = await getPropertyBySlug(slug);
  if (!property) return NextResponse.json({ error: "not found" }, { status: 404 });

  const cached = CACHE.get(slug);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.data);
  }

  // Two queries — once for TripAdvisor, once for Google reviews context.
  const [a, b] = await Promise.all([
    fetchSnippets(`"${property.name}" ${property.location} review`),
    fetchSnippets(`"${property.name}" tripadvisor OR booking.com review`),
  ]);
  const snippets = (a + " " + b).trim();

  // No snippets → don't burn an LLM call; return empty so UI shows graceful fallback.
  if (!snippets) {
    const empty: ReviewSummary = {
      highlights: [],
      quotes: [],
      sentiment: "limited",
      fetchedAt: new Date().toISOString(),
    };
    CACHE.set(slug, { at: Date.now(), data: empty });
    return NextResponse.json(empty);
  }

  try {
    const llm = await chatJSON<ReviewSummary>({
      system: `You distil real guest reviews from web snippets into a clean summary. Strict JSON:
{
  "highlights": ["3-6 short phrases — themes guests repeat"],
  "quotes": [{"text":"verbatim or near-verbatim short quote (1-2 sentences)","source":"site name e.g. TripAdvisor / Google / Booking","sourceUrl":"optional URL if present in snippet"}],
  "sentiment": "raves" | "loved" | "mixed" | "limited",
  "fetchedAt": "ISO now"
}
Pick at most 3 quotes, prefer specific over generic. Avoid fabricating quotes — if snippets are weak, return fewer items and sentiment="limited". Never invent URLs.`,
      user: `Property: ${property.name}, ${property.location}, ${property.state}.\nWeb snippets:\n${snippets || "(no snippets)"}\n\nReturn JSON only.`,
      temperature: 0.3,
      timeoutMs: 12000,
    });

    const data: ReviewSummary = {
      highlights: Array.isArray(llm.highlights) ? llm.highlights.slice(0, 6) : [],
      quotes: Array.isArray(llm.quotes) ? llm.quotes.slice(0, 3) : [],
      sentiment: llm.sentiment || "limited",
      fetchedAt: new Date().toISOString(),
    };
    CACHE.set(slug, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { highlights: [], quotes: [], sentiment: "limited", fetchedAt: new Date().toISOString() },
      { status: 200 }
    );
  }
}
