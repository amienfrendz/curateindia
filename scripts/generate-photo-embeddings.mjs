/**
 * Generate text descriptions of gallery photos using vision models,
 * then embed the descriptions with text-embedding-3-small.
 * Rotates through multiple free vision models to avoid rate limits.
 *
 * Output: src/data/semantic/photo-embeddings.json
 *
 * Usage: node scripts/generate-photo-embeddings.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const GITHUB_TOKEN = (() => {
  const envFile = join(process.cwd(), ".env.local");
  if (existsSync(envFile)) {
    const content = readFileSync(envFile, "utf-8");
    const match = content.match(/GITHUB_TOKEN=(.+)/);
    if (match) return match[1].trim();
  }
  return process.env.GITHUB_TOKEN;
})();

const ENDPOINT = "https://models.github.ai/inference";
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMS = 256;

// Vision models to rotate through (all free-tier with GitHub Models)
const VISION_MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
  "meta/Llama-4-Scout-17B-16E-Instruct",
];

const PHOTOS_DIR = join(process.cwd(), "public", "photos");
const SEMANTIC_DIR = join(process.cwd(), "src", "data", "semantic");
const OUTPUT_FILE = join(SEMANTIC_DIR, "photo-embeddings.json");
const PROGRESS_FILE = join(SEMANTIC_DIR, "photo-descriptions-progress.json");

// Get current property slugs
const propsContent = readFileSync(join(process.cwd(), "src", "data", "properties.ts"), "utf-8");
const slugs = [...propsContent.matchAll(/slug:\s*"([^"]+)"/g)].map(m => m[1]);

// Collect all photo paths for current properties
const photoPaths = [];
for (const slug of slugs) {
  const dir = join(PHOTOS_DIR, slug);
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter(f => f.endsWith(".jpg")).sort();
  for (const file of files) {
    photoPaths.push({ slug, file, path: join(dir, file) });
  }
}

console.log(`Found ${photoPaths.length} photos across ${slugs.length} properties`);

// Load progress (resume support)
let descriptions = {};
if (existsSync(PROGRESS_FILE)) {
  descriptions = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
  console.log(`Resuming — ${Object.keys(descriptions).length} photos already described`);
}

let modelIndex = 0;
let consecutive429 = 0;

async function describePhoto(filePath, slug, photoName) {
  const imageData = readFileSync(filePath);
  const base64 = imageData.toString("base64");
  const mimeType = "image/jpeg";

  const prompt = `Describe this photo of a property stay called "${slug}" in 1-2 detailed sentences. Focus on:
- Physical features visible: stairs, pool, balcony, garden, terrace, rooms, beds, bathroom
- Accessibility: ground floor, elevated, steep steps, narrow paths
- Ambience: open-air, enclosed, rustic, modern, luxurious, basic
- Nature: trees, water body, mountains, forest, beach, river
- Safety: fencing, railings, drop-offs, water features near walkways
Be factual about what you SEE. Do not guess or add information not visible in the image.`;

  // Try models in rotation
  for (let attempt = 0; attempt < VISION_MODELS.length; attempt++) {
    const model = VISION_MODELS[(modelIndex + attempt) % VISION_MODELS.length];

    try {
      const res = await fetch(`${ENDPOINT}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GITHUB_TOKEN}`,
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          }],
          max_tokens: 150,
          temperature: 0.2,
        }),
      });

      if (res.status === 429) {
        consecutive429++;
        if (consecutive429 > 3) {
          console.log(`  Rate limited on all models, waiting 60s...`);
          await new Promise(r => setTimeout(r, 60000));
          consecutive429 = 0;
        }
        modelIndex = (modelIndex + attempt + 1) % VISION_MODELS.length;
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const description = data.choices?.[0]?.message?.content || "";
      consecutive429 = 0;
      modelIndex = (modelIndex + attempt) % VISION_MODELS.length;
      return description;
    } catch (err) {
      if (attempt === VISION_MODELS.length - 1) {
        throw err;
      }
    }
  }
  throw new Error("All vision models failed");
}

async function embedTexts(texts) {
  const res = await fetch(`${ENDPOINT}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts, dimensions: EMBED_DIMS }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.data.map(d => d.embedding);
}

// Phase 1: Generate descriptions
console.log("\n--- Phase 1: Generating photo descriptions ---");
let descCount = 0;

for (const { slug, file, path: filePath } of photoPaths) {
  const key = `${slug}/${file}`;
  if (descriptions[key]) continue;

  try {
    const desc = await describePhoto(filePath, slug, file);
    descriptions[key] = desc;
    descCount++;

    if (descCount % 10 === 0) {
      console.log(`  ${descCount} new descriptions (${Object.keys(descriptions).length} total)...`);
      writeFileSync(PROGRESS_FILE, JSON.stringify(descriptions, null, 2));
    }

    await new Promise(r => setTimeout(r, 1500));
  } catch (err) {
    console.error(`  SKIP ${key}: ${err.message}`);
    writeFileSync(PROGRESS_FILE, JSON.stringify(descriptions, null, 2));
    await new Promise(r => setTimeout(r, 3000));
  }
}

writeFileSync(PROGRESS_FILE, JSON.stringify(descriptions, null, 2));
console.log(`Phase 1 done: ${Object.keys(descriptions).length} total descriptions`);

// Phase 2: Embed all descriptions
console.log("\n--- Phase 2: Embedding descriptions ---");

const toEmbed = Object.entries(descriptions).filter(([key]) => {
  const slug = key.split("/")[0];
  return slugs.includes(slug);
});

console.log(`Embedding ${toEmbed.length} photo descriptions...`);

const photoEmbeddings = [];
const BATCH_SIZE = 30;

for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
  const batch = toEmbed.slice(i, i + BATCH_SIZE);
  const texts = batch.map(([, desc]) => desc);

  try {
    const vectors = await embedTexts(texts);
    for (let j = 0; j < batch.length; j++) {
      const [key, desc] = batch[j];
      const [slug, file] = key.split("/");
      photoEmbeddings.push({
        slug,
        photo: file.replace(".jpg", ""),
        text: desc.slice(0, 150),
        vector: vectors[j],
      });
    }
    if ((i + BATCH_SIZE) % 60 === 0) {
      console.log(`  ${Math.min(i + BATCH_SIZE, toEmbed.length)}/${toEmbed.length} embedded...`);
    }
  } catch (err) {
    console.error(`  Embed batch ${i} failed: ${err.message}`);
    await new Promise(r => setTimeout(r, 10000));
    try {
      const vectors = await embedTexts(texts);
      for (let j = 0; j < batch.length; j++) {
        const [key, desc] = batch[j];
        const [slug, file] = key.split("/");
        photoEmbeddings.push({
          slug,
          photo: file.replace(".jpg", ""),
          text: desc.slice(0, 150),
          vector: vectors[j],
        });
      }
    } catch (err2) {
      console.error(`  Retry failed, skipping batch`);
    }
  }

  await new Promise(r => setTimeout(r, 500));
}

writeFileSync(OUTPUT_FILE, JSON.stringify(photoEmbeddings));
console.log(`\nDone! ${photoEmbeddings.length} photo embeddings saved to ${OUTPUT_FILE}`);
console.log(`File size: ${(readFileSync(OUTPUT_FILE).length / 1024 / 1024).toFixed(2)} MB`);
