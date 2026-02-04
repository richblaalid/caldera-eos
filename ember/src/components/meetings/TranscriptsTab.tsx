'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Card, CardContent } from '@/components/ui'
import { TranscriptCard, ExtractionSection } from '@/components/transcripts'
import type { Transcript, TranscriptExtractedItem, ExtractedMetric } from '@/types/database'

interface TranscriptsTabProps {
  meetingId: string
}

// Icons for extraction types
const IssueIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
)

const TodoIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
)

const MetricIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
)

const DecisionIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
)

export function TranscriptsTab({ meetingId }: TranscriptsTabProps) {
  const router = useRouter()
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchTranscripts = useCallback(async () => {
    try {
      const res = await fetch(`/api/eos/transcripts?meeting_id=${meetingId}`)
      if (res.ok) {
        const data = await res.json()
        setTranscripts(data)
      }
    } catch {
      setError('Failed to load transcripts')
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => {
    fetchTranscripts()
  }, [fetchTranscripts])

  const handleProcess = async (transcriptId: string) => {
    setProcessingId(transcriptId)
    try {
      const res = await fetch(`/api/eos/transcripts/${transcriptId}/process`, {
        method: 'POST',
      })
      if (res.ok) {
        // Refresh transcripts to get updated extractions
        await fetchTranscripts()
      } else {
        setError('Failed to process transcript')
      }
    } catch {
      setError('Failed to process transcript')
    } finally {
      setProcessingId(null)
    }
  }

  const updateTranscriptExtractions = async (
    transcriptId: string,
    extractions: Transcript['extractions']
  ) => {
    await fetch(`/api/eos/transcripts/${transcriptId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extractions }),
    })
  }

  const handleCreateIssue = async (item: TranscriptExtractedItem, transcriptId: string) => {
    setActionLoading(item.title)
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

      if (res.ok) {
        // Update transcript to mark item as created
        const transcript = transcripts.find((t) => t.id === transcriptId)
        if (transcript?.extractions) {
          const updatedExtractions = {
            ...transcript.extractions,
            issues: transcript.extractions.issues.map((i) =>
              i.title === item.title ? { ...i, created: true } : i
            ),
          }
          await updateTranscriptExtractions(transcriptId, updatedExtractions)
          await fetchTranscripts()
        }
      }
    } catch {
      setError('Failed to create issue')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreateTodo = async (item: TranscriptExtractedItem, transcriptId: string) => {
    setActionLoading(item.title)
    try {
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

      if (res.ok) {
        // Update transcript to mark item as created
        const transcript = transcripts.find((t) => t.id === transcriptId)
        if (transcript?.extractions) {
          const updatedExtractions = {
            ...transcript.extractions,
            todos: transcript.extractions.todos.map((t) =>
              t.title === item.title ? { ...t, created: true } : t
            ),
          }
          await updateTranscriptExtractions(transcriptId, updatedExtractions)
          await fetchTranscripts()
        }
      }
    } catch {
      setError('Failed to create to-do')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAddMetric = (item: ExtractedMetric) => {
    const params = new URLSearchParams({
      name: item.name,
      ...(item.description && { description: item.description }),
      ...(item.suggested_target && { target: item.suggested_target }),
      ...(item.owner && { owner: item.owner }),
      ...(item.frequency && { frequency: item.frequency }),
    })
    router.push(`/dashboard/scorecard/metrics/new?${params.toString()}`)
  }

  const handleDismiss = async (
    item: TranscriptExtractedItem | ExtractedMetric,
    transcriptId: string,
    type: 'issues' | 'todos' | 'decisions' | 'metrics'
  ) => {
    const itemTitle = 'name' in item ? item.name : item.title
    setActionLoading(itemTitle)
    try {
      const transcript = transcripts.find((t) => t.id === transcriptId)
      if (transcript?.extractions) {
        const updatedExtractions = {
          ...transcript.extractions,
          [type]: transcript.extractions[type].filter((i: TranscriptExtractedItem | ExtractedMetric) => {
            const title = 'name' in i ? i.name : i.title
            return title !== itemTitle
          }),
        }
        await updateTranscriptExtractions(transcriptId, updatedExtractions)
        await fetchTranscripts()
      }
    } catch {
      setError('Failed to dismiss item')
    } finally {
      setActionLoading(null)
    }
  }

  // Aggregate extractions from all transcripts
  const aggregatedExtractions = {
    issues: transcripts.flatMap((t) =>
      (t.extractions?.issues || []).map((item) => ({
        item,
        transcript: { id: t.id, title: t.title || 'Transcript' },
      }))
    ),
    todos: transcripts.flatMap((t) =>
      (t.extractions?.todos || []).map((item) => ({
        item,
        transcript: { id: t.id, title: t.title || 'Transcript' },
      }))
    ),
    metrics: transcripts.flatMap((t) =>
      (t.extractions?.metrics || []).map((item) => ({
        item,
        transcript: { id: t.id, title: t.title || 'Transcript' },
      }))
    ),
    decisions: transcripts.flatMap((t) =>
      (t.extractions?.decisions || []).map((item) => ({
        item,
        transcript: { id: t.id, title: t.title || 'Transcript' },
      }))
    ),
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-muted rounded-lg" />
          <div className="h-16 bg-muted rounded-lg" />
        </div>
      </div>
    )
  }

  if (transcripts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <svg
            className="w-12 h-12 mx-auto text-muted-foreground mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-lg font-medium text-foreground mb-1">No transcripts attached</h3>
          <p className="text-muted-foreground mb-4">
            Upload a meeting transcript to extract issues, to-dos, and metrics.
          </p>
          <Link href="/dashboard/transcripts">
            <Button>Upload Transcript</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>
      )}

      {/* Transcript Cards */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Attached Transcripts ({transcripts.length})
        </h3>
        <div className="space-y-2">
          {transcripts.map((transcript) => (
            <TranscriptCard
              key={transcript.id}
              transcript={transcript}
              onProcess={() => handleProcess(transcript.id)}
              isProcessing={processingId === transcript.id}
            />
          ))}
        </div>
      </div>

      {/* Extraction Sections */}
      {(aggregatedExtractions.issues.length > 0 ||
        aggregatedExtractions.todos.length > 0 ||
        aggregatedExtractions.metrics.length > 0 ||
        aggregatedExtractions.decisions.length > 0) && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Extracted Items</h3>
          <div className="space-y-3">
            <ExtractionSection
              title="Issues"
              icon={IssueIcon}
              items={aggregatedExtractions.issues}
              type="issues"
              onAction={(item, transcriptId) =>
                handleCreateIssue(item as TranscriptExtractedItem, transcriptId)
              }
              onDismiss={(item, transcriptId) =>
                handleDismiss(item, transcriptId, 'issues')
              }
              loadingItem={actionLoading}
            />
            <ExtractionSection
              title="To-dos"
              icon={TodoIcon}
              items={aggregatedExtractions.todos}
              type="todos"
              onAction={(item, transcriptId) =>
                handleCreateTodo(item as TranscriptExtractedItem, transcriptId)
              }
              onDismiss={(item, transcriptId) =>
                handleDismiss(item, transcriptId, 'todos')
              }
              loadingItem={actionLoading}
            />
            <ExtractionSection
              title="Suggested Metrics"
              icon={MetricIcon}
              items={aggregatedExtractions.metrics}
              type="metrics"
              onAction={(item) => handleAddMetric(item as ExtractedMetric)}
              onDismiss={(item, transcriptId) =>
                handleDismiss(item, transcriptId, 'metrics')
              }
              loadingItem={actionLoading}
            />
            <ExtractionSection
              title="Decisions"
              icon={DecisionIcon}
              items={aggregatedExtractions.decisions}
              type="decisions"
              onAction={() => {}} // Decisions don't have an action
              onDismiss={(item, transcriptId) =>
                handleDismiss(item, transcriptId, 'decisions')
              }
              loadingItem={actionLoading}
              defaultExpanded={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}
