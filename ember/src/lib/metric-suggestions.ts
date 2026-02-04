import { getExistingMetricNames, createInsight } from './eos'
import type { ExtractedMetric, InsightInsert } from '@/types/database'

/**
 * Check if a metric name is similar to any existing metric names
 * Uses simple string matching for now - could be enhanced with fuzzy matching
 */
function isMetricSimilar(name: string, existingNames: string[]): boolean {
  const normalized = name.toLowerCase().trim()

  for (const existing of existingNames) {
    // Exact match
    if (normalized === existing) return true

    // Check if one contains the other (handles variations like "Sales Calls" vs "Weekly Sales Calls")
    if (normalized.includes(existing) || existing.includes(normalized)) return true

    // Check word overlap (if 2+ significant words match)
    const newWords = normalized.split(/\s+/).filter((w) => w.length > 2)
    const existingWords = existing.split(/\s+/).filter((w) => w.length > 2)
    const commonWords = newWords.filter((w) => existingWords.includes(w))
    if (commonWords.length >= 2) return true
  }

  return false
}

/**
 * Generate insight suggestions for new metrics extracted from a transcript
 * Returns array of created insight IDs
 */
export async function generateMetricSuggestions(
  metrics: ExtractedMetric[],
  transcriptId: string,
  transcriptTitle: string
): Promise<string[]> {
  if (!metrics || metrics.length === 0) {
    return []
  }

  // Get existing metric names for comparison
  const existingNames = await getExistingMetricNames()

  // Filter to only new metrics (not similar to existing)
  const newMetrics = metrics.filter((m) => !isMetricSimilar(m.name, existingNames))

  if (newMetrics.length === 0) {
    return []
  }

  const createdInsightIds: string[] = []

  for (const metric of newMetrics) {
    // Create insight with metric data stored in content as JSON
    const metricData = JSON.stringify({
      name: metric.name,
      description: metric.description,
      suggested_target: metric.suggested_target,
      owner: metric.owner,
      frequency: metric.frequency,
      context: metric.context,
    })

    const insight: InsightInsert = {
      type: 'suggestion',
      title: `Suggested Metric: ${metric.name}`,
      content: metricData,
      priority: 2, // Medium priority
      sources: [
        {
          type: 'transcript',
          id: transcriptId,
          title: transcriptTitle,
        },
      ],
      related_entities: {},
    }

    const created = await createInsight(insight)
    if (created) {
      createdInsightIds.push(created.id)
      console.log(`Created metric suggestion insight: ${metric.name}`)
    }
  }

  return createdInsightIds
}

/**
 * Parse metric suggestion data from insight content
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
