import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Smart image resolver:
//   1. If `url` provided → try og:image / twitter:image from that page
//   2. If still nothing, and `q` provided → Bing image search scrape
//   3. Returns { image: string|null }
// Cached for 7 days per cache-key.

const CACHE = new Map<string, { at: number; image: string | null }>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36";

async function fetchOgImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const og =
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ||
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i.exec(html)?.[1] ||
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ||
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i.exec(html)?.[1] ||
      null;

    if (!og) return null;
    if (og.startsWith("http")) return og;
    try {
      return new URL(og, pageUrl).toString();
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

// Wikipedia REST: page summary returns thumbnail.source for famous places.
// Try longer/more-specific phrases first; skip flag/logo SVGs.
// Wikipedia requires an identifying User-Agent and rate-limits aggressive callers.
async function wikipediaThumb(q: string): Promise<string | null> {
  const tokens = q
    .replace(/[^\w\s,'-]/g, " ")
    .split(/[,\s]+/)
    .filter((t) => t && t.length > 1);

  const candidates: string[] = [];
  const push = (s: string) => {
    if (s && s.length >= 4 && !candidates.includes(s)) candidates.push(s);
  };
  if (tokens.length) push(tokens.join(" "));
  if (tokens.length >= 2) push(tokens.slice(0, 2).join(" "));
  if (tokens.length >= 3) push(tokens.slice(0, 3).join(" "));
  if (tokens.length >= 2) push(tokens.slice(-2).join(" "));
  if (tokens.length) push(tokens[tokens.length - 1]);

  // Cap to 3 attempts per request to stay polite with WP.
  const tries = candidates.slice(0, 3);

  for (const t of tries) {
    if (/^(india|indian|the|a|an)$/i.test(t)) continue;
    try {
      const wikiTitle = encodeURIComponent(t.replace(/\s+/g, "_"));
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`,
        {
          headers: {
            "User-Agent": "CurateIndia/0.1 (https://github.com/curateindia)",
            Accept: "application/json",
            "Api-User-Agent": "CurateIndia/0.1 (https://github.com/curateindia)",
          },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        type?: string;
        thumbnail?: { source?: string };
        originalimage?: { source?: string };
      };
      if (data.type === "disambiguation") continue;
      const src = data.originalimage?.source || data.thumbnail?.source;
      if (!src || !src.startsWith("http")) continue;
      if (/Flag_of|Coat_of|_logo\.|_seal\.|emblem|insignia/i.test(src)) continue;
      if (/\.svg(\.png|\?|$)/i.test(src) && !/jpg|jpeg|webp/i.test(src)) continue;
      return src;
    } catch {
      continue;
    }
  }
  return null;
}

// Last-resort: a stable Wikimedia image so the UI never shows "broken".
// (Picsum.photos was unreliable on some networks.)
function lastResortFallback(): string {
  return "https://upload.wikimedia.org/wikipedia/commons/9/99/Mehrangarh_Fort_sanhita.jpg";
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const q = req.nextUrl.searchParams.get("q");

  if (!url && !q) {
    return NextResponse.json({ error: "url or q required" }, { status: 400 });
  }

  const v = req.nextUrl.searchParams.get("v") || "1";
  const cacheKey = `${v}|${url || ""}|${q || ""}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json({ image: cached.image });
  }

  let image: string | null = null;

  if (url) {
    image = await fetchOgImage(url);
  }

  if (!image && q) {
    image = await wikipediaThumb(q);
  }

  // Always return SOMETHING — Wikimedia URL guarantees the URL works.
  if (!image) {
    image = lastResortFallback();
  }

  CACHE.set(cacheKey, { at: Date.now(), image });
  return NextResponse.json(
    { image },
    {
      headers: {
        // Browser may cache for an hour; revalidate after.
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    },
  );
}
