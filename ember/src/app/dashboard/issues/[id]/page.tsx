'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, StatusBadge, Button, Input, Textarea, Badge } from '@/components/ui'
import type { IssueWithOwner, IssueStatus, Profile } from '@/types/database'

// IDS Workflow steps
const IDS_STEPS: { status: IssueStatus; label: string; description: string }[] = [
  { status: 'open', label: 'Open', description: 'Issue has been raised' },
  { status: 'identified', label: 'Identify', description: 'Root cause identified' },
  { status: 'discussed', label: 'Discuss', description: 'Team has discussed solutions' },
  { status: 'solved', label: 'Solve', description: 'Solution implemented' },
]

// IDS Progress component
function IDSProgress({
  currentStatus,
  onStatusChange
}: {
  currentStatus: IssueStatus
  onStatusChange: (status: IssueStatus) => void
}) {
  const stepIndex = IDS_STEPS.findIndex(s => s.status === currentStatus)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {IDS_STEPS.map((step, index) => {
          const isCompleted = index < stepIndex
          const isCurrent = step.status === currentStatus
          const isClickable = index <= stepIndex + 1 && step.status !== 'solved'

          return (
            <div key={step.status} className="flex-1 relative">
              {/* Connector line */}
              {index > 0 && (
                <div
                  className={`absolute left-0 top-4 w-full h-0.5 -translate-x-1/2 ${
                    isCompleted ? 'bg-success' : 'bg-muted'
                  }`}
                />
              )}

              {/* Step circle and label */}
              <div className="relative flex flex-col items-center">
                <button
                  onClick={() => isClickable && onStatusChange(step.status)}
                  disabled={!isClickable}
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium z-10
                    transition-all
                    ${isCompleted
                      ? 'bg-success text-white'
                      : isCurrent
                        ? 'bg-ember-600 text-white ring-4 ring-ember-100'
                        : 'bg-muted text-muted-foreground'
                    }
                    ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-ember-200' : 'cursor-default'}
                  `}
                >
                  {isCompleted ? '✓' : index + 1}
                </button>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isCurrent ? 'text-ember-600' : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Current step description */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {IDS_STEPS.find(s => s.status === currentStatus)?.description}
        </p>
      </div>
    </div>
  )
}

// Priority selector
function PrioritySelector({
  value,
  onChange
}: {
  value: number
  onChange: (priority: number) => void
}) {
  const priorities = [
    { value: 0, label: 'None', color: 'bg-muted' },
    { value: 1, label: 'Low', color: 'bg-blue-100 text-blue-700' },
    { value: 2, label: 'Medium', color: 'bg-amber-100 text-amber-700' },
    { value: 3, label: 'High', color: 'bg-red-100 text-red-700' },
  ]

  return (
    <div className="flex gap-2">
      {priorities.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`
            px-3 py-1.5 text-sm rounded-lg transition-all
            ${value === p.value
              ? `${p.color} ring-2 ring-offset-1 ring-current`
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }
          `}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function IssueDetailPage({ params }: PageProps) {
  const router = useRouter()
  const [issue, setIssue] = useState<IssueWithOwner | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issueId, setIssueId] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<IssueStatus>('open')
  const [priority, setPriority] = useState(0)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [resolution, setResolution] = useState('')

  // Resolve params and fetch data
  useEffect(() => {
    params.then(p => setIssueId(p.id))
  }, [params])

  useEffect(() => {
    if (!issueId) return

    async function fetchData() {
      try {
        const [issueRes, profilesRes] = await Promise.all([
          fetch(`/api/eos/issues/${issueId}`),
          fetch('/api/profiles')
        ])

        if (!issueRes.ok) {
          throw new Error('Issue not found')
        }

        const issueData = await issueRes.json()
        setIssue(issueData)

        // Initialize form state
        setTitle(issueData.title)
        setDescription(issueData.description || '')
        setStatus(issueData.status)
        setPriority(issueData.priority)
        setOwnerId(issueData.owner_id)
        setResolution(issueData.resolution || '')

        if (profilesRes.ok) {
          const profilesData = await profilesRes.json()
          setProfiles(profilesData)
        }
      } catch {
        setError('Failed to load issue')
      }
    }

    fetchData()
  }, [issueId])

  const handleStatusChange = async (newStatus: IssueStatus) => {
    if (!issueId) return

    const previousStatus = status
    setStatus(newStatus)

    try {
      const res = await fetch(`/api/eos/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        throw new Error('Failed to update status')
      }

      const updated = await res.json()
      setIssue({ ...issue!, ...updated })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
      setStatus(previousStatus)
    }
  }

  const handleSave = async () => {
    if (!issueId) return

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          status,
          priority,
          owner_id: ownerId,
          resolution: resolution || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      const updated = await res.json()
      setIssue({ ...issue!, ...updated })
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!issueId) return
    if (!confirm('Are you sure you want to delete this issue?')) return

    setIsDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/issues/${issueId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete')
      }

      router.push('/dashboard/issues')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setIsDeleting(false)
    }
  }

  const handleDrop = async () => {
    if (!issueId) return
    if (!confirm('Drop this issue? It will be marked as dropped.')) return

    try {
      const res = await fetch(`/api/eos/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dropped' }),
      })

      if (!res.ok) {
        throw new Error('Failed to drop issue')
      }

      const updated = await res.json()
      setIssue({ ...issue!, ...updated })
      setStatus('dropped')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to drop issue')
    }
  }

  if (!issue) {
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

  const isDropped = status === 'dropped'
  const isSolved = status === 'solved'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/issues" className="hover:text-foreground">
          Issues
        </Link>
        <span>/</span>
        <span className="text-foreground truncate max-w-[200px]">{issue.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {isEditing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold"
              placeholder="Issue title"
            />
          ) : (
            <h1 className="text-2xl font-bold text-foreground">{issue.title}</h1>
          )}
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status={status} />
            {priority > 0 && (
              <Badge variant={priority >= 3 ? 'danger' : priority >= 2 ? 'warning' : 'info'}>
                P{priority}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
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

      {/* IDS Workflow */}
      {!isDropped && (
        <Card>
          <CardHeader>
            <CardTitle>IDS Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <IDSProgress
              currentStatus={status}
              onStatusChange={handleStatusChange}
            />
          </CardContent>
        </Card>
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
                {issue.owner?.name || issue.owner?.email || 'Unassigned'}
              </p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">
              Priority
            </label>
            {isEditing ? (
              <PrioritySelector value={priority} onChange={setPriority} />
            ) : (
              <p className="text-foreground">
                {priority === 0 ? 'None' : priority === 1 ? 'Low' : priority === 2 ? 'Medium' : 'High'}
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
                placeholder="Describe the issue..."
              />
            ) : (
              <p className="text-foreground whitespace-pre-wrap">
                {issue.description || <span className="italic text-muted-foreground">No description</span>}
              </p>
            )}
          </div>

          {/* Source */}
          {issue.source !== 'manual' && (
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Source
              </label>
              <p className="text-foreground capitalize">{issue.source}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolution (show when discussed or solved) */}
      {(status === 'discussed' || status === 'solved' || isEditing) && (
        <Card>
          <CardHeader>
            <CardTitle>Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={4}
                placeholder="Document the solution or resolution..."
              />
            ) : (
              <p className="text-foreground whitespace-pre-wrap">
                {issue.resolution || <span className="italic text-muted-foreground">No resolution documented yet</span>}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!isDropped && !isSolved && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Not relevant anymore?
                </p>
              </div>
              <Button variant="outline" onClick={handleDrop}>
                Drop Issue
              </Button>
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
              Once you delete this issue, there is no going back.
            </p>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Delete Issue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <div className="text-xs text-muted-foreground text-center space-x-4">
        <span>Created: {new Date(issue.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(issue.updated_at).toLocaleString()}</span>
      </div>
    </div>
  )
}
