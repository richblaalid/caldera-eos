import { createInsight, createInsightAdmin } from './eos'
import type { InsightInsert } from '@/types/database'
import type { ExtractedItem } from './transcripts'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * Check if an issue title is similar to any existing titles.
 */
function isSimilar(title: string, existingTitles: string[]): boolean {
  const normalized = title.toLowerCase().trim()

  for (const existing of existingTitles) {
    if (normalized === existing) return true
    if (normalized.includes(existing) || existing.includes(normalized)) return true

    const newWords = normalized.split(/\s+/).filter(w => w.length > 2)
    const existingWords = existing.split(/\s+/).filter(w => w.length > 2)
    const commonWords = newWords.filter(w => existingWords.includes(w))
    if (commonWords.length >= 2) return true
  }

  return false
}

/**
 * Get existing open issue titles for dedup comparison.
 */
async function getExistingIssueTitles(organizationId?: string): Promise<string[]> {
  if (organizationId) {
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase
      .from('issues')
      .select('title')
      .eq('organization_id', organizationId)
      .not('status', 'in', '("solved","dropped")')
    return (data || []).map(i => i.title.toLowerCase())
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('issues')
    .select('title')
    .not('status', 'in', '("solved","dropped")')
  return (data || []).map(i => i.title.toLowerCase())
}

/**
 * Get existing pending issue suggestion titles to avoid duplicates.
 */
async function getPendingSuggestionTitles(organizationId?: string): Promise<string[]> {
  if (organizationId) {
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase
      .from('insights')
      .select('title')
      .eq('type', 'suggestion')
      .like('title', 'Suggested Issue:%')
      .eq('acknowledged', false)
    return (data || []).map(i => i.title.replace('Suggested Issue: ', '').toLowerCase())
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('insights')
    .select('title')
    .eq('type', 'suggestion')
    .like('title', 'Suggested Issue:%')
    .eq('acknowledged', false)
  return (data || []).map(i => i.title.replace('Suggested Issue: ', '').toLowerCase())
}

/**
 * Generate insight suggestions for new issues extracted from a transcript.
 * Returns array of created insight IDs.
 *
 * @param organizationId - When provided, uses admin client (for seed/cron routes)
 */
export async function generateIssueSuggestions(
  issues: ExtractedItem[],
  transcriptId: string,
  transcriptTitle: string,
  organizationId?: string
): Promise<string[]> {
  if (!issues || issues.length === 0) return []

  const [existingTitles, pendingTitles] = await Promise.all([
    getExistingIssueTitles(organizationId),
    getPendingSuggestionTitles(organizationId),
  ])

  const allExisting = [...existingTitles, ...pendingTitles]
  const newIssues = issues.filter(i => !isSimilar(i.title, allExisting))

  if (newIssues.length === 0) return []

  const createdIds: string[] = []

  for (const issue of newIssues) {
    const issueData = JSON.stringify({
      title: issue.title,
      description: issue.description,
      owner: issue.owner,
      priority: issue.priority,
      confidence: issue.confidence,
      context: issue.context,
    })

    // Map confidence to insight priority for DB-level sorting
    const mappedPriority = (issue.confidence ?? 0) >= 0.9 ? 1
      : (issue.confidence ?? 0) >= 0.7 ? 2 : 3

    const insight: InsightInsert = {
      type: 'suggestion',
      title: `Suggested Issue: ${issue.title}`,
      content: issueData,
      priority: issue.priority || mappedPriority,
      sources: [{ type: 'transcript', id: transcriptId, title: transcriptTitle }],
      related_entities: {},
    }

    const created = organizationId
      ? await createInsightAdmin(insight, organizationId)
      : await createInsight(insight)

    if (created) {
      createdIds.push(created.id)
      console.log(`Created issue suggestion: ${issue.title}`)
    }
  }

  return createdIds
}
