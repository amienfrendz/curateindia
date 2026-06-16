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
const MODEL = "Llama-3.3-70B-Instruct";

const envFile = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
const TOKEN = envFile.match(/GITHUB_TOKEN=(.+)/)?.[1]?.trim();
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
          max_tokens: 2000,
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
      const m = raw.match(/\{[\s\S]*\}/);
      return JSON.parse(m ? m[0] : raw);
    } catch (e) {
      if (attempt < 2) { await new Promise(r => setTimeout(r, 3000)); continue; }
      throw e;
    }
  }
}

// Parse properties
const propsTs = await fs.readFile(path.join(ROOT, "src/data/properties.ts"), "utf8");
const re = /slug:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?type:\s*"([^"]+)"[\s\S]*?location:\s*"([^"]+)"[\s\S]*?state:\s*"([^"]+)"[\s\S]*?priceTier:\s*"([^"]+)"/g;
const properties = [];
let m;
while ((m = re.exec(propsTs))) {
  properties.push({
    slug: m[1], name: m[2], type: m[3],
    location: m[4], state: m[5], tier: m[6],
  });
}
console.log(`Parsed ${properties.length} properties`);

const outPath = path.join(ROOT, "src/data/property-pricing.json");
let existing = {};
try { existing = JSON.parse(await fs.readFile(outPath, "utf8")); } catch {}

const SYSTEM = `You estimate nightly room rates for Indian boutique stays. Return JSON:
{"prices":[{"slug":"...","lowINR":number,"highINR":number,"basis":"per room or per person","includes":"brief: meals, activities etc"}]}
Use realistic 2024-25 India pricing. Tier guide: ₹=500-2500, ₹₹=2500-8000, ₹₹₹=8000-20000, ₹₹₹₹=20000-60000+. Be specific to location and type.`;

const BATCH_SIZE = 10;
for (let i = 0; i < properties.length; i += BATCH_SIZE) {
  const batch = properties.slice(i, i + BATCH_SIZE).filter(p => !existing[p.slug]);
  if (!batch.length) { console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: all cached`); continue; }

  const user = `Estimate nightly rates for these properties:\n${JSON.stringify(batch, null, 2)}`;

  try {
    const r = await chatJSON(SYSTEM, user);
    if (r.prices) {
      for (const p of r.prices) {
        existing[p.slug] = {
          lowINR: p.lowINR,
          highINR: p.highINR,
          basis: p.basis || "per room",
          includes: p.includes || "",
        };
      }
    }
    await fs.writeFile(outPath, JSON.stringify(existing, null, 2));
    console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} priced`);
  } catch (e) {
    console.error(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: FAILED`, e.message);
  }
  await new Promise(r => setTimeout(r, 3000));
}

console.log(`\nDone. ${Object.keys(existing).length}/${properties.length} properties priced.`);
