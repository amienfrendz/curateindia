import { NextRequest, NextResponse } from "next/server";
import { chatJSON } from "@/lib/githubModels";
import { getPropertyBySlug } from "@/lib/repo";
import type { AvailabilityResult } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory cache (per-process). Real deployment should use Redis / KV.
const CACHE = new Map<string, { at: number; data: AvailabilityResult }>();
const TTL_MS = 30 * 60 * 1000;

async function fetchSearchSnippets(query: string): Promise<string> {
  // DuckDuckGo HTML scrape — best-effort signal source for grounding.
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
    // Crude text extraction
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 4000);
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const checkin = req.nextUrl.searchParams.get("checkin") || "";
  const checkout = req.nextUrl.searchParams.get("checkout") || "";
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const property = await getPropertyBySlug(slug);
  if (!property) return NextResponse.json({ error: "not found" }, { status: 404 });

  const cacheKey = `${slug}|${checkin}|${checkout}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const dateClause = checkin && checkout ? `for ${checkin} to ${checkout}` : "in the next 60 days";
  const groundingQuery = `"${property.name}" ${property.location} availability booking ${checkin || ""} ${checkout || ""}`;
  const snippets = await fetchSearchSnippets(groundingQuery);

  try {
    const llm = await chatJSON<AvailabilityResult>({
      system: `You assess hotel/homestay availability from web snippets. Respond with strict JSON:
{
  "status": "likely-available" | "limited" | "likely-full" | "unknown",
  "note": "one short sentence — be honest, hedge appropriately, avoid invented certainty",
  "sources": [{"label":"site name","url":"..."}],
  "fetchedAt": "ISO timestamp now"
}
If snippets are weak or absent, status MUST be "unknown" with a note suggesting checking direct.`,
      user: `Property: ${property.name}, ${property.location}, ${property.state}.\nWindow: ${dateClause}.\nWeb snippets:\n${snippets || "(no snippets)"}\n\nReturn JSON only.`,
      temperature: 0.2,
      timeoutMs: 12000,
    });

    const data: AvailabilityResult = {
      status: llm.status || "unknown",
      note: llm.note || "Best to check directly with the host.",
      sources: Array.isArray(llm.sources) ? llm.sources.slice(0, 4) : [],
      fetchedAt: new Date().toISOString(),
    };

    CACHE.set(cacheKey, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    const fallback: AvailabilityResult = {
      status: "unknown",
      note: "Couldn't read live signals — please check Google Hotels or Booking directly.",
      sources: [],
      fetchedAt: new Date().toISOString(),
    };
    return NextResponse.json(fallback);
  }
}
