// Generate approximate nightly pricing for all properties via GitHub Models LLM.
// Run: node scripts/generate-pricing.mjs
// Writes: src/data/property-pricing.json

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const ENDPOINT = "https://models.github.ai/inference";
const MODEL = "openai/gpt-4o-mini";
const TOKEN = process.env.GITHUB_TOKEN || (await fs.readFile(path.join(ROOT, ".env.local"), "utf8")).match(/GITHUB_TOKEN=(.+)/)?.[1]?.trim();

if (!TOKEN) { console.error("No GITHUB_TOKEN"); process.exit(1); }

async function chatJSON(system, user) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 429) {
        console.log("  rate limited, waiting 10s...");
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || "{}";
      return JSON.parse(raw);
    } catch (e) {
      if (attempt < 2) { await new Promise(r => setTimeout(r, 3000)); continue; }
      throw e;
    }
  }
}

// Parse properties
const propsTs = await fs.readFile(path.join(ROOT, "src/data/properties.ts"), "utf8");
const re = /slug:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?type:\s*"([^"]+)"[\s\S]*?location:\s*"([^"]+)"[\s\S]*?state:\s*"([^"]+)"[\s\S]*?rooms?:\s*(\d+|undefined)[\s\S]*?priceTier:\s*"([^"]+)"/g;
const properties = [];
let m;
while ((m = re.exec(propsTs))) {
  properties.push({
    slug: m[1], name: m[2], type: m[3],
    location: m[4], state: m[5],
    rooms: m[6] === "undefined" ? null : parseInt(m[6]),
    tier: m[7],
  });
}
console.log(`Parsed ${properties.length} properties`);

// Process in batches of 10
const outPath = path.join(ROOT, "src/data/property-pricing.json");
let existing = {};
try { existing = JSON.parse(await fs.readFile(outPath, "utf8")); } catch {}

const BATCH_SIZE = 10;
for (let i = 0; i < properties.length; i += BATCH_SIZE) {
  const batch = properties.slice(i, i + BATCH_SIZE);
  const uncached = batch.filter(p => !existing[p.slug]);
  if (uncached.length === 0) {
    console.log(`  batch ${i / BATCH_SIZE + 1}: all cached`);
    continue;
  }

  const system = `You are a travel pricing expert for India. Given property details, estimate the approximate nightly room rate range in INR (Indian Rupees) for a standard double room.

Return JSON: { "properties": [{ "slug": "...", "lowINR": number, "highINR": number, "basis": "per room/per person/per couple", "includes": "brief note on what's typically included (meals, activities, etc.)", "season": "peak season rate", "source": "estimated from similar properties in region" }] }

Use realistic 2024-2025 Indian pricing. The tier guide:
- ₹ = budget (₹500–₹2,500/night)
- ₹₹ = mid-range (₹2,500–₹8,000/night)  
- ₹₹₹ = premium (₹8,000–₹20,000/night)
- ₹₹₹₹ = luxury (₹20,000–₹60,000+/night)

Be specific to property type and location. Plantation bungalows in Coorg differ from heritage havelis in Rajasthan.`;

  const user = `Estimate nightly rates for these properties:\n${JSON.stringify(uncached, null, 2)}`;

  try {
    const result = await chatJSON(system, user);
    if (result.properties) {
      for (const p of result.properties) {
        existing[p.slug] = {
          lowINR: p.lowINR,
          highINR: p.highINR,
          basis: p.basis || "per room",
          includes: p.includes || "",
          season: p.season || "peak season",
          source: "estimated",
        };
      }
    }
    await fs.writeFile(outPath, JSON.stringify(existing, null, 2));
    console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: ${uncached.length} priced`);
  } catch (e) {
    console.error(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: FAILED`, e.message);
  }
  await new Promise(r => setTimeout(r, 2000));
}

console.log(`\nDone. ${Object.keys(existing).length}/${properties.length} properties priced.`);
