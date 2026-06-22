// Re-download gallery photos at higher resolution (2400px instead of 1200px)
// Only re-downloads properties that were curated (have 'categories' field)
// Uses existing gallery JSON — no new search/classification needed.
//
// Run: node scripts/redownload-hires.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const envFile = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
const API_KEY = envFile.match(/GOOGLE_PLACES_API_KEY=(.+)/)?.[1]?.trim();
if (!API_KEY) { console.error("No GOOGLE_PLACES_API_KEY"); process.exit(1); }

const PLACES_BASE = "https://places.googleapis.com/v1";
const PLACES_SEARCH = "https://places.googleapis.com/v1/places:searchText";
const PHOTOS_DIR = path.join(ROOT, "public/photos");
const GALLERY_JSON = path.join(ROOT, "src/data/property-gallery.json");
const PROGRESS_FILE = path.join(ROOT, "scripts/hires-progress.json");
const PHOTO_WIDTH = 2400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  return data.places?.[0]?.id;
}

async function getPhotoRefs(placeId) {
  const res = await fetch(`${PLACES_BASE}/places/${placeId}?fields=photos`, {
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

async function main() {
  const gallery = JSON.parse(await fs.readFile(GALLERY_JSON, "utf8"));
  const propsTs = await fs.readFile(path.join(ROOT, "src/data/properties.ts"), "utf8");
  const properties = parseProperties(propsTs);

  // Only re-download curated properties
  const curated = Object.entries(gallery).filter(([, v]) => v.categories);
  console.log(`\n📸 Re-downloading ${curated.length} properties at ${PHOTO_WIDTH}px\n`);

  let progress = {};
  try { progress = JSON.parse(await fs.readFile(PROGRESS_FILE, "utf8")); } catch {}

  let totalDownloads = 0;
  let totalBytes = 0;
  let failed = 0;

  for (let i = 0; i < curated.length; i++) {
    const [slug, entry] = curated[i];
    
    if (progress[slug] === "done") {
      console.log(`  ${i + 1}/${curated.length} ${slug}: cached ✓`);
      continue;
    }

    const prop = properties.find(p => p.slug === slug);
    if (!prop) { console.log(`  ${i + 1}/${curated.length} ${slug}: not in properties, skip`); continue; }

    console.log(`  ${i + 1}/${curated.length} ${slug} (${entry.photos.length} photos)`);

    try {
      // Get fresh photo refs (need resource names to download)
      const placeId = await searchPlace(prop.name, prop.location, prop.state);
      if (!placeId) throw new Error("No place found");
      await sleep(200);

      const refs = await getPhotoRefs(placeId);
      if (!refs.length) throw new Error("No photo refs");
      await sleep(200);

      // Download each photo at higher resolution
      const photoCount = entry.photos.length;
      const availableRefs = refs.slice(0, 25); // same pool as curation

      for (let j = 0; j < photoCount && j < availableRefs.length; j++) {
        const dest = path.join(PHOTOS_DIR, slug, `${j + 1}.jpg`);
        try {
          const size = await downloadPhoto(availableRefs[j].name, dest);
          totalDownloads++;
          totalBytes += size;
          await sleep(100);
        } catch (err) {
          console.log(`    ⚠ photo ${j + 1}: ${err.message}`);
        }
      }

      progress[slug] = "done";
      console.log(`    ✓ ${photoCount} photos`);
      await sleep(300);

    } catch (err) {
      console.log(`    ❌ ${err.message}`);
      failed++;
    }

    // Save progress every 5
    if (i % 5 === 0) {
      await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    }
  }

  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));

  console.log(`\n=== DONE ===`);
  console.log(`Downloaded: ${totalDownloads} photos`);
  console.log(`Total size: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Failed properties: ${failed}`);
  console.log(`API calls: ~${curated.length * 2 + totalDownloads} (search + details + photos)`);
}

main().catch(console.error);
