/**
 * Generate CLIP embeddings for all property gallery photos.
 * Uses @xenova/transformers (ONNX CLIP ViT-B/32) — runs locally, $0 cost.
 * Output: src/data/semantic/photo-embeddings.json
 *
 * Usage: node scripts/generate-photo-embeddings.mjs
 */

import { pipeline } from "@xenova/transformers";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const PHOTOS_DIR = join(process.cwd(), "public", "photos");
const OUTPUT_FILE = join(process.cwd(), "src", "data", "semantic", "photo-embeddings.json");

// Get current property slugs from properties.ts
const propsContent = readFileSync(join(process.cwd(), "src", "data", "properties.ts"), "utf-8");
const slugs = [...propsContent.matchAll(/slug:\s*"([^"]+)"/g)].map(m => m[1]);

console.log(`Found ${slugs.length} properties. Checking gallery photos...`);

// Collect all photo paths
const photoPaths = [];
for (const slug of slugs) {
  const dir = join(PHOTOS_DIR, slug);
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter(f => f.endsWith(".jpg")).sort();
  for (const file of files) {
    photoPaths.push({ slug, file, path: join(dir, file) });
  }
}

console.log(`Total photos to embed: ${photoPaths.length}`);

// Load CLIP image feature extractor
console.log("Loading CLIP model (first run downloads ~350MB)...");
const extractor = await pipeline("image-feature-extraction", "Xenova/clip-vit-base-patch32", {
  quantized: true,
});

console.log("Model loaded. Generating embeddings...");

const embeddings = [];
let count = 0;

for (const { slug, file, path: filePath } of photoPaths) {
  try {
    const output = await extractor(filePath);
    // output.data is a Float32Array of 512 dims
    const vector = Array.from(output.data).slice(0, 512);
    embeddings.push({
      slug,
      photo: file.replace(".jpg", ""),
      vector,
    });
    count++;
    if (count % 20 === 0) {
      console.log(`  ${count}/${photoPaths.length} embedded...`);
    }
  } catch (err) {
    console.error(`  SKIP ${slug}/${file}: ${err.message}`);
  }
}

writeFileSync(OUTPUT_FILE, JSON.stringify(embeddings));
console.log(`\nDone! ${embeddings.length} photo embeddings saved to ${OUTPUT_FILE}`);
console.log(`File size: ${(readFileSync(OUTPUT_FILE).length / 1024 / 1024).toFixed(1)} MB`);
