/**
 * Generate text embeddings for reviews + generative summaries.
 * Uses GitHub Models text-embedding-3-small API (free tier).
 * Output: src/data/semantic/text-embeddings.json
 *
 * Usage: node scripts/generate-text-embeddings.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
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
const MODEL = "text-embedding-3-small";
const DIMS = 256;

const DATA_DIR = join(process.cwd(), "src", "data");
const SEMANTIC_DIR = join(DATA_DIR, "semantic");
const OUTPUT_FILE = join(SEMANTIC_DIR, "text-embeddings.json");

async function embed(texts) {
  const res = await fetch(`${ENDPOINT}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
    },
    body: JSON.stringify({ model: MODEL, input: texts, dimensions: DIMS }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.data.map(d => d.embedding);
}

// Load data
const reviews = JSON.parse(readFileSync(join(DATA_DIR, "property-reviews.json"), "utf-8"));
const summariesFile = join(SEMANTIC_DIR, "generative-summaries.json");
const summaries = existsSync(summariesFile) ? JSON.parse(readFileSync(summariesFile, "utf-8")) : {};
const propsContent = readFileSync(join(DATA_DIR, "properties.ts"), "utf-8");
const slugs = [...propsContent.matchAll(/slug:\s*"([^"]+)"/g)].map(m => m[1]);

// Collect text chunks
const chunks = [];

for (const slug of slugs) {
  // Reviews from property-reviews.json
  const propReviews = reviews[slug]?.reviews || [];
  for (const review of propReviews) {
    if (!review.text || review.text.length < 20) continue;
    const sentences = review.text
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.length > 25 && s.length < 500);
    for (const sentence of sentences) {
      chunks.push({ slug, type: "review", text: sentence.slice(0, 300) });
    }
  }

  // Generative/editorial summaries from Google
  const summary = summaries[slug];
  if (summary?.generativeSummary) {
    chunks.push({ slug, type: "generativeSummary", text: summary.generativeSummary.slice(0, 500) });
  }
  if (summary?.editorialSummary) {
    chunks.push({ slug, type: "editorialSummary", text: summary.editorialSummary.slice(0, 300) });
  }
  if (summary?.reviews) {
    for (const r of summary.reviews) {
      if (r.text && r.text.length > 25) {
        const sentences = r.text.split(/(?<=[.!?])\s+/).filter(s => s.length > 25 && s.length < 500);
        for (const s of sentences) {
          chunks.push({ slug, type: "review", text: s.slice(0, 300) });
        }
      }
    }
  }

  // Blurb
  const blurbMatch = propsContent.match(new RegExp(`id: "${slug}"[\\s\\S]*?blurb:\\s*"([^"]+)"`));
  if (blurbMatch) chunks.push({ slug, type: "blurb", text: blurbMatch[1] });

  // Food
  const foodMatch = propsContent.match(new RegExp(`id: "${slug}"[\\s\\S]*?food:\\s*"([^"]+)"`));
  if (foodMatch) chunks.push({ slug, type: "food", text: foodMatch[1] });

  // Signature experiences
  const expBlock = propsContent.match(new RegExp(`id: "${slug}"[\\s\\S]*?signatureExperiences:\\s*\\[([^\\]]+)\\]`));
  if (expBlock) {
    const exps = [...expBlock[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
    if (exps.length > 0) {
      chunks.push({ slug, type: "experience", text: exps.join(". ") });
    }
  }
}

console.log(`Total text chunks to embed: ${chunks.length} across ${slugs.length} properties`);

// Batch embed
const BATCH_SIZE = 50;
const embeddings = [];
let processed = 0;

for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
  const batch = chunks.slice(i, i + BATCH_SIZE);
  const texts = batch.map(c => c.text);

  try {
    const vectors = await embed(texts);
    for (let j = 0; j < batch.length; j++) {
      embeddings.push({
        slug: batch[j].slug,
        type: batch[j].type,
        text: batch[j].text.slice(0, 150),
        vector: vectors[j],
      });
    }
    processed += batch.length;
    console.log(`  ${processed}/${chunks.length} embedded...`);
  } catch (err) {
    console.error(`  Batch ${i} failed: ${err.message}`);
    await new Promise(r => setTimeout(r, 5000));
    try {
      const vectors = await embed(texts);
      for (let j = 0; j < batch.length; j++) {
        embeddings.push({
          slug: batch[j].slug,
          type: batch[j].type,
          text: batch[j].text.slice(0, 150),
          vector: vectors[j],
        });
      }
      processed += batch.length;
    } catch (err2) {
      console.error(`  Retry failed: ${err2.message}, skipping batch`);
    }
  }

  await new Promise(r => setTimeout(r, 500));
}

writeFileSync(OUTPUT_FILE, JSON.stringify(embeddings));
console.log(`\nDone! ${embeddings.length} text embeddings saved to ${OUTPUT_FILE}`);
console.log(`File size: ${(readFileSync(OUTPUT_FILE).length / 1024 / 1024).toFixed(2)} MB`);
