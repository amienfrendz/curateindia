/**
 * Incrementally update text embeddings when properties are added, updated, or removed.
 * Compares current property slugs against stored embeddings and syncs.
 *
 * Usage: node scripts/sync-embeddings.mjs [slug1] [slug2] ...
 *   - No args: full sync (add new, remove stale)
 *   - With args: regenerate embeddings for specific slugs only
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
const EMBEDDINGS_FILE = join(SEMANTIC_DIR, "text-embeddings.json");

async function embed(texts) {
  const res = await fetch(`${ENDPOINT}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
    },
    body: JSON.stringify({ model: MODEL, input: texts, dimensions: DIMS }),
  });
  if (!res.ok) throw new Error(`Embedding API: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.data.map(d => d.embedding);
}

function getChunksForSlug(slug, propsContent, reviews, summaries) {
  const chunks = [];

  // Reviews
  const propReviews = reviews[slug]?.reviews || [];
  for (const review of propReviews) {
    if (!review.text || review.text.length < 20) continue;
    const sentences = review.text.split(/(?<=[.!?])\s+/).filter(s => s.length > 25 && s.length < 500);
    for (const s of sentences) chunks.push({ slug, type: "review", text: s.slice(0, 300) });
  }

  // Google summaries
  const summary = summaries[slug];
  if (summary?.generativeSummary) chunks.push({ slug, type: "generativeSummary", text: summary.generativeSummary.slice(0, 500) });
  if (summary?.editorialSummary) chunks.push({ slug, type: "editorialSummary", text: summary.editorialSummary.slice(0, 300) });
  if (summary?.reviews) {
    for (const r of summary.reviews) {
      if (r.text && r.text.length > 25) {
        const sentences = r.text.split(/(?<=[.!?])\s+/).filter(s => s.length > 25 && s.length < 500);
        for (const s of sentences) chunks.push({ slug, type: "review", text: s.slice(0, 300) });
      }
    }
  }

  // Blurb, food, experiences from properties.ts
  const blurbMatch = propsContent.match(new RegExp(`id: "${slug}"[\\s\\S]*?blurb:\\s*"([^"]+)"`));
  if (blurbMatch) chunks.push({ slug, type: "blurb", text: blurbMatch[1] });

  const foodMatch = propsContent.match(new RegExp(`id: "${slug}"[\\s\\S]*?food:\\s*"([^"]+)"`));
  if (foodMatch) chunks.push({ slug, type: "food", text: foodMatch[1] });

  const expBlock = propsContent.match(new RegExp(`id: "${slug}"[\\s\\S]*?signatureExperiences:\\s*\\[([^\\]]+)\\]`));
  if (expBlock) {
    const exps = [...expBlock[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
    if (exps.length > 0) chunks.push({ slug, type: "experience", text: exps.join(". ") });
  }

  return chunks;
}

// ── Main ──

const args = process.argv.slice(2);
const propsContent = readFileSync(join(DATA_DIR, "properties.ts"), "utf-8");
const currentSlugs = new Set([...propsContent.matchAll(/slug:\s*"([^"]+)"/g)].map(m => m[1]));
const reviews = JSON.parse(readFileSync(join(DATA_DIR, "property-reviews.json"), "utf-8"));
const summariesFile = join(SEMANTIC_DIR, "generative-summaries.json");
const summaries = existsSync(summariesFile) ? JSON.parse(readFileSync(summariesFile, "utf-8")) : {};

// Load existing embeddings
let embeddings = [];
if (existsSync(EMBEDDINGS_FILE)) {
  embeddings = JSON.parse(readFileSync(EMBEDDINGS_FILE, "utf-8"));
}

const existingSlugs = new Set(embeddings.map(e => e.slug));

if (args.length > 0) {
  // Targeted update: regenerate for specific slugs
  const slugsToUpdate = args.filter(s => currentSlugs.has(s));
  console.log(`Updating embeddings for: ${slugsToUpdate.join(", ")}`);

  // Remove old embeddings for these slugs
  embeddings = embeddings.filter(e => !slugsToUpdate.includes(e.slug));

  // Generate new embeddings
  for (const slug of slugsToUpdate) {
    const chunks = getChunksForSlug(slug, propsContent, reviews, summaries);
    if (chunks.length === 0) { console.log(`  ${slug}: no text data`); continue; }

    const texts = chunks.map(c => c.text);
    const vectors = await embed(texts);
    for (let j = 0; j < chunks.length; j++) {
      embeddings.push({ slug: chunks[j].slug, type: chunks[j].type, text: chunks[j].text.slice(0, 150), vector: vectors[j] });
    }
    console.log(`  ${slug}: ${chunks.length} chunks embedded`);
    await new Promise(r => setTimeout(r, 500));
  }
} else {
  // Full sync: add new slugs, remove stale ones
  const staleSlugs = [...existingSlugs].filter(s => !currentSlugs.has(s));
  const newSlugs = [...currentSlugs].filter(s => !existingSlugs.has(s));

  if (staleSlugs.length > 0) {
    console.log(`Removing ${staleSlugs.length} stale slugs: ${staleSlugs.join(", ")}`);
    embeddings = embeddings.filter(e => !staleSlugs.includes(e.slug));
  }

  if (newSlugs.length > 0) {
    console.log(`Adding ${newSlugs.length} new slugs: ${newSlugs.join(", ")}`);
    for (const slug of newSlugs) {
      const chunks = getChunksForSlug(slug, propsContent, reviews, summaries);
      if (chunks.length === 0) { console.log(`  ${slug}: no text data`); continue; }

      const texts = chunks.map(c => c.text);
      const vectors = await embed(texts);
      for (let j = 0; j < chunks.length; j++) {
        embeddings.push({ slug: chunks[j].slug, type: chunks[j].type, text: chunks[j].text.slice(0, 150), vector: vectors[j] });
      }
      console.log(`  ${slug}: ${chunks.length} chunks embedded`);
      await new Promise(r => setTimeout(r, 500));
    }
  }

  if (staleSlugs.length === 0 && newSlugs.length === 0) {
    console.log("All embeddings up to date. Nothing to sync.");
    process.exit(0);
  }
}

writeFileSync(EMBEDDINGS_FILE, JSON.stringify(embeddings));
console.log(`\nDone! ${embeddings.length} total embeddings saved.`);
