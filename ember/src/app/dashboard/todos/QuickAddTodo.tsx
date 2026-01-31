'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, Button } from '@/components/ui'
import type { Profile } from '@/types/database'

interface QuickAddTodoProps {
  profiles: Profile[]
}

// Get default due date (7 days from now per EOS)
function getDefaultDueDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().split('T')[0]
}

export function QuickAddTodo({ profiles }: QuickAddTodoProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState(getDefaultDueDate())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/eos/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          due_date: dueDate || null,
          owner_id: ownerId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create to-do')
      }

      // Reset form
      setTitle('')
      setOwnerId(null)
      setDueDate(getDefaultDueDate())
      setIsExpanded(false)

      // Refresh the page
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create to-do')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setTitle('')
    setOwnerId(null)
    setDueDate(getDefaultDueDate())
    setError(null)
    setIsExpanded(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (!isExpanded) {
    return (
      <Card
        className="border-dashed border-2 hover:border-ember-300 transition-colors cursor-pointer"
        onClick={() => setIsExpanded(true)}
      >
        <CardContent className="py-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm">Quick add to-do...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-ember-200">
      <CardContent className="py-4">
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          {error && (
            <div className="mb-3 p-2 bg-danger/10 text-danger rounded text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {/* Title input */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-ember-500"
            />

            {/* Options row */}
            <div className="flex items-center gap-3">
              <select
                value={ownerId || ''}
                onChange={(e) => setOwnerId(e.target.value || null)}
                className="h-9 px-2 text-sm rounded-lg border border-border bg-white"
              >
                <option value="">Unassigned</option>
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name?.split(' ')[0] || profile.email}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9 px-2 text-sm rounded-lg border border-border bg-white"
              />

              <div className="flex-1" />

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={isSubmitting}
              >
                Add
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
