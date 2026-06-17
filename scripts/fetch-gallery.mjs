// Fetch gallery photos (up to 10) per property from Google Places API (New).
// Run: node scripts/fetch-gallery.mjs
//
// Strategy per property:
//   1. Text Search → get place_id + up to 20 photo references with author attributions
//   2. Classify: host photos (author matches business) vs guest photos (person names)
//   3. Pick 4-5 host + 5-6 guest for balanced gallery
//   4. Download each to public/photos/{slug}/ at 1200px width
//   5. Write src/data/property-gallery.json with metadata
//
// Flags properties with fewer than 3 photos as "low-quality" for review.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const envFile = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
const API_KEY = envFile.match(/GOOGLE_PLACES_API_KEY=(.+)/)?.[1]?.trim() || "";
if (!API_KEY) { console.error("No GOOGLE_PLACES_API_KEY in .env.local"); process.exit(1); }

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACES_PHOTO_URL = "https://places.googleapis.com/v1";
const PHOTOS_DIR = path.join(ROOT, "public/photos");
const GALLERY_JSON = path.join(ROOT, "src/data/property-gallery.json");
const MAX_PHOTOS_PER_PROPERTY = 10;
const PHOTO_WIDTH = 1200;

function parseProperties(text) {
  const re = /slug:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?location:\s*"([^"]+)"[\s\S]*?state:\s*"([^"]+)"/g;
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

async function downloadPhoto(photoName, destPath) {
  const url = `${PLACES_PHOTO_URL}/${photoName}/media?maxWidthPx=${PHOTO_WIDTH}&key=${API_KEY}`;
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Photo download failed ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);
  return res.url; // CDN URL for reference
}

function classifyPhotos(photos, businessName) {
  const nameLower = businessName.toLowerCase();
  const host = [];
  const guest = [];

  for (const photo of photos) {
    const authorName = photo.authorAttributions?.[0]?.displayName || "";
    const authorLower = authorName.toLowerCase();

    // Host photo: author matches business name, or is "Owner", or has no author
    const isHost = !authorName
      || authorLower.includes(nameLower.split(" ")[0])
      || nameLower.includes(authorLower.split(" ")[0])
      || authorLower.includes("owner")
      || authorLower.includes("hotel")
      || authorLower.includes("resort")
      || authorLower.includes("homestay")
      || authorLower.includes("estate");

    if (isHost) {
      host.push(photo);
    } else {
      guest.push(photo);
    }
  }

  return { host, guest };
}

function selectGallery(host, guest) {
  // Target: 4-5 host + 5-6 guest = 10 total
  // If not enough of one type, fill from the other
  const maxHost = 5;
  const maxGuest = 6;

  const selectedHost = host.slice(0, maxHost);
  const selectedGuest = guest.slice(0, maxGuest);
  const total = selectedHost.length + selectedGuest.length;

  // Fill to 10 if possible
  if (total < MAX_PHOTOS_PER_PROPERTY) {
    const remaining = MAX_PHOTOS_PER_PROPERTY - total;
    if (selectedHost.length < maxHost) {
      // More guest available
      const extra = guest.slice(maxGuest, maxGuest + remaining);
      selectedGuest.push(...extra);
    } else {
      // More host available
      const extra = host.slice(maxHost, maxHost + remaining);
      selectedHost.push(...extra);
    }
  }

  return [
    ...selectedHost.map(p => ({ ...p, _type: "host" })),
    ...selectedGuest.map(p => ({ ...p, _type: "guest" })),
  ];
}

async function main() {
  const propsTs = await fs.readFile(path.join(ROOT, "src/data/properties.ts"), "utf8");
  const properties = parseProperties(propsTs);
  console.log(`Parsed ${properties.length} properties`);

  // Load existing gallery data (skip already-fetched)
  let gallery = {};
  try { gallery = JSON.parse(await fs.readFile(GALLERY_JSON, "utf8")); } catch {}

  const flagged = []; // properties with < 3 photos
  let totalApiCalls = 0;
  let totalPhotosDownloaded = 0;

  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    const slug = p.slug;

    // Skip if already fetched with enough photos
    if (gallery[slug]?.photos?.length >= 3) {
      console.log(`  ${i + 1}/${properties.length} ${slug}: cached (${gallery[slug].photos.length} photos)`);
      continue;
    }

    const propertyPhotosDir = path.join(PHOTOS_DIR, slug);
    await fs.mkdir(propertyPhotosDir, { recursive: true });

    try {
      // 1. Search for the place
      const searchResult = await searchPlace(p.name, p.location, p.state);
      totalApiCalls++;
      const place = searchResult.places?.[0];

      if (!place) {
        console.log(`  ${i + 1}/${properties.length} ${slug}: ❌ no place found`);
        flagged.push({ slug, name: p.name, reason: "No Google Place found" });
        continue;
      }

      const allPhotos = place.photos || [];
      if (allPhotos.length === 0) {
        console.log(`  ${i + 1}/${properties.length} ${slug}: ❌ no photos`);
        flagged.push({ slug, name: p.name, reason: "No photos on Google" });
        continue;
      }

      // 2. Classify host vs guest
      const businessName = place.displayName?.text || p.name;
      const { host, guest } = classifyPhotos(allPhotos, businessName);

      // 3. Select balanced gallery
      const selected = selectGallery(host, guest);

      // 4. Download each photo
      const photoEntries = [];
      for (let j = 0; j < selected.length; j++) {
        const photo = selected[j];
        const photoName = photo.name;
        const ext = "jpg";
        const filename = `${j + 1}.${ext}`;
        const destPath = path.join(propertyPhotosDir, filename);

        try {
          await downloadPhoto(photoName, destPath);
          totalApiCalls++;
          totalPhotosDownloaded++;

          photoEntries.push({
            file: `/photos/${slug}/${filename}`,
            type: photo._type,
            author: photo.authorAttributions?.[0]?.displayName || null,
            widthPx: photo.widthPx || null,
            heightPx: photo.heightPx || null,
          });

          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.log(`    photo ${j + 1} failed: ${err.message}`);
        }
      }

      gallery[slug] = {
        photos: photoEntries,
        totalAvailable: allPhotos.length,
        hostCount: photoEntries.filter(p => p.type === "host").length,
        guestCount: photoEntries.filter(p => p.type === "guest").length,
        fetchedAt: new Date().toISOString(),
      };

      if (photoEntries.length < 3) {
        flagged.push({ slug, name: p.name, reason: `Only ${photoEntries.length} photos downloadable` });
      }

      console.log(`  ${i + 1}/${properties.length} ${slug}: ✓ ${photoEntries.length} photos (${gallery[slug].hostCount} host, ${gallery[slug].guestCount} guest)`);

      // Rate limit: pause between properties
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.log(`  ${i + 1}/${properties.length} ${slug}: ❌ ${err.message}`);
      flagged.push({ slug, name: p.name, reason: err.message });
    }

    // Save progress incrementally (every 5 properties)
    if (i % 5 === 0) {
      await fs.writeFile(GALLERY_JSON, JSON.stringify(gallery, null, 2));
    }
  }

  // Final save
  await fs.writeFile(GALLERY_JSON, JSON.stringify(gallery, null, 2));

  // Report
  console.log(`\n=== DONE ===`);
  console.log(`API calls used: ${totalApiCalls}`);
  console.log(`Photos downloaded: ${totalPhotosDownloaded}`);
  console.log(`Properties with gallery: ${Object.keys(gallery).length}`);

  if (flagged.length > 0) {
    console.log(`\n=== FLAGGED FOR REVIEW (${flagged.length}) ===`);
    for (const f of flagged) {
      console.log(`  ${f.slug}: ${f.reason}`);
    }
    await fs.writeFile(
      path.join(ROOT, "scripts/gallery-flagged.json"),
      JSON.stringify(flagged, null, 2)
    );
    console.log(`\nFlagged list saved to scripts/gallery-flagged.json`);
  }
}

main().catch(console.error);
