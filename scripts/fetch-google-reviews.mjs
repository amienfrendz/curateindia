// Fetch Google Places ratings + reviews for all properties.
// Run: node scripts/fetch-google-reviews.mjs
// Writes: src/data/property-reviews.json

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const envFile = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
const API_KEY = envFile.match(/GOOGLE_PLACES_API_KEY=(.+)/)?.[1]?.trim();
if (!API_KEY) { console.error("No GOOGLE_PLACES_API_KEY in .env.local"); process.exit(1); }

function parseProperties(text) {
  const re = /slug:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?location:\s*"([^"]+)"[\s\S]*?state:\s*"([^"]+)"/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) out.push({ slug: m[1], name: m[2], location: m[3], state: m[4] });
  return out;
}

async function main() {
  const propsTs = await fs.readFile(path.join(ROOT, "src/data/properties.ts"), "utf8");
  const properties = parseProperties(propsTs);
  console.log(`Fetching reviews for ${properties.length} properties...`);

  const outPath = path.join(ROOT, "src/data/property-reviews.json");
  const out = {};

  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    try {
      const q = `${p.name} ${p.location} ${p.state} India`;
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.reviews,places.editorialSummary",
        },
        body: JSON.stringify({ textQuery: q, maxResultCount: 1 }),
        signal: AbortSignal.timeout(15000),
      });
      const d = await r.json();
      const place = d.places?.[0];
      if (!place) { console.log(`  ${i + 1}/${properties.length} ${p.slug}: not found`); continue; }

      const reviews = (place.reviews || [])
        .map((rv) => ({
          text: rv.text?.text || "",
          rating: rv.rating,
          time: rv.relativePublishTimeDescription || "",
          author: rv.authorAttribution?.displayName || "Guest",
        }))
        .filter((rv) => rv.text.length > 20);

      out[p.slug] = {
        rating: place.rating || null,
        ratingCount: place.userRatingCount || 0,
        editorial: place.editorialSummary?.text || null,
        reviews: reviews.slice(0, 5),
        fetchedAt: new Date().toISOString(),
      };
      console.log(`  ${i + 1}/${properties.length} ${p.slug}: ★${place.rating} (${place.userRatingCount} reviews) ${reviews.length} quotes`);
    } catch (e) {
      console.log(`  ${i + 1}/${properties.length} ${p.slug}: ERROR ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  await fs.writeFile(outPath, JSON.stringify(out, null, 2));
  console.log(`\nDone. ${Object.keys(out).length}/${properties.length} properties with reviews.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
