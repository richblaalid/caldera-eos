'use client'

import { useState } from 'react'
import { ExtractionItem } from './ExtractionItem'
import type { TranscriptExtractedItem, ExtractedMetric } from '@/types/database'

type ExtractionType = 'issues' | 'todos' | 'decisions' | 'metrics'

interface ExtractionWithSource {
  item: TranscriptExtractedItem | ExtractedMetric
  transcript: { id: string; title: string }
}

interface ExtractionSectionProps {
  title: string
  icon: React.ReactNode
  items: ExtractionWithSource[]
  type: ExtractionType
  onAction: (item: TranscriptExtractedItem | ExtractedMetric, transcriptId: string) => void
  onDismiss: (item: TranscriptExtractedItem | ExtractedMetric, transcriptId: string) => void
  loadingItem: string | null
  defaultExpanded?: boolean
}

export function ExtractionSection({
  title,
  icon,
  items,
  type,
  onAction,
  onDismiss,
  loadingItem,
  defaultExpanded = true,
}: ExtractionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Filter out items that are already created (unless they were just created in this session)
  const visibleItems = items.filter((i) => {
    const isCreated = 'created' in i.item && i.item.created
    return !isCreated || loadingItem === ('name' in i.item ? i.item.name : i.item.title)
  })

  if (items.length === 0) {
    return null
  }

  const createdCount = items.filter((i) => 'created' in i.item && i.item.created).length
  const pendingCount = items.length - createdCount

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-medium text-foreground">{title}</span>
          <span className="text-sm text-muted-foreground">
            ({pendingCount} pending{createdCount > 0 && `, ${createdCount} created`})
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-muted-foreground transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="px-4 divide-y divide-border">
          {items.map((extraction, index) => {
            const itemTitle =
              'name' in extraction.item ? extraction.item.name : extraction.item.title
            return (
              <ExtractionItem
                key={`${extraction.transcript.id}-${itemTitle}-${index}`}
                item={extraction.item}
                type={type}
                sourceTranscript={extraction.transcript}
                onAction={() => onAction(extraction.item, extraction.transcript.id)}
                onDismiss={() => onDismiss(extraction.item, extraction.transcript.id)}
                isLoading={loadingItem === itemTitle}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
