import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMeetings, getRocks, getIssues, getTodos, getMetrics, getAllMetricEntries, updateMeeting } from '@/lib/eos'
import { generateMeetingPrep, PrepInput } from '@/lib/claude'

// Vercel Cron runs this endpoint on schedule
// Configure in vercel.json: "crons": [{ "path": "/api/cron/generate-prep", "schedule": "0 9 * * *" }]

// Helper to get the start of the week
function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // In development, allow without auth
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Get all upcoming meetings in the next 3 days that don't have prep
    const meetings = await getMeetings()
    const now = new Date()
    const threeDaysFromNow = new Date(now)
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const meetingsNeedingPrep = meetings.filter(m => {
      const meetingDate = new Date(m.meeting_date)
      return (
        meetingDate > now &&
        meetingDate <= threeDaysFromNow &&
        !m.prep_generated_at
      )
    })

    if (meetingsNeedingPrep.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No meetings need prep generation',
        processed: 0,
      })
    }

    // Gather EOS data once for all meetings
    const [rocks, issues, todos, metrics] = await Promise.all([
      getRocks(),
      getIssues(),
      getTodos({ completed: false }),
      getMetrics(),
    ])

    // Get latest scorecard entries
    const twoWeeksAgo = new Date(now)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const entries = await getAllMetricEntries(getWeekStart(twoWeeksAgo), getWeekStart(now))

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
        }
      }),
      todos: todos.map(t => ({
        title: t.title,
        owner_name: t.owner?.name || t.owner?.email || null,
        due_date: t.due_date,
        completed: t.completed,
      })),
    }

    // Generate prep for each meeting
    const results = []
    for (const meeting of meetingsNeedingPrep) {
      try {
        const prepContent = await generateMeetingPrep(prepInput)
        await updateMeeting(meeting.id, {
          prep_content: prepContent,
          prep_generated_at: new Date().toISOString(),
        })
        results.push({ id: meeting.id, title: meeting.title, success: true })
      } catch (error) {
        console.error(`Failed to generate prep for meeting ${meeting.id}:`, error)
        results.push({
          id: meeting.id,
          title: meeting.title,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} meetings`,
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error('Cron job failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron job failed' },
      { status: 500 }
    )
  }
}
