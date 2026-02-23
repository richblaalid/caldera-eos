import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/agents/test/seed
 * Seeds realistic EOS data for demo purposes.
 * Requires CRON_SECRET or dev mode.
 *
 * Creates rocks, todos, issues, scorecard metrics + entries
 * that will produce a compelling morning briefing.
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const orgId = request.nextUrl.searchParams.get('org_id') || '00000000-0000-0000-0000-000000000002'

    // Get partner profiles to assign ownership
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        error: 'No profiles found. Users must log in first to create profiles.',
      }, { status: 404 })
    }

    // Map profiles by first name for assignment
    const findProfile = (keyword: string) =>
      profiles.find(p =>
        p.name?.toLowerCase().includes(keyword) ||
        p.email?.toLowerCase().includes(keyword)
      )

    const rich = findProfile('rich')
    const john = findProfile('john')
    const wade = findProfile('wade')

    // Fallback: use first profile if specific ones not found
    const defaultOwner = rich || profiles[0]

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endOfQuarter = '2026-03-31'

    const results: Record<string, unknown> = { profiles_found: profiles.map(p => p.name) }

    // ============================================
    // 1. Rocks (Q1 2026)
    // ============================================
    const rocks = [
      {
        title: 'Launch fixed-fee engagement model for 2 new clients',
        description: 'Transition from T&M billing to value-based fixed-fee pricing. Target 2 new clients on fixed-fee by end of Q1.',
        owner_id: john?.id || defaultOwner.id,
        quarter: 'Q1 2026',
        status: 'at_risk',
        due_date: endOfQuarter,
        organization_id: orgId,
        milestones: JSON.stringify([
          { title: 'Define pricing tiers', completed: true },
          { title: 'Create SOW template', completed: true },
          { title: 'Pitch to 3 prospects', completed: false },
          { title: 'Close 2 deals', completed: false },
        ]),
      },
      {
        title: 'Reduce anchor client revenue concentration to <60%',
        description: 'Diversify revenue to reduce dependency on Meridian Corp. Currently at 73%.',
        owner_id: rich?.id || defaultOwner.id,
        quarter: 'Q1 2026',
        status: 'off_track',
        due_date: endOfQuarter,
        organization_id: orgId,
        milestones: JSON.stringify([
          { title: 'Map pipeline targets', completed: true },
          { title: 'Close 2 new accounts', completed: false },
          { title: 'Achieve 60% threshold', completed: false },
        ]),
      },
      {
        title: 'Hire 2 senior engineers',
        description: 'Expand delivery capacity to support new fixed-fee engagements without burning existing team.',
        owner_id: wade?.id || defaultOwner.id,
        quarter: 'Q1 2026',
        status: 'on_track',
        due_date: endOfQuarter,
        organization_id: orgId,
        milestones: JSON.stringify([
          { title: 'Post job listings', completed: true },
          { title: 'Screen candidates', completed: true },
          { title: 'Final interviews', completed: false },
          { title: 'Extend offers', completed: false },
        ]),
      },
      {
        title: 'Implement AI-accelerated delivery pipeline',
        description: 'Deploy AI tooling (Cursor, Claude) to improve delivery velocity by 30% and support fixed-fee margins.',
        owner_id: wade?.id || defaultOwner.id,
        quarter: 'Q1 2026',
        status: 'on_track',
        due_date: endOfQuarter,
        organization_id: orgId,
        milestones: JSON.stringify([
          { title: 'Evaluate tools', completed: true },
          { title: 'Pilot with 1 project', completed: true },
          { title: 'Roll out to all projects', completed: false },
        ]),
      },
      {
        title: 'Close HubSpot pipeline to $500K new ARR',
        description: 'Fill pipeline and close enough new business to hit $500K ARR target.',
        owner_id: john?.id || defaultOwner.id,
        quarter: 'Q1 2026',
        status: 'at_risk',
        due_date: endOfQuarter,
        organization_id: orgId,
        milestones: JSON.stringify([
          { title: 'Pipeline at $1.2M', completed: true },
          { title: 'Close $250K', completed: true },
          { title: 'Close $500K', completed: false },
        ]),
      },
    ]

    const { data: rocksData, error: rocksError } = await supabaseAdmin
      .from('rocks')
      .upsert(rocks, { onConflict: 'id', ignoreDuplicates: false })
      .select('id, title')

    results.rocks = rocksError
      ? { error: rocksError.message }
      : { count: rocksData?.length, items: rocksData?.map(r => r.title) }

    // ============================================
    // 2. Todos (overdue and upcoming)
    // ============================================
    const todos = [
      {
        title: 'Send revised SOW to Vertex Labs',
        owner_id: john?.id || defaultOwner.id,
        due_date: yesterday,
        completed: false,
        organization_id: orgId,
      },
      {
        title: 'Review Meridian Corp Q1 invoice reconciliation',
        owner_id: rich?.id || defaultOwner.id,
        due_date: threeDaysAgo,
        completed: false,
        organization_id: orgId,
      },
      {
        title: 'Schedule candidate panel interviews for Sr. Engineer role',
        owner_id: wade?.id || defaultOwner.id,
        due_date: todayStr,
        completed: false,
        organization_id: orgId,
      },
      {
        title: 'Prepare L10 agenda — include Meridian risk discussion',
        owner_id: rich?.id || defaultOwner.id,
        due_date: todayStr,
        completed: false,
        organization_id: orgId,
      },
      {
        title: 'Follow up with NovaTech on pilot proposal',
        owner_id: john?.id || defaultOwner.id,
        due_date: nextWeek,
        completed: false,
        organization_id: orgId,
      },
      {
        title: 'Deploy AI code review bot to staging',
        owner_id: wade?.id || defaultOwner.id,
        due_date: nextWeek,
        completed: false,
        organization_id: orgId,
      },
    ]

    const { data: todosData, error: todosError } = await supabaseAdmin
      .from('todos')
      .insert(todos)
      .select('id, title')

    results.todos = todosError
      ? { error: todosError.message }
      : { count: todosData?.length, items: todosData?.map(t => t.title) }

    // ============================================
    // 3. Issues (open for IDS)
    // ============================================
    const issues = [
      {
        title: 'Meridian Corp concentration at 73% — existential risk',
        description: 'Single client represents 73% of revenue. Any churn would be catastrophic. Need accelerated diversification plan.',
        priority: 3,
        status: 'identified',
        owner_id: rich?.id || defaultOwner.id,
        source: 'insight' as const,
        organization_id: orgId,
      },
      {
        title: 'Fixed-fee pricing not competitive vs. competitors',
        description: 'Lost 2 deals in January where our fixed-fee proposals were 30% above competitor bids. Need to revisit pricing model.',
        priority: 2,
        status: 'open',
        owner_id: john?.id || defaultOwner.id,
        source: 'manual' as const,
        organization_id: orgId,
      },
      {
        title: 'Senior engineer candidate pipeline drying up',
        description: 'Only 3 qualified candidates in pipeline. Need to expand sourcing channels or adjust compensation bands.',
        priority: 2,
        status: 'open',
        owner_id: wade?.id || defaultOwner.id,
        source: 'manual' as const,
        organization_id: orgId,
      },
      {
        title: 'Vertex Labs invoice 45+ days overdue ($28,500)',
        description: 'Vertex Labs has not paid their December invoice. AR aging is concerning.',
        priority: 2,
        status: 'open',
        owner_id: rich?.id || defaultOwner.id,
        source: 'insight' as const,
        organization_id: orgId,
      },
    ]

    const { data: issuesData, error: issuesError } = await supabaseAdmin
      .from('issues')
      .insert(issues)
      .select('id, title')

    results.issues = issuesError
      ? { error: issuesError.message }
      : { count: issuesData?.length, items: issuesData?.map(i => i.title) }

    // ============================================
    // 4. Scorecard Metrics
    // ============================================
    const metrics = [
      {
        name: 'Weekly Revenue',
        description: 'Total billed revenue for the week',
        owner_id: rich?.id || defaultOwner.id,
        target: 55000,
        unit: '$',
        frequency: 'weekly',
        goal_direction: 'above',
        is_active: true,
        organization_id: orgId,
      },
      {
        name: 'Pipeline Value',
        description: 'Total qualified pipeline in HubSpot',
        owner_id: john?.id || defaultOwner.id,
        target: 1200000,
        unit: '$',
        frequency: 'weekly',
        goal_direction: 'above',
        is_active: true,
        organization_id: orgId,
      },
      {
        name: 'Client NPS Score',
        description: 'Average net promoter score from client surveys',
        owner_id: wade?.id || defaultOwner.id,
        target: 70,
        unit: 'score',
        frequency: 'monthly',
        goal_direction: 'above',
        is_active: true,
        organization_id: orgId,
      },
      {
        name: 'Utilization Rate',
        description: 'Billable hours / available hours for delivery team',
        owner_id: wade?.id || defaultOwner.id,
        target: 80,
        unit: '%',
        frequency: 'weekly',
        goal_direction: 'above',
        is_active: true,
        organization_id: orgId,
      },
      {
        name: 'Gross Margin',
        description: 'Revenue minus direct costs as percentage',
        owner_id: rich?.id || defaultOwner.id,
        target: 40,
        unit: '%',
        frequency: 'weekly',
        goal_direction: 'above',
        is_active: true,
        organization_id: orgId,
      },
      {
        name: 'New Meetings Booked',
        description: 'Sales discovery/demo meetings booked this week',
        owner_id: john?.id || defaultOwner.id,
        target: 3,
        unit: 'count',
        frequency: 'weekly',
        goal_direction: 'above',
        is_active: true,
        organization_id: orgId,
      },
    ]

    const { data: metricsData, error: metricsError } = await supabaseAdmin
      .from('scorecard_metrics')
      .insert(metrics)
      .select('id, name')

    results.scorecard_metrics = metricsError
      ? { error: metricsError.message }
      : { count: metricsData?.length, items: metricsData?.map(m => m.name) }

    // ============================================
    // 5. Scorecard Entries (last 4 weeks)
    // ============================================
    if (metricsData && metricsData.length > 0) {
      const entries: Array<{
        metric_id: string
        value: number
        week_of: string
        notes?: string
      }> = []

      // Generate 4 weeks of entries for each metric
      const weeklyData: Record<string, number[]> = {
        'Weekly Revenue': [52000, 48000, 56000, 51000],         // Target: 55K — off track recent
        'Pipeline Value': [980000, 1050000, 1100000, 1150000],  // Target: 1.2M — trending up but below
        'Client NPS Score': [72, 72, 72, 72],                   // Target: 70 — on track
        'Utilization Rate': [85, 78, 82, 76],                   // Target: 80 — inconsistent
        'Gross Margin': [38, 35, 42, 33],                       // Target: 40 — volatile, recent dip
        'New Meetings Booked': [4, 2, 3, 1],                    // Target: 3 — recent drop
      }

      for (const metric of metricsData) {
        const values = weeklyData[metric.name]
        if (!values) continue

        for (let weekOffset = 3; weekOffset >= 0; weekOffset--) {
          const weekDate = new Date(today.getTime() - weekOffset * 7 * 24 * 60 * 60 * 1000)
          // Align to Monday
          const day = weekDate.getDay()
          const mondayOffset = day === 0 ? -6 : 1 - day
          weekDate.setDate(weekDate.getDate() + mondayOffset)

          entries.push({
            metric_id: metric.id,
            value: values[3 - weekOffset],
            week_of: weekDate.toISOString().split('T')[0],
          })
        }
      }

      const { error: entriesError } = await supabaseAdmin
        .from('scorecard_entries')
        .upsert(entries, { onConflict: 'metric_id,week_of' })

      results.scorecard_entries = entriesError
        ? { error: entriesError.message }
        : { count: entries.length }
    }

    // ============================================
    // 6. Ingested data (fake calendar events for today)
    // ============================================
    const calendarEvents = [
      {
        organization_id: orgId,
        source: 'calendar',
        data_type: 'calendar_event',
        source_id: `cal-${todayStr}-1`,
        payload: {
          title: 'Meridian Corp — Quarterly Business Review',
          start: `${todayStr}T14:00:00`,
          end: `${todayStr}T15:00:00`,
          event_type: 'external',
          attendees: ['Sarah Chen (Meridian)', 'Rich Blaalid', 'Wade Evanhoff'],
          location: 'Zoom',
          description: 'Q1 QBR with Meridian leadership. Review deliverables, discuss contract renewal.',
        },
        source_timestamp: `${todayStr}T14:00:00Z`,
        relevance_tags: ['client_meeting', 'meridian', 'qbr'],
        entities: { companies: ['Meridian Corp'], people: ['Sarah Chen'] },
      },
      {
        organization_id: orgId,
        source: 'calendar',
        data_type: 'calendar_event',
        source_id: `cal-${todayStr}-2`,
        payload: {
          title: 'Weekly L10 Meeting',
          start: `${todayStr}T10:00:00`,
          end: `${todayStr}T11:30:00`,
          event_type: 'internal',
          attendees: ['Rich Blaalid', 'John ONeill', 'Wade Evanhoff'],
          location: 'Conference Room A',
        },
        source_timestamp: `${todayStr}T10:00:00Z`,
        relevance_tags: ['l10', 'eos', 'internal'],
        entities: {},
      },
      {
        organization_id: orgId,
        source: 'calendar',
        data_type: 'calendar_event',
        source_id: `cal-${todayStr}-3`,
        payload: {
          title: 'NovaTech — Discovery Call',
          start: `${todayStr}T16:00:00`,
          end: `${todayStr}T16:30:00`,
          event_type: 'external',
          attendees: ['Mike Torres (NovaTech)', 'John ONeill'],
          location: 'Google Meet',
          description: 'Initial discovery call with NovaTech. Potential fixed-fee engagement.',
        },
        source_timestamp: `${todayStr}T16:00:00Z`,
        relevance_tags: ['sales', 'prospect', 'discovery'],
        entities: { companies: ['NovaTech'], people: ['Mike Torres'] },
      },
    ]

    const { error: calError } = await supabaseAdmin
      .from('ingested_data')
      .upsert(calendarEvents, { onConflict: 'organization_id,source,source_id' })

    results.calendar_events = calError
      ? { error: calError.message }
      : { count: calendarEvents.length }

    // ============================================
    // 7. Ingested data (fake emails)
    // ============================================
    const emails = [
      {
        organization_id: orgId,
        source: 'gmail',
        data_type: 'email',
        source_id: `email-${todayStr}-1`,
        payload: {
          subject: 'RE: Meridian Contract Renewal — Need Updated Pricing',
          from: 'sarah.chen@meridian.com',
          to: 'rich@withcaldera.com',
          priority: 'high',
          action_needed: true,
          category: 'client',
          snippet: 'Rich, we need the updated pricing proposal by EOW for budget approval. Our CFO is presenting to the board next Tuesday.',
        },
        source_timestamp: new Date(today.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        relevance_tags: ['client', 'pricing', 'urgent'],
        entities: { companies: ['Meridian Corp'], people: ['Sarah Chen'] },
      },
      {
        organization_id: orgId,
        source: 'gmail',
        data_type: 'email',
        source_id: `email-${todayStr}-2`,
        payload: {
          subject: 'Vertex Labs — Payment Status Update',
          from: 'ap@vertexlabs.io',
          to: 'rich@withcaldera.com',
          priority: 'medium',
          action_needed: false,
          category: 'billing',
          snippet: 'The payment for invoice #1247 is being processed. Expected release within 5 business days.',
        },
        source_timestamp: new Date(today.getTime() - 8 * 60 * 60 * 1000).toISOString(),
        relevance_tags: ['billing', 'ar'],
        entities: { companies: ['Vertex Labs'] },
      },
    ]

    const { error: emailError } = await supabaseAdmin
      .from('ingested_data')
      .upsert(emails, { onConflict: 'organization_id,source,source_id' })

    results.emails = emailError
      ? { error: emailError.message }
      : { count: emails.length }

    return NextResponse.json({
      message: 'Demo data seeded successfully',
      organization_id: orgId,
      ...results,
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
