/**
 * Embed a text query using the same model as our text embeddings.
 * Uses OpenAI-compatible text-embedding-3-small via GitHub Models (free tier).
 */

import { getClient } from "./githubModels";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 256; // Match our stored embeddings

/**
 * Get text embedding for a query string.
 * Returns a 256-dim vector matching stored embeddings.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const client = getClient();

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIM,
  });

  return response.data[0].embedding;
}
