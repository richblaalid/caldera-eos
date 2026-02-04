'use client'

import Link from 'next/link'
import { Button, Badge } from '@/components/ui'
import type { Transcript } from '@/types/database'

interface TranscriptCardProps {
  transcript: Transcript
  onProcess: () => void
  isProcessing: boolean
}

export function TranscriptCard({ transcript, onProcess, isProcessing }: TranscriptCardProps) {
  const extractionCounts = transcript.extractions
    ? {
        issues: transcript.extractions.issues?.length || 0,
        todos: transcript.extractions.todos?.length || 0,
        metrics: transcript.extractions.metrics?.length || 0,
        decisions: transcript.extractions.decisions?.length || 0,
      }
    : null

  const totalExtractions = extractionCounts
    ? extractionCounts.issues +
      extractionCounts.todos +
      extractionCounts.metrics +
      extractionCounts.decisions
    : 0

  const dateStr = transcript.meeting_date
    ? new Date(transcript.meeting_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-background hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/transcripts/${transcript.id}`}
            className="font-medium text-foreground hover:text-ember-600 truncate"
          >
            {transcript.title || 'Untitled Transcript'}
          </Link>
          {transcript.processed ? (
            <Badge variant="success" size="sm">
              Processed
            </Badge>
          ) : (
            <Badge variant="default" size="sm">
              Unprocessed
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          {dateStr && <span>{dateStr}</span>}
          {extractionCounts && totalExtractions > 0 && (
            <span>
              {extractionCounts.issues > 0 && `${extractionCounts.issues} issues`}
              {extractionCounts.issues > 0 && extractionCounts.todos > 0 && ', '}
              {extractionCounts.todos > 0 && `${extractionCounts.todos} to-dos`}
              {(extractionCounts.issues > 0 || extractionCounts.todos > 0) &&
                extractionCounts.metrics > 0 &&
                ', '}
              {extractionCounts.metrics > 0 && `${extractionCounts.metrics} metrics`}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 ml-4">
        {!transcript.processed && (
          <Button size="sm" variant="outline" onClick={onProcess} isLoading={isProcessing}>
            Process
          </Button>
        )}
        {transcript.processed && (
          <Link href={`/dashboard/transcripts/${transcript.id}`}>
            <Button size="sm" variant="ghost">
              View
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
