import textEmbeddingsData from "@/data/semantic/text-embeddings.json";
import { Property } from "@/types";

type TextEmbedding = {
  slug: string;
  text: string;
  embedding: number[];
  source: string;
};

const embeddings = textEmbeddingsData as TextEmbedding[];
const embeddingMap = new Map(embeddings.map((e) => [e.slug, e.embedding]));

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
