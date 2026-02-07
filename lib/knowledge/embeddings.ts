// lib/knowledge/embeddings.ts - OpenAI embeddings for vector search
import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_BATCH_SIZE = 100; // OpenAI limit

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: openai.embedding(EMBEDDING_MODEL),
      values: batch,
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

/**
 * Generate embedding for a user query (optimized for search)
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  // For queries, we might want to add a prefix to improve retrieval
  // OpenAI's text-embedding-3-small handles this well without prefix
  return generateEmbedding(query);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vectors must have same length');

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
