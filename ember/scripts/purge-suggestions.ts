/**
 * Purge existing low-quality todo/issue suggestions and reset transcripts
 * for re-extraction with the improved prompt.
 *
 * Usage:
 *   cd ember && npx tsx scripts/purge-suggestions.ts
 *
 * What it does:
 * 1. Deletes all unacknowledged todo and issue suggestions from insights table
 * 2. Resets `processed` and `extractions` on all transcripts so they can be re-extracted
 *
 * After running this, use the seed/transcripts/process endpoint or process-transcripts.ts
 * to re-process transcripts with the new Ember-persona extraction prompt.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log(`=== Purge Low-Quality Suggestions ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`)

  // Count what we're about to delete
  const { count: todoCount } = await supabase
    .from('insights')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'suggestion')
    .like('title', 'Suggested Todo:%')
    .eq('acknowledged', false)

  const { count: issueCount } = await supabase
    .from('insights')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'suggestion')
    .like('title', 'Suggested Issue:%')
    .eq('acknowledged', false)

  const { count: transcriptCount } = await supabase
    .from('transcripts')
    .select('*', { count: 'exact', head: true })
    .eq('processed', true)

  console.log(`Unacknowledged todo suggestions: ${todoCount}`)
  console.log(`Unacknowledged issue suggestions: ${issueCount}`)
  console.log(`Processed transcripts to reset: ${transcriptCount}`)

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes made. Remove --dry-run to execute.')
    return
  }

  // Step 1: Delete todo suggestions
  const { error: todoErr } = await supabase
    .from('insights')
    .delete()
    .eq('type', 'suggestion')
    .like('title', 'Suggested Todo:%')
    .eq('acknowledged', false)

  if (todoErr) console.error('Error deleting todo suggestions:', todoErr)
  else console.log(`\nDeleted ${todoCount} todo suggestions`)

  // Step 2: Delete issue suggestions
  const { error: issueErr } = await supabase
    .from('insights')
    .delete()
    .eq('type', 'suggestion')
    .like('title', 'Suggested Issue:%')
    .eq('acknowledged', false)

  if (issueErr) console.error('Error deleting issue suggestions:', issueErr)
  else console.log(`Deleted ${issueCount} issue suggestions`)

  // Step 3: Reset transcripts for re-extraction
  // Keep chunks and embeddings (expensive to regenerate), only clear extractions
  const { error: resetErr } = await supabase
    .from('transcripts')
    .update({ processed: false, extractions: null })
    .eq('processed', true)

  if (resetErr) console.error('Error resetting transcripts:', resetErr)
  else console.log(`Reset ${transcriptCount} transcripts (processed=false, extractions=null)`)

  console.log('\n=== Done ===')
  console.log('Next steps:')
  console.log('  1. Deploy the updated extraction prompt')
  console.log('  2. Re-process transcripts: npx tsx scripts/process-transcripts.ts')
  console.log('  3. Run backfill: npx tsx scripts/backfill-suggestions.ts')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
