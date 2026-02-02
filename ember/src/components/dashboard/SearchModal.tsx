'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { SearchResults, RockWithOwner, IssueWithOwner, TodoWithOwner, Transcript, Meeting } from '@/types/database'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  initialQuery?: string
}

export function SearchModal({ isOpen, onClose, initialQuery = '' }: SearchModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery)
      setResults(null)
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen, initialQuery])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/search?q=${encodeURIComponent(searchQuery)}`)
      if (!res.ok) {
        throw new Error('Search failed')
      }
      const data: SearchResults = await res.json()
      setResults(data)
      setSelectedIndex(0)
    } catch {
      setError('Failed to search. Please try again.')
      setResults(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }

  // Get flattened results for keyboard navigation
  const flattenedResults = results
    ? [
        ...results.rocks.map((r) => ({ type: 'rock' as const, item: r })),
        ...results.issues.map((i) => ({ type: 'issue' as const, item: i })),
        ...results.todos.map((t) => ({ type: 'todo' as const, item: t })),
        ...results.transcripts.map((t) => ({ type: 'transcript' as const, item: t })),
        ...results.meetings.map((m) => ({ type: 'meeting' as const, item: m })),
      ]
    : []

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, flattenedResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && flattenedResults[selectedIndex]) {
      e.preventDefault()
      navigateToResult(flattenedResults[selectedIndex])
    }
  }

  // Navigate to selected result
  const navigateToResult = (result: { type: string; item: RockWithOwner | IssueWithOwner | TodoWithOwner | Transcript | Meeting }) => {
    let path = ''
    switch (result.type) {
      case 'rock':
        path = `/dashboard/rocks/${result.item.id}`
        break
      case 'issue':
        path = `/dashboard/issues/${result.item.id}`
        break
      case 'todo':
        path = `/dashboard/todos/${result.item.id}`
        break
      case 'transcript':
        path = `/dashboard/transcripts/${result.item.id}`
        break
      case 'meeting':
        path = `/dashboard/meetings/${result.item.id}`
        break
    }
    if (path) {
      router.push(path)
      onClose()
    }
  }

  // Check if there are any results
  const hasResults = results && (
    results.rocks.length > 0 ||
    results.issues.length > 0 ||
    results.todos.length > 0 ||
    results.transcripts.length > 0 ||
    results.meetings.length > 0
  )

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[20%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-50">
        <div className="bg-background border border-border rounded-xl shadow-lg overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <svg
              className="w-5 h-5 text-muted-foreground shrink-0"
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
            <input
              ref={inputRef}
              type="text"
              placeholder="Search rocks, issues, todos, transcripts..."
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {loading && (
              <svg
                className="w-5 h-5 text-muted-foreground animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground bg-muted rounded">
              esc
            </kbd>
          </div>

          {/* Results Area */}
          <div className="max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="px-4 py-8 text-center">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}

            {!error && query.length < 2 && (
              <div className="px-4 py-8 text-center">
                <p className="text-muted-foreground text-sm">
                  Type at least 2 characters to search
                </p>
              </div>
            )}

            {!error && query.length >= 2 && !loading && !hasResults && (
              <div className="px-4 py-8 text-center">
                <p className="text-muted-foreground text-sm">
                  No results found for &ldquo;{query}&rdquo;
                </p>
              </div>
            )}

            {hasResults && (
              <div className="py-2">
                {/* Rocks Section */}
                {results.rocks.length > 0 && (
                  <ResultSection
                    title="Rocks"
                    icon="mountain"
                    items={results.rocks}
                    type="rock"
                    selectedIndex={selectedIndex}
                    startIndex={0}
                    onSelect={navigateToResult}
                    renderItem={(rock) => (
                      <ResultItem
                        title={rock.title}
                        meta={rock.quarter}
                        status={rock.status}
                      />
                    )}
                  />
                )}

                {/* Issues Section */}
                {results.issues.length > 0 && (
                  <ResultSection
                    title="Issues"
                    icon="exclamation"
                    items={results.issues}
                    type="issue"
                    selectedIndex={selectedIndex}
                    startIndex={results.rocks.length}
                    onSelect={navigateToResult}
                    renderItem={(issue) => (
                      <ResultItem
                        title={issue.title}
                        meta={issue.status}
                      />
                    )}
                  />
                )}

                {/* Todos Section */}
                {results.todos.length > 0 && (
                  <ResultSection
                    title="To-dos"
                    icon="check"
                    items={results.todos}
                    type="todo"
                    selectedIndex={selectedIndex}
                    startIndex={results.rocks.length + results.issues.length}
                    onSelect={navigateToResult}
                    renderItem={(todo) => (
                      <ResultItem
                        title={todo.title}
                        meta={todo.due_date ? `Due ${todo.due_date}` : undefined}
                        completed={todo.completed}
                      />
                    )}
                  />
                )}

                {/* Transcripts Section */}
                {results.transcripts.length > 0 && (
                  <ResultSection
                    title="Transcripts"
                    icon="document"
                    items={results.transcripts}
                    type="transcript"
                    selectedIndex={selectedIndex}
                    startIndex={results.rocks.length + results.issues.length + results.todos.length}
                    onSelect={navigateToResult}
                    renderItem={(transcript) => (
                      <ResultItem
                        title={transcript.title || 'Untitled transcript'}
                        meta={transcript.meeting_date || undefined}
                      />
                    )}
                  />
                )}

                {/* Meetings Section */}
                {results.meetings.length > 0 && (
                  <ResultSection
                    title="Meetings"
                    icon="calendar"
                    items={results.meetings}
                    type="meeting"
                    selectedIndex={selectedIndex}
                    startIndex={
                      results.rocks.length +
                      results.issues.length +
                      results.todos.length +
                      results.transcripts.length
                    }
                    onSelect={navigateToResult}
                    renderItem={(meeting) => (
                      <ResultItem
                        title={meeting.title}
                        meta={meeting.meeting_date}
                      />
                    )}
                  />
                )}
              </div>
            )}
          </div>

          {/* Footer with keyboard hints */}
          <div className="px-4 py-2 border-t border-border bg-muted/50 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded">↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded">↵</kbd>
              <span>Open</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border border-border rounded">esc</kbd>
              <span>Close</span>
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

// =============================================
// Helper Components
// =============================================

interface ResultSectionProps<T> {
  title: string
  icon: 'mountain' | 'exclamation' | 'check' | 'document' | 'calendar'
  items: T[]
  type: string
  selectedIndex: number
  startIndex: number
  onSelect: (result: { type: string; item: T }) => void
  renderItem: (item: T) => React.ReactNode
}

function ResultSection<T extends { id: string }>({
  title,
  icon,
  items,
  type,
  selectedIndex,
  startIndex,
  onSelect,
  renderItem,
}: ResultSectionProps<T>) {
  return (
    <div className="py-1">
      <div className="px-4 py-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <ResultIcon icon={icon} />
        <span>{title}</span>
      </div>
      {items.map((item, index) => {
        const absoluteIndex = startIndex + index
        const isSelected = absoluteIndex === selectedIndex

        return (
          <button
            key={item.id}
            type="button"
            className={`w-full px-4 py-2 text-left hover:bg-muted/50 transition-colors ${
              isSelected ? 'bg-muted' : ''
            }`}
            onClick={() => onSelect({ type, item })}
          >
            {renderItem(item)}
          </button>
        )
      })}
    </div>
  )
}

function ResultIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'mountain':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    case 'exclamation':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    case 'check':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'document':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'calendar':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    default:
      return null
  }
}

interface ResultItemProps {
  title: string
  meta?: string
  status?: string
  completed?: boolean
}

function ResultItem({ title, meta, status, completed }: ResultItemProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className={`text-sm text-foreground truncate ${completed ? 'line-through opacity-60' : ''}`}>
          {title}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {status && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(status)}`}>
            {formatStatus(status)}
          </span>
        )}
        {meta && !status && (
          <span className="text-xs text-muted-foreground">{meta}</span>
        )}
      </div>
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'on_track':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'off_track':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'at_risk':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'complete':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'open':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    case 'solved':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}
