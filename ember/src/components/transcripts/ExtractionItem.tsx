'use client'

import Link from 'next/link'
import { Button, Badge } from '@/components/ui'
import type { TranscriptExtractedItem, ExtractedMetric } from '@/types/database'

type ExtractionType = 'issues' | 'todos' | 'decisions' | 'metrics'

interface ExtractionItemProps {
  item: TranscriptExtractedItem | ExtractedMetric
  type: ExtractionType
  sourceTranscript: { id: string; title: string }
  onAction: () => void
  onDismiss: () => void
  isLoading?: boolean
}

function getActionLabel(type: ExtractionType): string {
  switch (type) {
    case 'issues':
      return 'Create Issue'
    case 'todos':
      return 'Create To-do'
    case 'metrics':
      return 'Add to Scorecard'
    case 'decisions':
      return '' // Decisions don't have an action
  }
}

export function ExtractionItem({
  item,
  type,
  sourceTranscript,
  onAction,
  onDismiss,
  isLoading = false,
}: ExtractionItemProps) {
  const isCreated = 'created' in item && item.created
  const actionLabel = getActionLabel(type)
  const title = 'name' in item ? item.name : item.title
  const context = item.context

  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground truncate">{title}</h4>
            {isCreated && (
              <Badge variant="success" size="sm">
                Created
              </Badge>
            )}
          </div>
          {context && (
            <p className="text-sm text-muted-foreground mt-1 italic line-clamp-2">
              &ldquo;{context}&rdquo;
            </p>
          )}
          <Link
            href={`/dashboard/transcripts/${sourceTranscript.id}`}
            className="text-xs text-ember-600 hover:text-ember-700 mt-1 inline-block"
          >
            From: {sourceTranscript.title || 'Transcript'}
          </Link>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actionLabel && !isCreated && (
            <Button size="sm" onClick={onAction} isLoading={isLoading} disabled={isLoading}>
              {actionLabel}
            </Button>
          )}
          {!isCreated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
