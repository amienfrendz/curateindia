/**
 * Semantic search engine — cosine similarity over pre-computed embeddings.
 * Runs in-memory, no vector DB needed at this scale (~400 photos, ~2000 text chunks).
 *
 * Feature flag: ENABLE_SEMANTIC_SEARCH=true in .env.local
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

// ── Types ────────────────────────────────────────────────────────────────────

type PhotoEmbedding = { slug: string; photo: string; vector: number[] };
type TextEmbedding = { slug: string; type: string; text: string; vector: number[] };

type SemanticHit = {
  slug: string;
  score: number;
  evidence: { type: "photo" | "review" | "generativeSummary" | "editorialSummary" | "blurb" | "food"; text?: string; photo?: string; score: number }[];
};

// ── Singleton data loading ───────────────────────────────────────────────────

let photoEmbeddings: PhotoEmbedding[] | null = null;
let textEmbeddings: TextEmbedding[] | null = null;
let isLoaded = false;

const SEMANTIC_DIR = join(process.cwd(), "src", "data", "semantic");

function loadEmbeddings() {
  if (isLoaded) return;

  const photoFile = join(SEMANTIC_DIR, "photo-embeddings.json");
  const textFile = join(SEMANTIC_DIR, "text-embeddings.json");

  if (existsSync(photoFile)) {
    photoEmbeddings = JSON.parse(readFileSync(photoFile, "utf-8"));
    console.log(`[semantic] Loaded ${photoEmbeddings!.length} photo embeddings`);
  }

  if (existsSync(textFile)) {
    textEmbeddings = JSON.parse(readFileSync(textFile, "utf-8"));
    console.log(`[semantic] Loaded ${textEmbeddings!.length} text embeddings`);
  }

  isLoaded = true;
}

// ── Cosine similarity ────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Text search (query → text embeddings) ────────────────────────────────────

export function searchText(queryVector: number[], topK = 30): { slug: string; type: string; text: string; score: number }[] {
  loadEmbeddings();
  if (!textEmbeddings || textEmbeddings.length === 0) return [];

  const scored = textEmbeddings.map(e => ({
    slug: e.slug,
    type: e.type,
    text: e.text,
    score: cosineSimilarity(queryVector, e.vector),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// ── Photo search (query → photo embeddings) ──────────────────────────────────

export function searchPhotos(queryVector: number[], topK = 20): { slug: string; photo: string; score: number }[] {
  loadEmbeddings();
  if (!photoEmbeddings || photoEmbeddings.length === 0) return [];

  const scored = photoEmbeddings.map(e => ({
    slug: e.slug,
    photo: e.photo,
    score: cosineSimilarity(queryVector, e.vector),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// ── Combined search: aggregate by property ───────────────────────────────────

export function semanticSearch(
  textQueryVector: number[],
  photoQueryVector?: number[],
  opts: { topTextK?: number; topPhotoK?: number; topProperties?: number } = {}
): SemanticHit[] {
  const { topTextK = 30, topPhotoK = 20, topProperties = 15 } = opts;

  const textHits = searchText(textQueryVector, topTextK);
  const photoHits = photoQueryVector ? searchPhotos(photoQueryVector, topPhotoK) : [];

  // Aggregate scores by property
  const propertyScores = new Map<string, { totalScore: number; evidence: SemanticHit["evidence"] }>();

  for (const hit of textHits) {
    const existing = propertyScores.get(hit.slug) || { totalScore: 0, evidence: [] };
    existing.totalScore += hit.score;
    existing.evidence.push({
      type: hit.type as SemanticHit["evidence"][0]["type"],
      text: hit.text,
      score: hit.score,
    });
    propertyScores.set(hit.slug, existing);
  }

  for (const hit of photoHits) {
    const existing = propertyScores.get(hit.slug) || { totalScore: 0, evidence: [] };
    existing.totalScore += hit.score * 0.8; // Photos weighted slightly less than text
    existing.evidence.push({
      type: "photo",
      photo: `${hit.slug}/${hit.photo}.jpg`,
      score: hit.score,
    });
    propertyScores.set(hit.slug, existing);
  }

  // Sort by total score and return top properties
  const entries = Array.from(propertyScores.entries());
  const results: SemanticHit[] = entries
    .map(([slug, data]) => ({
      slug,
      score: data.totalScore,
      evidence: data.evidence.sort((a: { score: number }, b: { score: number }) => b.score - a.score).slice(0, 5),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topProperties);

  return results;
}

// ── Feature flag check ───────────────────────────────────────────────────────

export function isSemanticSearchEnabled(): boolean {
  return process.env.ENABLE_SEMANTIC_SEARCH === "true";
}

// ── Check if embeddings exist ────────────────────────────────────────────────

export function hasEmbeddings(): boolean {
  const photoFile = join(SEMANTIC_DIR, "photo-embeddings.json");
  const textFile = join(SEMANTIC_DIR, "text-embeddings.json");
  return existsSync(textFile) || existsSync(photoFile);
}
