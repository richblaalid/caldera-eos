import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMeeting, updateMeeting, getRocks, getIssues, getTodos, getMetrics, getAllMetricEntries } from '@/lib/eos'
import { generateMeetingPrep, PrepInput } from '@/lib/claude'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Helper to get the start of the week
function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

// POST /api/eos/meetings/[id]/prep - Generate AI prep for a meeting
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // Get the meeting (validates it exists)
    await getMeeting(id)

    // Gather all EOS data for prep
    const [rocks, issues, todos, metrics] = await Promise.all([
      getRocks(),
      getIssues(),
      getTodos({ completed: false }),
      getMetrics(),
    ])

    // Get latest scorecard entries (last 2 weeks)
    const now = new Date()
    const weekStart = getWeekStart(now)
    const twoWeeksAgo = new Date(now)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const entries = await getAllMetricEntries(getWeekStart(twoWeeksAgo), weekStart)

    // Build prep input
    const prepInput: PrepInput = {
      rocks: rocks.map(r => ({
        title: r.title,
        status: r.status,
        owner_name: r.owner?.name || r.owner?.email || null,
        milestones: r.milestones,
      })),
      issues: issues.map(i => ({
        title: i.title,
        status: i.status,
        priority: i.priority,
        owner_name: i.owner?.name || i.owner?.email || null,
      })),
      metrics: metrics.map(m => {
        const latestEntry = entries.find(e => e.metric_id === m.id)
        return {
          name: m.name,
          target: m.target,
          latest_value: latestEntry?.value ?? null,
          goal_direction: m.goal_direction,
          owner_name: m.owner?.name || m.owner?.email || null,
        }
      }),
      todos: todos.map(t => ({
        title: t.title,
        owner_name: t.owner?.name || t.owner?.email || null,
        due_date: t.due_date,
        completed: t.completed,
      })),
    }

    // Generate prep using Claude
    const prepContent = await generateMeetingPrep(prepInput)

    // Update meeting with prep content
    const updatedMeeting = await updateMeeting(id, {
      prep_content: prepContent,
      prep_generated_at: new Date().toISOString(),
    })

    return NextResponse.json(updatedMeeting)
  } catch (error) {
    console.error('Failed to generate prep:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate prep' },
      { status: 500 }
    )
  }
}
