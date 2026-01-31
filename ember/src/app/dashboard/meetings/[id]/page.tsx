'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Textarea, Badge } from '@/components/ui'
import type { Meeting, Profile, MeetingType, MeetingPrepContent } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

// Prep section component
function PrepSection({ prep }: { prep: MeetingPrepContent }) {
  return (
    <Card className="border-success/50 bg-success/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          AI Meeting Prep
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {prep.summary && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Summary</h4>
            <p className="text-foreground">{prep.summary}</p>
          </div>
        )}

        {prep.rocks_update && prep.rocks_update.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Rocks Update</h4>
            <ul className="list-disc list-inside text-foreground space-y-1">
              {prep.rocks_update.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {prep.issues_to_discuss && prep.issues_to_discuss.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Issues to Discuss</h4>
            <ul className="list-disc list-inside text-foreground space-y-1">
              {prep.issues_to_discuss.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {prep.scorecard_highlights && prep.scorecard_highlights.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Scorecard Highlights</h4>
            <ul className="list-disc list-inside text-foreground space-y-1">
              {prep.scorecard_highlights.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {prep.todos_review && prep.todos_review.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">To-dos Review</h4>
            <ul className="list-disc list-inside text-foreground space-y-1">
              {prep.todos_review.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {prep.generated_at && (
          <p className="text-xs text-muted-foreground">
            Generated: {new Date(prep.generated_at).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function MeetingDetailPage({ params }: PageProps) {
  const router = useRouter()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isGeneratingPrep, setIsGeneratingPrep] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meetingId, setMeetingId] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [meetingType, setMeetingType] = useState<MeetingType>('l10')
  const [meetingDate, setMeetingDate] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [notes, setNotes] = useState('')

  // Resolve params and fetch data
  useEffect(() => {
    params.then(p => setMeetingId(p.id))
  }, [params])

  useEffect(() => {
    if (!meetingId) return

    async function fetchData() {
      try {
        const [meetingRes, profilesRes] = await Promise.all([
          fetch(`/api/eos/meetings/${meetingId}`),
          fetch('/api/profiles')
        ])

        if (!meetingRes.ok) {
          throw new Error('Meeting not found')
        }

        const meetingData = await meetingRes.json()
        setMeeting(meetingData)

        // Initialize form state
        setTitle(meetingData.title)
        setMeetingType(meetingData.meeting_type)
        setMeetingDate(new Date(meetingData.meeting_date).toISOString().slice(0, 16))
        setDurationMinutes(meetingData.duration_minutes?.toString() || '')
        setNotes(meetingData.notes || '')

        if (profilesRes.ok) {
          const profilesData = await profilesRes.json()
          setProfiles(profilesData)
        }
      } catch {
        setError('Failed to load meeting')
      }
    }

    fetchData()
  }, [meetingId])

  const handleSave = async () => {
    if (!meetingId) return

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/meetings/${meetingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          meeting_type: meetingType,
          meeting_date: new Date(meetingDate).toISOString(),
          duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      const updated = await res.json()
      setMeeting(updated)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!meetingId) return
    if (!confirm('Are you sure you want to delete this meeting?')) return

    setIsDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/meetings/${meetingId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete')
      }

      router.push('/dashboard/meetings')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setIsDeleting(false)
    }
  }

  const handleGeneratePrep = async () => {
    if (!meetingId) return

    setIsGeneratingPrep(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/meetings/${meetingId}/prep`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate prep')
      }

      const updated = await res.json()
      setMeeting(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prep')
    } finally {
      setIsGeneratingPrep(false)
    }
  }

  if (!meeting) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            {error ? (
              <p className="text-danger">{error}</p>
            ) : (
              <p className="text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const meetingDateObj = new Date(meeting.meeting_date)
  const isPast = meetingDateObj < new Date()

  // Get attendee names
  const attendeeNames = meeting.attendees
    ?.map(id => profiles.find(p => p.id === id))
    .filter(Boolean)
    .map(p => p!.name || p!.email)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/meetings" className="hover:text-foreground">
          Meetings
        </Link>
        <span>/</span>
        <span className="text-foreground truncate max-w-[200px]">{meeting.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {isEditing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold"
              placeholder="Meeting title"
            />
          ) : (
            <h1 className="text-2xl font-bold text-foreground">{meeting.title}</h1>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={meeting.meeting_type === 'l10' ? 'info' : 'default'}>
              {meeting.meeting_type === 'l10' ? 'L10' : meeting.meeting_type}
            </Badge>
            {isPast ? (
              <Badge variant="default">Past</Badge>
            ) : (
              <Badge variant="warning">Upcoming</Badge>
            )}
            {meeting.prep_generated_at && (
              <Badge variant="success">Prep Ready</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={handleGeneratePrep}
                isLoading={isGeneratingPrep}
              >
                {meeting.prep_generated_at ? 'Regenerate Prep' : 'Generate Prep'}
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} isLoading={isSaving}>
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* AI Prep */}
      {meeting.prep_content && (
        <PrepSection prep={meeting.prep_content} />
      )}

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date & Time */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">
              Date & Time
            </label>
            {isEditing ? (
              <input
                type="datetime-local"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-white"
              />
            ) : (
              <p className="text-foreground">
                {meetingDateObj.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">
              Duration
            </label>
            {isEditing ? (
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-white"
              >
                <option value="">Not set</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
                <option value="180">180 min</option>
                <option value="240">240 min</option>
                <option value="480">480 min</option>
              </select>
            ) : (
              <p className="text-foreground">
                {meeting.duration_minutes ? `${meeting.duration_minutes} minutes` : 'Not set'}
              </p>
            )}
          </div>

          {/* Meeting Type */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">
              Type
            </label>
            {isEditing ? (
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-white"
              >
                <option value="l10">L10 (Weekly)</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="other">Other</option>
              </select>
            ) : (
              <p className="text-foreground capitalize">{meeting.meeting_type}</p>
            )}
          </div>

          {/* Attendees */}
          {attendeeNames && attendeeNames.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Attendees
              </label>
              <p className="text-foreground">
                {attendeeNames.join(', ')}
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">
              Notes
            </label>
            {isEditing ? (
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Add meeting notes..."
              />
            ) : (
              <p className="text-foreground whitespace-pre-wrap">
                {meeting.notes || <span className="italic text-muted-foreground">No notes</span>}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link
            href="/dashboard/rocks"
            className="flex items-center gap-2 text-sm text-ember-600 hover:text-ember-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            View Rocks
          </Link>
          <Link
            href="/dashboard/issues"
            className="flex items-center gap-2 text-sm text-ember-600 hover:text-ember-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            View Issues
          </Link>
          <Link
            href="/dashboard/scorecard"
            className="flex items-center gap-2 text-sm text-ember-600 hover:text-ember-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Scorecard
          </Link>
          <Link
            href="/dashboard/todos"
            className="flex items-center gap-2 text-sm text-ember-600 hover:text-ember-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            View To-dos
          </Link>
        </CardContent>
      </Card>

      {/* Danger zone */}
      {isEditing && (
        <Card className="border-danger/50">
          <CardHeader>
            <CardTitle className="text-danger">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete this meeting, there is no going back.
            </p>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Delete Meeting
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <div className="text-xs text-muted-foreground text-center space-x-4">
        <span>Created: {new Date(meeting.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(meeting.updated_at).toLocaleString()}</span>
      </div>
    </div>
  )
}
