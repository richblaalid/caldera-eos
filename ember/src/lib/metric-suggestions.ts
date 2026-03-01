import { getExistingMetricNames, createInsight } from './eos'
import { isSimilarTitle } from './suggestion-utils'
import type { ExtractedMetric, InsightInsert } from '@/types/database'

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
  const newMetrics = metrics.filter((m) => !isSimilarTitle(m.name, existingNames))

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
