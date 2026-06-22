// Enhanced gallery curation: fetches more photos, uses AI vision to classify by category,
// selects optimal mix of room/dining/common/experience photos.
//
// Run: node scripts/curate-gallery.mjs
//
// Pipeline per property:
//   1. Text Search → placeId
//   2. Place Details → all photo references (up to 25)
//   3. Download candidates
//   4. GPT-4o-mini vision → classify each photo (category + quality)
//   5. Select best 10-15 based on category targets
//   6. Update gallery JSON
//
// Resumable: saves progress to scripts/curate-progress.json

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const envFile = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
const API_KEY = envFile.match(/GOOGLE_PLACES_API_KEY=(.+)/)?.[1]?.trim();
const GITHUB_TOKEN = envFile.match(/GITHUB_TOKEN=(.+)/)?.[1]?.trim();
if (!API_KEY) { console.error("No GOOGLE_PLACES_API_KEY in .env.local"); process.exit(1); }
if (!GITHUB_TOKEN) { console.error("No GITHUB_TOKEN in .env.local"); process.exit(1); }

const PLACES_SEARCH = "https://places.googleapis.com/v1/places:searchText";
const PLACES_BASE = "https://places.googleapis.com/v1";
const VISION_URL = "https://models.inference.ai.azure.com/chat/completions";

const PHOTOS_DIR = path.join(ROOT, "public/photos");
const GALLERY_JSON = path.join(ROOT, "src/data/property-gallery.json");
const PROGRESS_JSON = path.join(ROOT, "scripts/curate-progress.json");

const MAX_CANDIDATES = 25;
const PHOTO_WIDTH = 1200;

// Category targets (minimum desired per property)
const TARGETS = { ROOM: 4, DINING: 2, COMMON: 3, EXPERIENCE: 2 };
const MAX_FINAL = 15;
const MIN_FINAL = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Helpers ── */

function parseProperties(text) {
  const re = /slug:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?location:\s*"([^"]+)"[\s\S]*?state:\s*"([^"]+)"/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) out.push({ slug: m[1], name: m[2], location: m[3], state: m[4] });
  return out;
}

async function searchPlace(name, location, state) {
  const res = await fetch(PLACES_SEARCH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName",
    },
    body: JSON.stringify({ textQuery: `${name} ${location} ${state} India`, maxResultCount: 1 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Search ${res.status}`);
  const data = await res.json();
  const place = data.places?.[0];
  if (!place) throw new Error("No place found");
  return { placeId: place.id, businessName: place.displayName?.text || name };
}

async function getPhotoRefs(placeId) {
  const url = `${PLACES_BASE}/places/${placeId}?fields=photos`;
  const res = await fetch(url, {
    headers: { "X-Goog-Api-Key": API_KEY },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Details ${res.status}`);
  const data = await res.json();
  return data.photos || [];
}

async function downloadPhoto(photoName, dest) {
  const url = `${PLACES_BASE}/${photoName}/media?maxWidthPx=${PHOTO_WIDTH}&key=${API_KEY}`;
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Photo ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  return buf.length;
}

function isHostPhoto(authorName, businessName) {
  if (!authorName) return true;
  const a = authorName.toLowerCase();
  const b = businessName.toLowerCase();
  const firstWord = b.split(/\s+/)[0];
  return a.includes(firstWord) || b.includes(a.split(/\s+/)[0])
    || ["owner", "hotel", "resort", "homestay", "estate", "lodge", "villa", "fort", "palace", "haveli"].some((k) => a.includes(k));
}

/* ── Vision classification ── */

async function classifyBatch(imagePaths, propertyName, retries = 2) {
  const content = [
    {
      type: "text",
      text: `Classify each photo of "${propertyName}" (an Indian hotel/homestay). Photos numbered 1-${imagePaths.length}.

Categories (pick ONE):
ROOM — bedroom, bathroom, suite, bed, room amenities
DINING — food, restaurant, kitchen, meals, breakfast setup, cooking area
COMMON — pool, garden, terrace, lobby, lounge, verandah, courtyard, sitting area, living room
EXPERIENCE — activities, yoga, safari, trekking, cultural, nature views, wildlife, spa, local crafts, music
EXTERIOR — building facade, entrance, aerial, surroundings, landscape
OTHER — staff, logos, maps, text, too blurry, unrelated

Quality 1-5: 1=poor/blurry 2=below-avg 3=decent 4=good 5=stunning

Return ONLY JSON array: [{"idx":1,"cat":"ROOM","q":4},...]`,
    },
  ];

  for (const p of imagePaths) {
    const b64 = (await fs.readFile(p)).toString("base64");
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "low" } });
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(VISION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GITHUB_TOKEN}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content }],
          temperature: 0.1,
          max_tokens: 1200,
        }),
        signal: AbortSignal.timeout(90000),
      });

      if (res.status === 429) {
        const wait = Math.pow(2, attempt + 1) * 30000; // 60s, 120s, 240s
        console.log(`    ⏳ Rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`Vision API ${res.status}: ${(await res.text()).slice(0, 150)}`);

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || "[]";
      const cleaned = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`    ⚠ Attempt ${attempt + 1} failed: ${err.message}, retrying...`);
      await sleep(5000);
    }
  }
  return [];
}

/* ── Selection logic ── */

function selectBest(classifications, photoRefs, businessName) {
  // Enrich with host/guest info
  const items = classifications.map((c) => {
    const i = (c.idx || 1) - 1; // idx is 1-based from prompt
    const ref = photoRefs[i];
    const author = ref?.authorAttributions?.[0]?.displayName || "";
    return {
      refIdx: i,
      cat: c.cat || "OTHER",
      quality: c.q || 2,
      isHost: isHostPhoto(author, businessName),
      author,
      ref,
    };
  });

  // Drop OTHER and very low quality
  const usable = items.filter((p) => p.cat !== "OTHER" && p.quality >= 2);

  // Sort within each category: host first, then quality desc
  const byCat = {};
  for (const p of usable) {
    (byCat[p.cat] ||= []).push(p);
  }
  for (const cat of Object.keys(byCat)) {
    byCat[cat].sort((a, b) => (a.isHost === b.isHost ? b.quality - a.quality : a.isHost ? -1 : 1));
  }

  const picked = new Set();
  const selected = [];

  function pick(p) {
    if (picked.has(p.refIdx)) return false;
    picked.add(p.refIdx);
    selected.push(p);
    return true;
  }

  // Phase 1: fill category targets
  for (const [cat, target] of Object.entries(TARGETS)) {
    for (const p of byCat[cat] || []) {
      if (selected.filter((s) => s.cat === cat).length >= target) break;
      pick(p);
    }
  }

  // Phase 2: add up to 2 exterior shots
  for (const p of (byCat.EXTERIOR || []).slice(0, 2)) pick(p);

  // Phase 3: fill to MIN_FINAL with best remaining
  if (selected.length < MIN_FINAL) {
    const remaining = usable.filter((p) => !picked.has(p.refIdx)).sort((a, b) => b.quality - a.quality);
    for (const p of remaining) {
      if (selected.length >= MIN_FINAL) break;
      pick(p);
    }
  }

  // Phase 4: bonus high-quality up to MAX_FINAL
  if (selected.length < MAX_FINAL) {
    const bonus = usable.filter((p) => !picked.has(p.refIdx) && p.quality >= 4).sort((a, b) => b.quality - a.quality);
    for (const p of bonus) {
      if (selected.length >= MAX_FINAL) break;
      pick(p);
    }
  }

  return selected;
}

/* ── Main ── */

async function main() {
  const propsTs = await fs.readFile(path.join(ROOT, "src/data/properties.ts"), "utf8");
  const properties = parseProperties(propsTs);
  console.log(`\n🎨 Gallery Curation — ${properties.length} properties\n`);

  let gallery = {};
  try { gallery = JSON.parse(await fs.readFile(GALLERY_JSON, "utf8")); } catch {}
  let progress = {};
  try { progress = JSON.parse(await fs.readFile(PROGRESS_JSON, "utf8")); } catch {}

  const counts = { done: 0, improved: 0, skipped: 0, failed: 0 };
  const apiCalls = { search: 0, details: 0, photos: 0, vision: 0 };

  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    const { slug } = p;

    if (progress[slug]?.status === "done") {
      console.log(`  ${i + 1}/${properties.length} ${slug}: cached ✓`);
      counts.skipped++;
      continue;
    }

    console.log(`\n  ${i + 1}/${properties.length} ${slug}`);
    const candDir = path.join(PHOTOS_DIR, slug, "candidates");

    try {
      // 1. Search
      const { placeId, businessName } = await searchPlace(p.name, p.location, p.state);
      apiCalls.search++;
      await sleep(300);

      // 2. Photo refs
      const allRefs = await getPhotoRefs(placeId);
      apiCalls.details++;
      const refs = allRefs.slice(0, MAX_CANDIDATES);
      console.log(`    ${allRefs.length} photos available, downloading ${refs.length}`);

      if (refs.length < 3) {
        console.log(`    ❌ Too few photos`);
        progress[slug] = { status: "failed", reason: "< 3 photos" };
        counts.failed++;
        continue;
      }

      // 3. Download candidates
      await fs.mkdir(candDir, { recursive: true });
      const paths = [];
      for (let j = 0; j < refs.length; j++) {
        const dest = path.join(candDir, `${j + 1}.jpg`);
        try {
          await downloadPhoto(refs[j].name, dest);
          paths.push(dest);
          apiCalls.photos++;
          await sleep(150);
        } catch (err) {
          console.log(`    ⚠ photo ${j + 1} skip: ${err.message}`);
        }
      }
      console.log(`    Downloaded ${paths.length} candidates`);

      if (paths.length < 3) {
        console.log(`    ❌ Too few downloaded`);
        progress[slug] = { status: "failed", reason: "downloads failed" };
        counts.failed++;
        try { await fs.rm(candDir, { recursive: true }); } catch {}
        continue;
      }

      // 4. Classify
      console.log(`    Classifying with AI...`);
      const classifications = await classifyBatch(paths, p.name);
      apiCalls.vision++;

      if (!classifications.length) {
        console.log(`    ❌ Classification empty`);
        progress[slug] = { status: "failed", reason: "classification failed" };
        counts.failed++;
        try { await fs.rm(candDir, { recursive: true }); } catch {}
        continue;
      }

      const catBreak = {};
      for (const c of classifications) catBreak[c.cat] = (catBreak[c.cat] || 0) + 1;
      console.log(`    Breakdown: ${Object.entries(catBreak).map(([k, v]) => `${k}:${v}`).join(" ")}`);

      // 5. Select
      const selected = selectBest(classifications, refs, businessName);
      console.log(`    Selected ${selected.length} photos`);

      // 6. Write final photos
      const finalDir = path.join(PHOTOS_DIR, slug);
      for (let j = 1; j <= 20; j++) {
        try { await fs.unlink(path.join(finalDir, `${j}.jpg`)); } catch {}
      }

      const entries = [];
      for (let j = 0; j < selected.length; j++) {
        const s = selected[j];
        const src = path.join(candDir, `${s.refIdx + 1}.jpg`);
        const dest = path.join(finalDir, `${j + 1}.jpg`);
        await fs.copyFile(src, dest);

        entries.push({
          file: `/photos/${slug}/${j + 1}.jpg`,
          type: s.isHost ? "host" : "guest",
          category: s.cat,
          quality: s.quality,
          author: s.author || null,
          widthPx: s.ref?.widthPx || null,
          heightPx: s.ref?.heightPx || null,
        });
      }

      // 7. Cleanup
      try { await fs.rm(candDir, { recursive: true }); } catch {}

      // 8. Update gallery
      const cats = {};
      for (const e of entries) cats[e.category] = (cats[e.category] || 0) + 1;

      gallery[slug] = {
        photos: entries,
        totalAvailable: allRefs.length,
        hostCount: entries.filter((e) => e.type === "host").length,
        guestCount: entries.filter((e) => e.type === "guest").length,
        categories: cats,
        fetchedAt: new Date().toISOString(),
      };

      progress[slug] = { status: "done", count: entries.length };
      counts.done++;

      const summary = Object.entries(cats).map(([k, v]) => `${k}:${v}`).join(" ");
      console.log(`    ✓ ${entries.length} final — ${summary} (${gallery[slug].hostCount}H/${gallery[slug].guestCount}G)`);

      await sleep(1000); // pause between properties

    } catch (err) {
      console.log(`    ❌ ${err.message}`);
      progress[slug] = { status: "failed", reason: err.message };
      counts.failed++;
      try { await fs.rm(candDir, { recursive: true }); } catch {}
    }

    // Incremental save every 3 properties
    if (i % 3 === 0) {
      await fs.writeFile(GALLERY_JSON, JSON.stringify(gallery, null, 2));
      await fs.writeFile(PROGRESS_JSON, JSON.stringify(progress, null, 2));
    }
  }

  // Final save
  await fs.writeFile(GALLERY_JSON, JSON.stringify(gallery, null, 2));
  await fs.writeFile(PROGRESS_JSON, JSON.stringify(progress, null, 2));

  console.log(`\n=== CURATION COMPLETE ===`);
  console.log(`Done: ${counts.done}  Improved: ${counts.improved}  Skipped: ${counts.skipped}  Failed: ${counts.failed}`);
  console.log(`Google API: ${apiCalls.search} search + ${apiCalls.details} details + ${apiCalls.photos} photos = ${apiCalls.search + apiCalls.details + apiCalls.photos} total`);
  console.log(`Vision API: ${apiCalls.vision} calls`);
}

main().catch(console.error);
