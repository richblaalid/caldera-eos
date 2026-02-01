'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui'
import type { Transcript, Meeting, TranscriptExtractions, TranscriptExtractedItem } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function TranscriptDetailPage({ params }: PageProps) {
  const router = useRouter()
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcriptId, setTranscriptId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [extractions, setExtractions] = useState<TranscriptExtractions | null>(null)
  const [creatingItem, setCreatingItem] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [meetingId, setMeetingId] = useState<string | null>(null)
  const [meetingDate, setMeetingDate] = useState('')
  const [participants, setParticipants] = useState('')

  // Resolve params and fetch data
  useEffect(() => {
    params.then((p) => setTranscriptId(p.id))
  }, [params])

  useEffect(() => {
    if (!transcriptId) return

    async function fetchData() {
      try {
        const [transcriptRes, meetingsRes] = await Promise.all([
          fetch(`/api/eos/transcripts/${transcriptId}`),
          fetch('/api/eos/meetings'),
        ])

        if (!transcriptRes.ok) {
          throw new Error('Transcript not found')
        }

        const transcriptData = await transcriptRes.json()
        setTranscript(transcriptData)

        // Load extractions from transcript data if available
        if (transcriptData.extractions) {
          setExtractions(transcriptData.extractions)
        }

        // Initialize form state
        setTitle(transcriptData.title || '')
        setMeetingId(transcriptData.meeting_id)
        setMeetingDate(transcriptData.meeting_date?.slice(0, 16) || '')
        setParticipants(transcriptData.participants?.join(', ') || '')

        if (meetingsRes.ok) {
          const meetingsData = await meetingsRes.json()
          setMeetings(meetingsData)
          // Find the linked meeting
          if (transcriptData.meeting_id) {
            const linkedMeeting = meetingsData.find(
              (m: Meeting) => m.id === transcriptData.meeting_id
            )
            setMeeting(linkedMeeting || null)
          }
        }
      } catch {
        setError('Failed to load transcript')
      }
    }

    fetchData()
  }, [transcriptId])

  const handleSave = async () => {
    if (!transcriptId) return

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/transcripts/${transcriptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          meeting_id: meetingId || null,
          meeting_date: meetingDate ? new Date(meetingDate).toISOString() : null,
          participants: participants
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      const updated = await res.json()
      setTranscript(updated)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!transcriptId) return
    if (!confirm('Are you sure you want to delete this transcript?')) return

    setIsDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/transcripts/${transcriptId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete')
      }

      router.push('/dashboard/transcripts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setIsDeleting(false)
    }
  }

  // Helper to persist extractions changes to DB
  const persistExtractions = async (newExtractions: TranscriptExtractions) => {
    if (!transcriptId) return

    try {
      await fetch(`/api/eos/transcripts/${transcriptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractions: newExtractions }),
      })
    } catch (err) {
      console.error('Failed to persist extractions:', err)
    }
  }

  const handleProcess = async () => {
    if (!transcriptId) return

    setIsProcessing(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/transcripts/${transcriptId}/process`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to process transcript')
      }

      const result = await res.json()
      setTranscript(result)
      if (result.extractions) {
        setExtractions(result.extractions)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCreateIssue = async (item: TranscriptExtractedItem) => {
    setCreatingItem(item.title)
    try {
      const res = await fetch('/api/eos/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          description: item.description || item.context,
          priority: item.priority || 2,
          source: 'transcript',
          source_id: transcriptId,
        }),
      })

      if (!res.ok) throw new Error('Failed to create issue')

      // Mark as created in extractions and persist to DB
      const newExtractions = extractions
        ? {
            ...extractions,
            issues: extractions.issues.map((i) =>
              i.title === item.title ? { ...i, created: true } : i
            ),
          }
        : null

      if (newExtractions) {
        setExtractions(newExtractions)
        await persistExtractions(newExtractions)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue')
    } finally {
      setCreatingItem(null)
    }
  }

  const handleCreateTodo = async (item: TranscriptExtractedItem) => {
    setCreatingItem(item.title)
    try {
      // Calculate default due date (7 days from now per EOS)
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)

      const res = await fetch('/api/eos/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          description: item.context,
          due_date: item.due_date || dueDate.toISOString().split('T')[0],
        }),
      })

      if (!res.ok) throw new Error('Failed to create to-do')

      // Mark as created in extractions and persist to DB
      const newExtractions = extractions
        ? {
            ...extractions,
            todos: extractions.todos.map((t) =>
              t.title === item.title ? { ...t, created: true } : t
            ),
          }
        : null

      if (newExtractions) {
        setExtractions(newExtractions)
        await persistExtractions(newExtractions)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create to-do')
    } finally {
      setCreatingItem(null)
    }
  }

  const dismissExtraction = async (type: 'issues' | 'todos' | 'decisions', title: string) => {
    const newExtractions = extractions
      ? {
          ...extractions,
          [type]: extractions[type].filter((item) => item.title !== title),
        }
      : null

    if (newExtractions) {
      setExtractions(newExtractions)
      await persistExtractions(newExtractions)
    }
  }

  // Highlight search matches in text
  const highlightedText = useMemo(() => {
    if (!transcript?.full_text || !searchTerm.trim()) {
      return transcript?.full_text || ''
    }

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return transcript.full_text.replace(
      regex,
      '<mark class="bg-warning/50 px-0.5 rounded">$1</mark>'
    )
  }, [transcript?.full_text, searchTerm])

  // Count matches
  const matchCount = useMemo(() => {
    if (!transcript?.full_text || !searchTerm.trim()) return 0
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    return (transcript.full_text.match(regex) || []).length
  }, [transcript?.full_text, searchTerm])

  if (!transcript) {
    return (
      <div className="max-w-5xl mx-auto">
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

  const date = transcript.meeting_date
    ? new Date(transcript.meeting_date)
    : new Date(transcript.created_at)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/transcripts" className="hover:text-foreground">
          Transcripts
        </Link>
        <span>/</span>
        <span className="text-foreground truncate max-w-[200px]">
          {transcript.title || 'Untitled'}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {isEditing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold"
              placeholder="Transcript title"
            />
          ) : (
            <h1 className="text-2xl font-bold text-foreground">
              {transcript.title || 'Untitled Transcript'}
            </h1>
          )}
          <div className="flex items-center gap-2 mt-2">
            {transcript.processed ? (
              <Badge variant="success">Processed</Badge>
            ) : (
              <Badge variant="warning">Pending</Badge>
            )}
            {transcript.source && (
              <Badge variant="default">{transcript.source}</Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              {!transcript.processed && (
                <Button
                  variant="primary"
                  onClick={handleProcess}
                  isLoading={isProcessing}
                >
                  Process Transcript
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
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

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Linked Meeting */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Linked Meeting
              </label>
              {isEditing ? (
                <select
                  value={meetingId || ''}
                  onChange={(e) => setMeetingId(e.target.value || null)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background"
                >
                  <option value="">None</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} - {new Date(m.meeting_date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              ) : meeting ? (
                <Link
                  href={`/dashboard/meetings/${meeting.id}`}
                  className="text-ember-600 hover:text-ember-700"
                >
                  {meeting.title}
                </Link>
              ) : (
                <p className="text-foreground">Not linked</p>
              )}
            </div>

            {/* Meeting Date */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Meeting Date
              </label>
              {isEditing ? (
                <input
                  type="datetime-local"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background"
                />
              ) : (
                <p className="text-foreground">
                  {transcript.meeting_date
                    ? new Date(transcript.meeting_date).toLocaleString()
                    : 'Not set'}
                </p>
              )}
            </div>
          </div>

          {/* Participants */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">
              Participants
            </label>
            {isEditing ? (
              <Input
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="Comma-separated names"
              />
            ) : (
              <p className="text-foreground">
                {transcript.participants && transcript.participants.length > 0
                  ? transcript.participants.join(', ')
                  : 'Not specified'}
              </p>
            )}
          </div>

          {/* Summary */}
          {transcript.summary && (
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Summary
              </label>
              <p className="text-foreground">{transcript.summary}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transcript Content</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search transcript..."
                  className="w-64 h-9 pl-9 pr-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ember-500"
                />
                <svg
                  className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              {searchTerm && (
                <span className="text-sm text-muted-foreground">
                  {matchCount} match{matchCount !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-sm bg-muted/30 p-4 rounded-lg max-h-[600px] overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: highlightedText }}
          />
        </CardContent>
      </Card>

      {/* Extracted Items */}
      {extractions && (extractions.issues.length > 0 || extractions.todos.length > 0 || extractions.decisions.length > 0) && (
        <Card className="border-ember-200">
          <CardHeader>
            <CardTitle>Extracted Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Issues */}
            {extractions.issues.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Issues ({extractions.issues.filter(i => !i.created).length} pending, {extractions.issues.filter(i => i.created).length} created)
                </h3>
                <div className="space-y-2">
                  {extractions.issues.map((item, i) => (
                    <div key={i} className={`flex items-start justify-between gap-3 p-3 rounded-lg ${item.created ? 'bg-success/10' : 'bg-muted/50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium ${item.created ? 'text-muted-foreground' : 'text-foreground'}`}>{item.title}</p>
                          {item.created && <Badge variant="success">Created</Badge>}
                        </div>
                        {item.context && (
                          <p className="text-sm text-muted-foreground mt-1 italic">&ldquo;{item.context}&rdquo;</p>
                        )}
                      </div>
                      {!item.created && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleCreateIssue(item)}
                            isLoading={creatingItem === item.title}
                          >
                            Create Issue
                          </Button>
                          <button
                            onClick={() => dismissExtraction('issues', item.title)}
                            className="p-1 text-muted-foreground hover:text-foreground"
                            title="Dismiss"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* To-dos */}
            {extractions.todos.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  To-dos ({extractions.todos.filter(t => !t.created).length} pending, {extractions.todos.filter(t => t.created).length} created)
                </h3>
                <div className="space-y-2">
                  {extractions.todos.map((item, i) => (
                    <div key={i} className={`flex items-start justify-between gap-3 p-3 rounded-lg ${item.created ? 'bg-success/10' : 'bg-muted/50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium ${item.created ? 'text-muted-foreground' : 'text-foreground'}`}>{item.title}</p>
                          {item.created && <Badge variant="success">Created</Badge>}
                        </div>
                        {item.owner && (
                          <p className="text-sm text-muted-foreground">Owner: {item.owner}</p>
                        )}
                        {item.context && (
                          <p className="text-sm text-muted-foreground mt-1 italic">&ldquo;{item.context}&rdquo;</p>
                        )}
                      </div>
                      {!item.created && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleCreateTodo(item)}
                            isLoading={creatingItem === item.title}
                          >
                            Create To-do
                          </Button>
                          <button
                            onClick={() => dismissExtraction('todos', item.title)}
                            className="p-1 text-muted-foreground hover:text-foreground"
                            title="Dismiss"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decisions */}
            {extractions.decisions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Decisions ({extractions.decisions.length})
                </h3>
                <div className="space-y-2">
                  {extractions.decisions.map((item, i) => (
                    <div key={i} className="p-3 bg-success/10 rounded-lg">
                      <p className="font-medium text-foreground">{item.title}</p>
                      {item.context && (
                        <p className="text-sm text-muted-foreground mt-1 italic">&ldquo;{item.context}&rdquo;</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Processing Status */}
      {transcript.processed && transcript.processed_at && (
        <Card className="border-success/50 bg-success/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-success font-medium">
                Processed on {new Date(transcript.processed_at).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      {isEditing && (
        <Card className="border-danger/50">
          <CardHeader>
            <CardTitle className="text-danger">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete this transcript, there is no going back. All
              associated chunks and insights will also be deleted.
            </p>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Delete Transcript
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <div className="text-xs text-muted-foreground text-center space-x-4">
        <span>Created: {new Date(transcript.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(transcript.updated_at).toLocaleString()}</span>
      </div>
    </div>
  )
}
