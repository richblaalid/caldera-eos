'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Textarea } from '@/components/ui'
import type { Profile, MeetingType } from '@/types/database'

// Get default meeting date (next week same day at 9am)
function getDefaultMeetingDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  date.setHours(9, 0, 0, 0)
  return date.toISOString().slice(0, 16)
}

export default function NewMeetingPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('Weekly L10 Meeting')
  const [meetingType, setMeetingType] = useState<MeetingType>('l10')
  const [meetingDate, setMeetingDate] = useState(getDefaultMeetingDate())
  const [durationMinutes, setDurationMinutes] = useState('90')
  const [notes, setNotes] = useState('')
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([])

  // Fetch profiles
  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch('/api/profiles')
        if (res.ok) {
          const data = await res.json()
          setProfiles(data)
          // Pre-select all partners for L10
          setSelectedAttendees(data.map((p: Profile) => p.id))
        }
      } catch {
        console.error('Failed to fetch profiles')
      }
    }
    fetchProfiles()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!meetingDate) {
      setError('Meeting date is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/eos/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          meeting_type: meetingType,
          meeting_date: new Date(meetingDate).toISOString(),
          duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
          notes: notes.trim() || null,
          attendees: selectedAttendees,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create meeting')
      }

      const meeting = await res.json()
      router.push(`/dashboard/meetings/${meeting.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting')
      setIsSubmitting(false)
    }
  }

  const toggleAttendee = (id: string) => {
    setSelectedAttendees(prev =>
      prev.includes(id)
        ? prev.filter(a => a !== id)
        : [...prev, id]
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/meetings" className="hover:text-foreground">
          Meetings
        </Link>
        <span>/</span>
        <span className="text-foreground">New Meeting</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedule Meeting</h1>
          <p className="text-muted-foreground mt-1">
            Create a new L10 or team meeting
          </p>
        </div>

        {error && (
          <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Meeting Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekly L10 Meeting"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Meeting Type
                </label>
                <select
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background"
                >
                  <option value="l10">L10 (Weekly)</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Duration (minutes)
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background"
                >
                  <option value="60">60 min</option>
                  <option value="90">90 min (L10 standard)</option>
                  <option value="120">120 min</option>
                  <option value="180">180 min</option>
                  <option value="240">240 min (half day)</option>
                  <option value="480">480 min (full day)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background"
                required
              />
            </div>

            <Textarea
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes or agenda items..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Attendees */}
        {profiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Attendees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {profiles.map(profile => (
                  <label
                    key={profile.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAttendees.includes(profile.id)}
                      onChange={() => toggleAttendee(profile.id)}
                      className="w-4 h-4 rounded border-border text-ember-600 focus:ring-ember-500"
                    />
                    <span className="text-foreground">
                      {profile.name || profile.email}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/meetings')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create Meeting
          </Button>
        </div>
      </form>
    </div>
  )
}
