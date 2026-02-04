import type { ExtractedMetric } from '@/types/database'

/**
 * Parse metric suggestion data from insight content
 * This is a client-safe utility function
 */
export function parseMetricSuggestion(content: string): ExtractedMetric | null {
  try {
    const data = JSON.parse(content)
    return {
      type: 'metric',
      name: data.name || '',
      description: data.description,
      suggested_target: data.suggested_target,
      owner: data.owner,
      frequency: data.frequency,
      context: data.context || '',
    }
  } catch {
    return null
  }
}
