import { createClient } from '@supabase/supabase-js'
import type { AgentOutputInsert } from '@/types/agents'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Store an agent output in the database.
 */
export async function saveAgentOutput(output: AgentOutputInsert): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('agent_outputs')
    .insert(output)
    .select('id')
    .single()

  if (error) {
    console.error('Failed to save agent output:', error)
    return null
  }

  return data.id
}
