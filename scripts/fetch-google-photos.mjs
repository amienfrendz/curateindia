// Fetch one hero photo per property from Google Places API (New).
// Run: node scripts/fetch-google-photos.mjs
// Writes: src/data/property-images.json (merges with existing)
//
// Strategy per property:
//   1. Text Search → get place_id
//   2. Place Details (photos field) → get photo resource name
//   3. Place Photo → get CDN URL (maxWidthPx=1200)
//   4. Store final redirected image URL in property-images.json

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACES_PHOTO_URL = "https://places.googleapis.com/v1";

function parseProperties(text) {
  const re =
    /slug:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?location:\s*"([^"]+)"[\s\S]*?state:\s*"([^"]+)"/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    out.push({ slug: m[1], name: m[2], location: m[3], state: m[4] });
  }
  return out;
}

async function searchPlace(name, location, state) {
  const query = `${name} ${location} ${state} India`;
  const res = await fetch(PLACES_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Search failed ${res.status}: ${txt.slice(0, 200)}`);
  }
  return await res.json();
}

async function getPhotoUrl(photoName) {
  // photoName looks like "places/PLACE_ID/photos/PHOTO_REF"
  const url = `${PLACES_PHOTO_URL}/${photoName}/media?maxWidthPx=1200&key=${API_KEY}`;
  // Follow redirect to get the actual CDN URL
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Photo fetch failed ${res.status}`);
  // The final URL after redirects is the CDN image
  return res.url;
}

async function main() {
  const propsTs = await fs.readFile(path.join(ROOT, "src/data/properties.ts"), "utf8");
  const properties = parseProperties(propsTs);
  console.log(`Parsed ${properties.length} properties`);

  const imgPath = path.join(ROOT, "src/data/property-images.json");
  let images = {};
  try { images = JSON.parse(await fs.readFile(imgPath, "utf8")); } catch {}

  // Track which ones already have a Google photo (don't re-fetch)
  const googlePhotos = new Set();
  for (const [slug, url] of Object.entries(images)) {
    if (url.includes("googleusercontent.com") || url.includes("googleapis.com")) {
      googlePhotos.add(slug);
    }
  }

  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];

    // Skip if already has a Google photo
    if (googlePhotos.has(p.slug)) {
      console.log(`  ${i + 1}/${properties.length} ${p.slug}: cached (google)`);
      continue;
    }

    try {
      const searchResult = await searchPlace(p.name, p.location, p.state);
      const place = searchResult.places?.[0];
      if (!place) {
        console.log(`  ${i + 1}/${properties.length} ${p.slug}: no place found`);
        failed++;
        continue;
      }

      const photos = place.photos;
      if (!photos || photos.length === 0) {
        console.log(`  ${i + 1}/${properties.length} ${p.slug}: no photos`);
        failed++;
        continue;
      }

      // Get the first (best) photo
      const photoName = photos[0].name;
      const photoUrl = await getPhotoUrl(photoName);

      images[p.slug] = photoUrl;
      fetched++;
      console.log(`  ${i + 1}/${properties.length} ${p.slug}: ✓ google photo`);

      // Save after each success
      await fs.writeFile(imgPath, JSON.stringify(images, null, 2));
    } catch (e) {
      console.error(`  ${i + 1}/${properties.length} ${p.slug}: ERROR ${e.message}`);
      failed++;
    }

    // Rate limit: ~5 QPS is safe for Places API
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nDone. Fetched: ${fetched}, Failed: ${failed}, Total in file: ${Object.keys(images).length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
