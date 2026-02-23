import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateBriefing, saveBriefing } from '@/lib/agents/ea-briefing'
import { deliverBriefing } from '@/lib/agents/slack-briefing'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/agents/cron/morning-briefing
// Runs weekday mornings to generate and deliver briefings to each partner.
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Get all partners with preferences
    const { data: partners, error: fetchError } = await supabaseAdmin
      .from('partner_preferences')
      .select('partner_id, organization_id, briefing_time, briefing_timezone')

    if (fetchError) {
      console.error('Failed to fetch partner preferences:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
    }

    if (!partners || partners.length === 0) {
      return NextResponse.json({ message: 'No partners with preferences configured', briefings: 0 })
    }

    const results = {
      partners_processed: 0,
      briefings_generated: 0,
      briefings_delivered: 0,
      errors: [] as string[],
    }

    for (const partner of partners) {
      try {
        // Generate briefing
        const briefing = await generateBriefing(partner.partner_id, partner.organization_id)

        // Save to database
        const briefingId = await saveBriefing(briefing)
        if (!briefingId) {
          results.errors.push(`Save failed for ${partner.partner_id}`)
          continue
        }

        results.briefings_generated++

        // Deliver via Slack
        const delivered = await deliverBriefing(
          partner.partner_id,
          partner.organization_id,
          briefingId,
          briefing
        )

        if (delivered) {
          results.briefings_delivered++
        } else {
          results.errors.push(`Slack delivery failed for ${partner.partner_id}`)
        }

        results.partners_processed++
      } catch (partnerError: unknown) {
        const err = partnerError as { message?: string }
        results.errors.push(`Partner ${partner.partner_id}: ${err.message || 'Unknown error'}`)
      }
    }

    // Log run to agent_runs
    await supabaseAdmin.from('agent_runs').insert({
      organization_id: partners[0]?.organization_id,
      agent_id: 'ea',
      trigger_type: 'schedule',
      trigger_context: { cron: 'morning-briefing', results },
      completed_at: new Date().toISOString(),
      duration_ms: 0, // Could track this more precisely
      status: results.errors.length === 0 ? 'completed' : 'completed',
      outputs_created: results.briefings_generated,
      errors: results.errors.map(e => ({ message: e })),
    })

    console.log('Morning briefing complete:', results)

    return NextResponse.json({
      message: 'Morning briefing complete',
      ...results,
    })
  } catch (error) {
    console.error('Morning briefing cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
