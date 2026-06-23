/**
 * Fetch Google generativeSummary for each property.
 * Uses Google Places API (New) — free within 10K calls/month.
 * Output: src/data/semantic/generative-summaries.json
 *
 * Usage: node scripts/fetch-generative-summaries.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || (() => {
  // Try reading from .env.local
  const envFile = join(process.cwd(), ".env.local");
  if (existsSync(envFile)) {
    const content = readFileSync(envFile, "utf-8");
    const match = content.match(/GOOGLE_PLACES_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }
  throw new Error("GOOGLE_PLACES_API_KEY not set");
})();

const OUTPUT_FILE = join(process.cwd(), "src", "data", "semantic", "generative-summaries.json");
const PLACE_DATA_FILE = join(process.cwd(), "scripts", "place-data.json");

// Load place IDs from existing place-data.json
let placeData = {};
if (existsSync(PLACE_DATA_FILE)) {
  placeData = JSON.parse(readFileSync(PLACE_DATA_FILE, "utf-8"));
}

// Get current property slugs + names
const propsContent = readFileSync(join(process.cwd(), "src", "data", "properties.ts"), "utf-8");
const slugs = [...propsContent.matchAll(/slug:\s*"([^"]+)"/g)].map(m => m[1]);
const names = [...propsContent.matchAll(/name:\s*"([^"]+)"/g)].map(m => m[1]);
const locations = [...propsContent.matchAll(/location:\s*"([^"]+)"/g)].map(m => m[1]);
const states = [...propsContent.matchAll(/state:\s*"([^"]+)"/g)].map(m => m[1]);

console.log(`Processing ${slugs.length} properties...`);

// Load existing results to resume
let results = {};
if (existsSync(OUTPUT_FILE)) {
  results = JSON.parse(readFileSync(OUTPUT_FILE, "utf-8"));
  console.log(`Resuming — ${Object.keys(results).length} already fetched`);
}

async function searchPlace(name, location, state) {
  const query = `${name} ${location} ${state} India`;
  const url = `https://places.googleapis.com/v1/places:searchText`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.generativeSummary",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places search failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function getPlaceDetails(placeId) {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "id,displayName,generativeSummary,reviews,editorialSummary",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Place details failed: ${res.status} ${text}`);
  }
  return res.json();
}

let fetched = 0;
let skipped = 0;

for (let i = 0; i < slugs.length; i++) {
  const slug = slugs[i];
  if (results[slug]) {
    skipped++;
    continue;
  }

  const name = names[i];
  const location = locations[i];
  const state = states[i];

  try {
    // Step 1: Find place
    const searchResult = await searchPlace(name, location, state);
    const place = searchResult.places?.[0];
    if (!place) {
      console.log(`  ${slug}: No place found`);
      results[slug] = { error: "not_found" };
      continue;
    }

    // Step 2: Get details with generativeSummary
    const details = await getPlaceDetails(place.id);

    results[slug] = {
      placeId: place.id,
      displayName: details.displayName?.text || name,
      generativeSummary: details.generativeSummary?.overview?.text || null,
      editorialSummary: details.editorialSummary?.text || null,
      reviews: (details.reviews || []).map(r => ({
        text: r.text?.text || "",
        rating: r.rating,
        author: r.authorAttribution?.displayName || "",
      })),
      fetchedAt: new Date().toISOString(),
    };

    fetched++;
    console.log(`  ${slug}: ✓ ${details.generativeSummary ? "Has generativeSummary" : "No generativeSummary (editorial only)"}`);

    // Rate limit: 1 req/sec to be safe
    await new Promise(r => setTimeout(r, 1000));
  } catch (err) {
    console.error(`  ${slug}: ERROR - ${err.message}`);
    results[slug] = { error: err.message };
  }

  // Save progress every 5 properties
  if ((fetched + skipped) % 5 === 0) {
    writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  }
}

writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
console.log(`\nDone! Fetched: ${fetched}, Skipped: ${skipped}, Total: ${Object.keys(results).length}`);
