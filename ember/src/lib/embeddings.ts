/**
 * Embedding Service for Ember RAG System
 * Uses OpenAI text-embedding-3-small for generating vector embeddings
 */

import OpenAI from 'openai'

// =============================================
// Configuration
// =============================================

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536 // Matches existing pgvector schema
const MAX_BATCH_SIZE = 100 // OpenAI recommends batches of 100 or fewer
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

// Lazy initialization to avoid issues at import time
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

// =============================================
// Types
// =============================================

export interface EmbeddingResult {
  embedding: number[]
  tokenCount: number
}

export interface BatchEmbeddingResult {
  embeddings: number[][]
  totalTokens: number
}

// =============================================
// Core Functions
// =============================================

/**
 * Generate an embedding for a single text string
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await generateEmbeddingWithMetadata(text)
  return result.embedding
}

/**
 * Generate an embedding with token count metadata
 */
export async function generateEmbeddingWithMetadata(
  text: string
): Promise<EmbeddingResult> {
  const client = getOpenAIClient()

  // Truncate if necessary (text-embedding-3-small has 8191 token limit)
  const truncatedText = truncateText(text, 8000)

  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncatedText,
        dimensions: EMBEDDING_DIMENSIONS,
      })

      return {
        embedding: response.data[0].embedding,
        tokenCount: response.usage.total_tokens,
      }
    } catch (error) {
      lastError = error as Error

      // Check if it's a rate limit error
      if (isRateLimitError(error)) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
        console.warn(
          `Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
        )
        await sleep(delay)
        continue
      }

      // For other errors, throw immediately
      throw error
    }
  }

  throw lastError || new Error('Failed to generate embedding after retries')
}

/**
 * Generate embeddings for multiple texts in a batch
 * More efficient than calling generateEmbedding multiple times
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const result = await generateEmbeddingsWithMetadata(texts)
  return result.embeddings
}

/**
 * Generate embeddings for multiple texts with metadata
 */
export async function generateEmbeddingsWithMetadata(
  texts: string[]
): Promise<BatchEmbeddingResult> {
  if (texts.length === 0) {
    return { embeddings: [], totalTokens: 0 }
  }

  const client = getOpenAIClient()

  // Truncate each text
  const truncatedTexts = texts.map((t) => truncateText(t, 8000))

  // Process in batches if necessary
  const allEmbeddings: number[][] = []
  let totalTokens = 0

  for (let i = 0; i < truncatedTexts.length; i += MAX_BATCH_SIZE) {
    const batch = truncatedTexts.slice(i, i + MAX_BATCH_SIZE)

    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await client.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch,
          dimensions: EMBEDDING_DIMENSIONS,
        })

        // OpenAI returns embeddings in the same order as input
        const batchEmbeddings = response.data
          .sort((a, b) => a.index - b.index)
          .map((d) => d.embedding)

        allEmbeddings.push(...batchEmbeddings)
        totalTokens += response.usage.total_tokens
        lastError = null
        break
      } catch (error) {
        lastError = error as Error

        if (isRateLimitError(error)) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
          console.warn(
            `Rate limited on batch ${Math.floor(i / MAX_BATCH_SIZE)}, retrying in ${delay}ms`
          )
          await sleep(delay)
          continue
        }

        throw error
      }
    }

    if (lastError) {
      throw lastError
    }
  }

  return { embeddings: allEmbeddings, totalTokens }
}

// =============================================
// Utility Functions
// =============================================

/**
 * Truncate text to approximately the specified number of tokens
 * Uses a rough estimate of 4 characters per token
 */
function truncateText(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4
  if (text.length <= maxChars) {
    return text
  }
  return text.slice(0, maxChars)
}

/**
 * Check if an error is a rate limit error
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    return error.status === 429
  }
  return false
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// =============================================
// Exports for Testing
// =============================================

export const __testing = {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  MAX_BATCH_SIZE,
  truncateText,
  isRateLimitError,
}
