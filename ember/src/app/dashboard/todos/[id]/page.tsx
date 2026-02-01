'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Textarea, Badge } from '@/components/ui'
import type { TodoWithOwner, Profile } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function TodoDetailPage({ params }: PageProps) {
  const router = useRouter()
  const [todo, setTodo] = useState<TodoWithOwner | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [todoId, setTodoId] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [ownerId, setOwnerId] = useState<string | null>(null)

  // Resolve params and fetch data
  useEffect(() => {
    params.then(p => setTodoId(p.id))
  }, [params])

  useEffect(() => {
    if (!todoId) return

    async function fetchData() {
      try {
        const [todoRes, profilesRes] = await Promise.all([
          fetch(`/api/eos/todos/${todoId}`),
          fetch('/api/profiles')
        ])

        if (!todoRes.ok) {
          throw new Error('To-do not found')
        }

        const todoData = await todoRes.json()
        setTodo(todoData)

        // Initialize form state
        setTitle(todoData.title)
        setDescription(todoData.description || '')
        setDueDate(todoData.due_date || '')
        setOwnerId(todoData.owner_id)

        if (profilesRes.ok) {
          const profilesData = await profilesRes.json()
          setProfiles(profilesData)
        }
      } catch {
        setError('Failed to load to-do')
      }
    }

    fetchData()
  }, [todoId])

  const handleToggleComplete = async () => {
    if (!todoId) return

    setIsToggling(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/todos/${todoId}`, {
        method: 'PATCH',
      })

      if (!res.ok) {
        throw new Error('Failed to toggle completion')
      }

      const updated = await res.json()
      setTodo({ ...todo!, ...updated })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle')
    } finally {
      setIsToggling(false)
    }
  }

  const handleSave = async () => {
    if (!todoId) return

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          due_date: dueDate || null,
          owner_id: ownerId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      const updated = await res.json()
      setTodo({ ...todo!, ...updated })
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!todoId) return
    if (!confirm('Are you sure you want to delete this to-do?')) return

    setIsDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/todos/${todoId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete')
      }

      router.push('/dashboard/todos')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setIsDeleting(false)
    }
  }

  if (!todo) {
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

  // Check if overdue
  const isOverdue = todo.due_date && !todo.completed && new Date(todo.due_date) < new Date()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/todos" className="hover:text-foreground">
          To-dos
        </Link>
        <span>/</span>
        <span className="text-foreground truncate max-w-[200px]">{todo.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {isEditing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold"
              placeholder="To-do title"
            />
          ) : (
            <h1 className={`text-2xl font-bold text-foreground ${todo.completed ? 'line-through opacity-60' : ''}`}>
              {todo.title}
            </h1>
          )}
          <div className="flex items-center gap-2 mt-2">
            {todo.completed ? (
              <Badge variant="success">Completed</Badge>
            ) : isOverdue ? (
              <Badge variant="danger">Overdue</Badge>
            ) : (
              <Badge variant="info">Pending</Badge>
            )}
            {todo.due_date && (
              <span className="text-sm text-muted-foreground">
                Due: {new Date(todo.due_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <Button
                variant={todo.completed ? 'outline' : 'primary'}
                onClick={handleToggleComplete}
                isLoading={isToggling}
              >
                {todo.completed ? 'Mark Incomplete' : 'Mark Complete'}
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

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Owner */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">
              Owner
            </label>
            {isEditing ? (
              <select
                value={ownerId || ''}
                onChange={(e) => setOwnerId(e.target.value || null)}
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background"
              >
                <option value="">Unassigned</option>
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name || profile.email}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-foreground">
                {todo.owner?.name || todo.owner?.email || 'Unassigned'}
              </p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">
              Due Date
            </label>
            {isEditing ? (
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background"
              />
            ) : (
              <p className={`text-foreground ${isOverdue ? 'text-danger' : ''}`}>
                {todo.due_date ? new Date(todo.due_date).toLocaleDateString() : 'No due date'}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">
              Description
            </label>
            {isEditing ? (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Add description..."
              />
            ) : (
              <p className="text-foreground whitespace-pre-wrap">
                {todo.description || <span className="italic text-muted-foreground">No description</span>}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Linked Items */}
      {(todo.rock_id || todo.issue_id || todo.meeting_id) && (
        <Card>
          <CardHeader>
            <CardTitle>Linked Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todo.rock_id && (
              <Link
                href={`/dashboard/rocks/${todo.rock_id}`}
                className="flex items-center gap-2 text-sm text-ember-600 hover:text-ember-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                View linked Rock
              </Link>
            )}
            {todo.issue_id && (
              <Link
                href={`/dashboard/issues/${todo.issue_id}`}
                className="flex items-center gap-2 text-sm text-ember-600 hover:text-ember-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View linked Issue
              </Link>
            )}
            {todo.meeting_id && (
              <Link
                href={`/dashboard/meetings/${todo.meeting_id}`}
                className="flex items-center gap-2 text-sm text-ember-600 hover:text-ember-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                View meeting
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Completion Info */}
      {todo.completed && todo.completed_at && (
        <Card className="border-success/50 bg-success/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-success font-medium">
                Completed on {new Date(todo.completed_at).toLocaleString()}
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
              Once you delete this to-do, there is no going back.
            </p>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Delete To-do
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <div className="text-xs text-muted-foreground text-center space-x-4">
        <span>Created: {new Date(todo.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(todo.updated_at).toLocaleString()}</span>
      </div>
    </div>
  )
}
