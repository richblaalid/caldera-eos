'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, Badge } from '@/components/ui'
import type { TodoWithOwner } from '@/types/database'

// Helper to check if a date is overdue
function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  return due < today
}

// Helper to format due date display
function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return ''
  const due = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const dueNormalized = new Date(due)
  dueNormalized.setHours(0, 0, 0, 0)

  if (dueNormalized.getTime() === today.getTime()) {
    return 'Today'
  }
  if (dueNormalized.getTime() === tomorrow.getTime()) {
    return 'Tomorrow'
  }

  return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Due date badge component
function DueDateBadge({ dueDate, completed }: { dueDate: string | null; completed: boolean }) {
  if (!dueDate) return null

  const overdue = !completed && isOverdue(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const isToday = due.getTime() === today.getTime()

  let variant: 'danger' | 'warning' | 'info' | 'success' = 'info'
  if (completed) {
    variant = 'success'
  } else if (overdue) {
    variant = 'danger'
  } else if (isToday) {
    variant = 'warning'
  }

  return (
    <Badge variant={variant}>
      {formatDueDate(dueDate)}
    </Badge>
  )
}

// Todo item component
function TodoItem({ todo, onToggle }: { todo: TodoWithOwner; onToggle: (id: string) => void }) {
  const [isToggling, setIsToggling] = useState(false)

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsToggling(true)
    await onToggle(todo.id)
    setIsToggling(false)
  }

  return (
    <Link href={`/dashboard/todos/${todo.id}`}>
      <Card className={`hover:shadow-md transition-shadow cursor-pointer ${todo.completed ? 'opacity-60' : ''}`}>
        <CardContent className="py-4">
          <div className="flex items-start gap-4">
            {/* Checkbox */}
            <button
              onClick={handleToggle}
              disabled={isToggling}
              className={`
                mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0
                flex items-center justify-center
                transition-colors
                ${todo.completed
                  ? 'bg-success border-success text-white'
                  : 'border-border hover:border-ember-500'
                }
                ${isToggling ? 'opacity-50' : ''}
              `}
            >
              {todo.completed && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`font-semibold text-foreground ${todo.completed ? 'line-through' : ''}`}>
                  {todo.title}
                </h3>
                <DueDateBadge dueDate={todo.due_date} completed={todo.completed} />
              </div>
              {todo.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {todo.description}
                </p>
              )}

              <div className="mt-3 flex items-center gap-4 text-sm">
                {todo.owner && (
                  <span className="text-muted-foreground">
                    {todo.owner.name || todo.owner.email}
                  </span>
                )}
                {todo.rock_id && (
                  <Badge variant="outline" className="text-xs">
                    Linked to Rock
                  </Badge>
                )}
                {todo.issue_id && (
                  <Badge variant="outline" className="text-xs">
                    Linked to Issue
                  </Badge>
                )}
                {todo.meeting_id && (
                  <Badge variant="outline" className="text-xs">
                    From Meeting
                  </Badge>
                )}
              </div>
            </div>

            {/* Completed indicator */}
            {todo.completed && todo.completed_at && (
              <div className="text-xs text-muted-foreground">
                Completed {new Date(todo.completed_at).toLocaleDateString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

interface TodoListClientProps {
  todos: TodoWithOwner[]
}

export function TodoListClient({ todos: initialTodos }: TodoListClientProps) {
  const router = useRouter()
  const [todos, setTodos] = useState(initialTodos)
  const [error, setError] = useState<string | null>(null)

  // Sync local state when props change (e.g., after router.refresh())
  useEffect(() => {
    setTodos(initialTodos)
  }, [initialTodos])

  const handleToggle = async (id: string) => {
    setError(null)

    // Optimistic update
    setTodos(prev => prev.map(t =>
      t.id === id
        ? {
            ...t,
            completed: !t.completed,
            completed_at: t.completed ? null : new Date().toISOString()
          }
        : t
    ))

    try {
      const res = await fetch(`/api/eos/todos/${id}`, {
        method: 'PATCH',
      })

      if (!res.ok) {
        throw new Error('Failed to toggle todo')
      }

      // Refresh the page data
      router.refresh()
    } catch (err) {
      // Revert optimistic update
      setTodos(prev => prev.map(t =>
        t.id === id
          ? {
              ...t,
              completed: !t.completed,
              completed_at: t.completed ? new Date().toISOString() : null
            }
          : t
      ))
      setError(err instanceof Error ? err.message : 'Failed to toggle todo')
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm">
          {error}
        </div>
      )}
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} />
      ))}
    </div>
  )
}
