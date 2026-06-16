// Image enrichment for properties (no LLM hallucinations).
// Strategy per property:
//   1. og:image / twitter:image from `website`
//   2. Largest plausible <img> on the website (skip logos/icons)
//   3. Wikipedia thumbnail for `name, location, state`
//   4. Cluster fallback (cluster-images.json) by primary cluster
//
// Run:  node scripts/enrich-images.mjs
// Reads:  src/data/properties.ts, src/data/cluster-images.json
// Writes: src/data/property-images.json

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36";
const WIKI_UA = "CurateIndia/0.1 (https://github.com/curateindia)";

const SKIP_RE = /(logo|favicon|sprite|icon|placeholder|spinner|loader|avatar|pixel|tracking|1x1|spacer)/i;
const ALLOW_EXT_RE = /\.(jpe?g|png|webp)(\?|$)/i;

async function fetchText(url, timeout = 20000) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(timeout),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function absolute(url, base) {
  if (!url) return null;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("http")) return url;
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

function extractOgImage(html, base) {
  const re = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const r of re) {
    const m = r.exec(html);
    if (m && m[1]) return absolute(m[1], base);
  }
  return null;
}

function extractBestImg(html, base) {
  const candidates = [];
  const imgRe = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    const tag = m[0];
    let src =
      /\bdata-src=["']([^"']+)["']/i.exec(tag)?.[1] ||
      /\bsrcset=["']([^"']+)["']/i.exec(tag)?.[1]?.split(",")[0]?.trim().split(" ")[0] ||
      /\bsrc=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!src) continue;
    src = absolute(src, base);
    if (!src) continue;
    if (SKIP_RE.test(src)) continue;
    if (!ALLOW_EXT_RE.test(src) && !/cdn|images|wp-content|uploads|media/i.test(src)) continue;

    const w = parseInt(/\bwidth=["']?(\d+)/i.exec(tag)?.[1] || "0", 10);
    const h = parseInt(/\bheight=["']?(\d+)/i.exec(tag)?.[1] || "0", 10);
    let score = 0;
    if (w >= 600 || h >= 400) score += 10;
    if (w >= 1000) score += 5;
    if (/hero|banner|cover|main|header|featured/i.test(tag)) score += 8;
    if (/wp-content\/uploads/i.test(src)) score += 4;
    if (/-(thumb|small|tiny|mini|150x|300x)/i.test(src)) score -= 5;

    candidates.push({ src, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.src || null;
}

async function wikipediaThumb(query) {
  const tokens = query
    .replace(/[^\w\s,'-]/g, " ")
    .split(/[,\s]+/)
    .filter((t) => t && t.length > 1 && !/^(india|the|a|an|stay|homestay|villa|hotel)$/i.test(t));

  const candidates = [];
  if (tokens.length) candidates.push(tokens.slice(0, 4).join(" "));
  if (tokens.length >= 3) candidates.push(tokens.slice(0, 3).join(" "));
  if (tokens.length >= 2) candidates.push(tokens.slice(0, 2).join(" "));
  if (tokens.length) candidates.push(tokens[tokens.length - 1]);

  const tried = new Set();
  for (const t of candidates) {
    if (tried.has(t)) continue;
    tried.add(t);
    try {
      const wikiTitle = encodeURIComponent(t.replace(/\s+/g, "_"));
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`,
        {
          headers: { "User-Agent": WIKI_UA, Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data.type === "disambiguation") continue;
      const src = data.originalimage?.source || data.thumbnail?.source;
      if (!src || !src.startsWith("http")) continue;
      if (/Flag_of|Coat_of|_logo\.|_seal\.|emblem|insignia/i.test(src)) continue;
      if (/\.svg/i.test(src)) continue;
      return src;
    } catch {
      continue;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

// Bing image search REMOVED — too noisy (returned anime, cars, NSFW for ambiguous names).
// We only trust images from:
//   - the property's own website domain
//   - hotel review sites (TripAdvisor, Booking, Airbnb) via Bing site: search
//   - Wikipedia thumbnails
//   - cluster fallback image
// Anything else is rejected.

const SAFE_HOSTS_RE =
  /(upload\.wikimedia\.org|cf\.bstatic\.com|media-cdn\.tripadvisor\.com|dynamic-media-cdn\.tripadvisor\.com|a0\.muscache\.com|aff\.bstatic\.com|q-xx\.bstatic\.com|images\.trvl-media\.com)/i;

function isSafeHost(imgUrl, ownDomain) {
  if (!imgUrl) return false;
  try {
    const host = new URL(imgUrl).hostname.toLowerCase();
    if (SAFE_HOSTS_RE.test(imgUrl)) return true;
    if (ownDomain) {
      const own = ownDomain.replace(/^www\./, "");
      if (host === own || host.endsWith("." + own)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Find a property page on a specific hotel-review host via Bing site: search,
// then return its og:image.
async function findOgViaBingSite(query, siteDomain) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(`site:${siteDomain} ${query}`)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const linkRe = new RegExp(
      `<a[^>]+href="(https?:\\/\\/(?:www\\.)?${siteDomain.replace(/\./g, "\\.")}\\/[^"\\s]+)"`,
      "gi"
    );
    const seen = new Set();
    for (const m of html.matchAll(linkRe)) {
      const u = m[1].split("#")[0];
      if (seen.has(u)) continue;
      seen.add(u);
      // skip homepage / search / list pages
      if (/\/(search|filter|tag|category|map|reviews-list)\b/i.test(u)) continue;
      if (u.replace(/^https?:\/\/[^/]+\/?$/, "") === "") continue;
      const page = await fetchText(u, 8000);
      if (!page) continue;
      const og = extractOgImage(page, u);
      if (og && (await isReachable(og))) return og;
    }
    return null;
  } catch {
    return null;
  }
}

async function isReachable(url) {
  if (!url || !url.startsWith("http")) return false;
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, {
        method,
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
        headers: {
          "User-Agent": UA,
          ...(method === "GET" ? { Range: "bytes=0-2047" } : {}),
        },
      });
      if (!res.ok && res.status !== 206) continue;
      const ct = res.headers.get("content-type") || "";
      if (ct.startsWith("image/")) return true;
      if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)) return true;
      return false;
    } catch {
      continue;
    }
  }
  return false;
}

function parseProperties(text) {
  // crude block-by-block parser over the static TS array
  const out = [];
  const blocks = text.split(/\n\s*\{\s*$/m); // approximate
  // Better: regex with lazy block extraction
  const re =
    /\{\s*id:\s*"([^"]+)",[\s\S]*?slug:\s*"([^"]+)",[\s\S]*?name:\s*"([^"]+)",[\s\S]*?location:\s*"([^"]+)",[\s\S]*?state:\s*"([^"]+)"[\s\S]*?clusters:\s*\[([^\]]+)\][\s\S]*?(?=\n\s*\},?\s*\n)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const block = text.slice(m.index, re.lastIndex);
    const websiteM = /website:\s*"([^"]+)"/.exec(block);
    const blurbM = /blurb:\s*"([^"]+)"/.exec(block);
    const clustersRaw = m[6];
    const clusters = [...clustersRaw.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    out.push({
      id: m[1],
      slug: m[2],
      name: m[3],
      location: m[4],
      state: m[5],
      clusters,
      website: websiteM?.[1],
      blurb: blurbM?.[1],
    });
  }
  return out;
}

async function enrich(p, clusterMap) {
  const ownDomain = p.website
    ? (() => {
        try {
          return new URL(p.website).hostname.toLowerCase().replace(/^www\./, "");
        } catch {
          return null;
        }
      })()
    : null;

  // 1. og:image / largest <img> from property's own website.
  // ANY image referenced by the property owner's site is trusted (Wix/Squarespace
  // host on their own CDNs; we don't require same-origin here).
  if (p.website) {
    const tryPaths = ["", "/about", "/about-us", "/home", "/rooms", "/accommodation", "/gallery", "/stay"];
    let baseUrl;
    try { baseUrl = new URL(p.website); } catch { baseUrl = null; }
    for (const sub of tryPaths) {
      if (!baseUrl && sub) break;
      const u = sub ? new URL(sub, baseUrl).toString() : p.website;
      const html = await fetchText(u);
      if (!html) continue;
      const og = extractOgImage(html, u);
      if (og && !SKIP_RE.test(og) && (await isReachable(og))) {
        return { url: og, src: sub ? `og:${sub}` : "og" };
      }
      const big = extractBestImg(html, u);
      if (big && (await isReachable(big))) {
        return { url: big, src: sub ? `img:${sub}` : "img" };
      }
    }
  }

  // 2. TripAdvisor (hotel review sites have moderated photography)
  const taQuery = `${p.name} ${p.location} ${p.state}`;
  const ta = await findOgViaBingSite(taQuery, "tripadvisor.com");
  if (ta) return { url: ta, src: "tripadvisor" };

  // 3. Booking.com
  const bk = await findOgViaBingSite(taQuery, "booking.com");
  if (bk) return { url: bk, src: "booking" };

  // 4. Wikipedia (works for landmark properties)
  const wiki = await wikipediaThumb(`${p.name} ${p.location} ${p.state}`);
  if (wiki && (await isReachable(wiki))) return { url: wiki, src: "wiki" };

  // 5. Final fallback: cluster image (always on-theme, never inappropriate)
  const cluster = p.clusters?.[0];
  if (cluster && clusterMap[cluster]) return { url: clusterMap[cluster], src: "cluster" };

  return { url: null, src: "miss" };
}

async function main() {
  const propsTs = await fs.readFile(path.join(ROOT, "src/data/properties.ts"), "utf8");
  const properties = parseProperties(propsTs);
  console.log(`Parsed ${properties.length} properties`);

  let clusterMap = {};
  try {
    clusterMap = JSON.parse(
      await fs.readFile(path.join(ROOT, "src/data/cluster-images.json"), "utf8")
    );
  } catch {}

  const existing = JSON.parse(
    await fs.readFile(path.join(ROOT, "src/data/property-images.json"), "utf8").catch(() => "{}")
  );

  const out = { ...existing };
  let i = 0;
  for (const p of properties) {
    i++;
    if (out[p.slug]) {
      console.log(`  ${i}/${properties.length} ${p.slug}: cached`);
      continue;
    }
    const r = await enrich(p, clusterMap);
    if (r.url) out[p.slug] = r.url;
    console.log(`  ${i}/${properties.length} ${p.slug}: ${r.src}`);
    await fs.writeFile(
      path.join(ROOT, "src/data/property-images.json"),
      JSON.stringify(out, null, 2)
    );
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(
    `\nDone. ${Object.keys(out).length}/${properties.length} properties resolved.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
