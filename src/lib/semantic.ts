import textEmbeddingsData from "@/data/semantic/text-embeddings.json";
import { Property } from "@/types";

type TextEmbedding = {
  slug: string;
  type: string;
  text: string;
  vector: number[];
};

const embeddings = textEmbeddingsData as TextEmbedding[];

// The dataset has multiple embeddings per property (review, blurb, food, etc.).
// Pick one representative vector per slug, preferring the property-level "blurb".
const TYPE_PRIORITY: Record<string, number> = {
  blurb: 5,
  editorialSummary: 4,
  experience: 3,
  food: 2,
  review: 1,
};

const embeddingMap = new Map<string, number[]>();
const chosenPriority = new Map<string, number>();
for (const e of embeddings) {
  const priority = TYPE_PRIORITY[e.type] ?? 0;
  if (!embeddingMap.has(e.slug) || priority > (chosenPriority.get(e.slug) ?? -1)) {
    embeddingMap.set(e.slug, e.vector);
    chosenPriority.set(e.slug, priority);
  }
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return magA && magB ? dotProduct / (magA * magB) : 0;
}

/**
 * Find semantically similar properties using embeddings + cluster bonus
 */
export function findSemanticRelated(property: Property, allProperties: Property[], limit: number = 4) {
  const currentEmbedding = embeddingMap.get(property.slug);

  if (!currentEmbedding) {
    // Fallback to cluster-based if no embedding
    return allProperties
      .filter((p) =>
        p.id !== property.id &&
        p.clusters.some((c) => property.clusters.includes(c))
      )
      .slice(0, limit);
  }

  const scored = allProperties
    .filter((p) => p.id !== property.id)
    .map((p) => {
      const candidateEmbedding = embeddingMap.get(p.slug);
      if (!candidateEmbedding) return { property: p, score: 0 };

      // Semantic similarity (0-1)
      const semanticScore = cosineSimilarity(currentEmbedding, candidateEmbedding);

      // Cluster bonus: +0.2 if shares a cluster
      const clusterBonus = p.clusters.some((c) => property.clusters.includes(c)) ? 0.2 : 0;

      return {
        property: p,
        score: Math.min(1, semanticScore + clusterBonus),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((item) => item.property);
}
