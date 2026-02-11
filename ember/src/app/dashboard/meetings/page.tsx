import Link from 'next/link'
import { getMeetings, getUpcomingMeeting } from '@/lib/eos'
import { Card, CardContent, Badge } from '@/components/ui'
import type { Meeting, MeetingType } from '@/types/database'

// Type filter component
function TypeFilter({
  currentType
}: {
  currentType: string | null
}) {
  const types: { value: string | null; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'l10', label: 'L10' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'annual', label: 'Annual' },
    { value: 'other', label: 'Other' },
  ]

  return (
    <div className="flex gap-2 flex-wrap">
      {types.map(({ value, label }) => {
        const isActive = currentType === value
        const href = value
          ? `/dashboard/meetings?type=${value}`
          : `/dashboard/meetings`

        return (
          <Link
            key={label}
            href={href}
            className={`
              px-3 py-1.5 text-sm rounded-lg transition-colors
              ${isActive
                ? 'bg-ember-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }
            `}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}

// Meeting type badge
function MeetingTypeBadge({ type }: { type: MeetingType }) {
  const labels: Record<MeetingType, string> = {
    l10: 'L10',
    quarterly: 'Quarterly',
    annual: 'Annual',
    other: 'Other',
  }

  const variants: Record<MeetingType, 'info' | 'success' | 'warning' | 'default'> = {
    l10: 'info',
    quarterly: 'success',
    annual: 'warning',
    other: 'default',
  }

  return <Badge variant={variants[type]}>{labels[type]}</Badge>
}

// Meeting card component
function MeetingCard({ meeting, isUpcoming }: { meeting: Meeting; isUpcoming: boolean }) {
  const meetingDate = new Date(meeting.meeting_date)
  const isPast = meetingDate < new Date()

  return (
    <Link href={`/dashboard/meetings/${meeting.id}`}>
      <Card className={`hover:shadow-md transition-shadow cursor-pointer ${isPast && !isUpcoming ? 'opacity-60' : ''}`}>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <MeetingTypeBadge type={meeting.meeting_type} />
                {isUpcoming && (
                  <Badge variant="warning">Upcoming</Badge>
                )}
                {meeting.prep_generated_at && (
                  <Badge variant="success">Prep Ready</Badge>
                )}
              </div>
              <h3 className="font-semibold text-foreground">
                {meeting.title}
              </h3>
              {meeting.notes && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {meeting.notes}
                </p>
              )}
            </div>
            <div className="text-right text-sm">
              <p className="font-medium text-foreground">
                {meetingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
              <p className="text-muted-foreground">
                {meetingDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
              {meeting.duration_minutes && (
                <p className="text-muted-foreground text-xs">
                  {meeting.duration_minutes} min
                </p>
              )}
            </div>
          </div>

          {meeting.attendees && meeting.attendees.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

// Empty state component
function EmptyState() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-muted-foreground mb-4">
          No meetings scheduled.
        </p>
        <Link
          href="/dashboard/meetings/new"
          className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-ember-600 text-white hover:bg-ember-700 transition-colors"
        >
          Schedule First Meeting
        </Link>
      </CardContent>
    </Card>
  )
}

interface PageProps {
  searchParams: Promise<{ type?: string }>
}

export default async function MeetingsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const typeFilter = params.type || null

  const [meetings, upcomingMeeting] = await Promise.all([
    getMeetings(typeFilter || undefined),
    getUpcomingMeeting()
  ])

  // Separate upcoming and past meetings
  const now = new Date()
  const upcomingMeetings = meetings
    .filter(m => new Date(m.meeting_date) >= now)
    .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())
  const pastMeetings = meetings.filter(m => new Date(m.meeting_date) < now)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meetings</h1>
          <p className="text-muted-foreground mt-1">
            L10 and team meetings with AI prep
          </p>
        </div>
        <Link
          href="/dashboard/meetings/new"
          className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-ember-600 text-white hover:bg-ember-700 transition-colors"
        >
          Schedule Meeting
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-foreground">{meetings.length}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-ember-600">{upcomingMeetings.length}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Upcoming</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-foreground">{pastMeetings.length}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Past</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-success">
              {meetings.filter(m => m.prep_generated_at).length}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">With Prep</p>
          </CardContent>
        </Card>
      </div>

      {/* Next Meeting Highlight */}
      {upcomingMeeting && (
        <Card className="border-ember-200 bg-ember-50/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ember-600 font-medium uppercase tracking-wide mb-1">
                  Next Meeting
                </p>
                <p className="font-semibold text-foreground">{upcomingMeeting.title}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(upcomingMeeting.meeting_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <Link
                href={`/dashboard/meetings/${upcomingMeeting.id}`}
                className="inline-flex items-center justify-center h-9 px-3 text-sm font-medium rounded-lg bg-ember-600 text-white hover:bg-ember-700 transition-colors"
              >
                {upcomingMeeting.prep_generated_at ? 'View Prep' : 'View Details'}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-2 block">
          Filter by Type
        </label>
        <TypeFilter currentType={typeFilter} />
      </div>

      {/* Meeting Lists */}
      {meetings.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {/* Upcoming Meetings */}
          {upcomingMeetings.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">Upcoming</h2>
              <div className="space-y-3">
                {upcomingMeetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    isUpcoming={upcomingMeeting?.id === meeting.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past Meetings */}
          {pastMeetings.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">Past Meetings</h2>
              <div className="space-y-3">
                {pastMeetings.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} isUpcoming={false} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
