'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, StatusBadge, Button, Input, Textarea } from '@/components/ui'
import type { RockWithOwner, RockStatus, RockMilestone, Profile } from '@/types/database'
import { v4 as uuidv4 } from 'uuid'

// Status options for the dropdown
const statusOptions: { value: RockStatus; label: string }[] = [
  { value: 'on_track', label: 'On Track' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'off_track', label: 'Off Track' },
  { value: 'complete', label: 'Complete' },
]

// Milestone editor component
function MilestoneEditor({
  milestones,
  onChange
}: {
  milestones: RockMilestone[]
  onChange: (milestones: RockMilestone[]) => void
}) {
  const handleToggle = (id: string) => {
    const updated = milestones.map(m =>
      m.id === id
        ? { ...m, completed: !m.completed, completed_at: !m.completed ? new Date().toISOString() : undefined }
        : m
    )
    onChange(updated)
  }

  const handleAdd = () => {
    const newMilestone: RockMilestone = {
      id: uuidv4(),
      title: '',
      completed: false,
    }
    onChange([...milestones, newMilestone])
  }

  const handleUpdate = (id: string, field: keyof RockMilestone, value: string | boolean) => {
    const updated = milestones.map(m =>
      m.id === id ? { ...m, [field]: value } : m
    )
    onChange(updated)
  }

  const handleRemove = (id: string) => {
    onChange(milestones.filter(m => m.id !== id))
  }

  return (
    <div className="space-y-3">
      {milestones.map((milestone) => (
        <div key={milestone.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <input
            type="checkbox"
            checked={milestone.completed}
            onChange={() => handleToggle(milestone.id)}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={milestone.title}
              onChange={(e) => handleUpdate(milestone.id, 'title', e.target.value)}
              placeholder="Milestone title"
              className={`
                w-full text-sm bg-transparent border-none focus:outline-none
                ${milestone.completed ? 'line-through text-muted-foreground' : 'text-foreground'}
              `}
            />
            <input
              type="date"
              value={milestone.due_date || ''}
              onChange={(e) => handleUpdate(milestone.id, 'due_date', e.target.value)}
              className="text-xs text-muted-foreground bg-transparent border rounded px-2 py-1"
            />
          </div>
          <button
            onClick={() => handleRemove(milestone.id)}
            className="text-muted-foreground hover:text-danger text-sm"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        onClick={handleAdd}
        className="text-sm text-ember-600 hover:text-ember-700"
      >
        + Add Milestone
      </button>
    </div>
  )
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function RockDetailPage({ params }: PageProps) {
  const router = useRouter()
  const [rock, setRock] = useState<RockWithOwner | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rockId, setRockId] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<RockStatus>('on_track')
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [milestones, setMilestones] = useState<RockMilestone[]>([])
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')

  // Resolve params and fetch data
  useEffect(() => {
    params.then(p => setRockId(p.id))
  }, [params])

  useEffect(() => {
    if (!rockId) return

    async function fetchData() {
      try {
        const [rockRes, profilesRes] = await Promise.all([
          fetch(`/api/eos/rocks/${rockId}`),
          fetch('/api/profiles')
        ])

        if (!rockRes.ok) {
          throw new Error('Rock not found')
        }

        const rockData = await rockRes.json()
        setRock(rockData)

        // Initialize form state
        setTitle(rockData.title)
        setDescription(rockData.description || '')
        setStatus(rockData.status)
        setOwnerId(rockData.owner_id)
        setMilestones(rockData.milestones || [])
        setNotes(rockData.notes || '')
        setDueDate(rockData.due_date || '')

        if (profilesRes.ok) {
          const profilesData = await profilesRes.json()
          setProfiles(profilesData)
        }
      } catch {
        setError('Failed to load rock')
      }
    }

    fetchData()
  }, [rockId])

  const handleSave = async () => {
    if (!rockId) return

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/rocks/${rockId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          status,
          owner_id: ownerId,
          milestones,
          notes: notes || null,
          due_date: dueDate || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      const updated = await res.json()
      setRock({ ...rock!, ...updated })
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!rockId) return
    if (!confirm('Are you sure you want to delete this rock?')) return

    setIsDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/rocks/${rockId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete')
      }

      router.push('/dashboard/rocks')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setIsDeleting(false)
    }
  }

  const handleStatusChange = async (newStatus: RockStatus) => {
    if (!rockId) return

    setStatus(newStatus)

    try {
      const res = await fetch(`/api/eos/rocks/${rockId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        throw new Error('Failed to update status')
      }

      const updated = await res.json()
      setRock({ ...rock!, ...updated })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
      // Revert on error
      if (rock) setStatus(rock.status)
    }
  }

  if (!rock) {
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

  const completedMilestones = milestones.filter(m => m.completed).length
  const progressPercent = milestones.length > 0
    ? Math.round((completedMilestones / milestones.length) * 100)
    : 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/rocks" className="hover:text-foreground">
          Rocks
        </Link>
        <span>/</span>
        <span className="text-foreground">{rock.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {isEditing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold"
              placeholder="Rock title"
            />
          ) : (
            <h1 className="text-2xl font-bold text-foreground">{rock.title}</h1>
          )}
          <p className="text-muted-foreground mt-1">{rock.quarter}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as RockStatus)}
                className="h-10 px-3 text-sm rounded-lg border border-border bg-background"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
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

      {/* Progress bar */}
      {milestones.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedMilestones} of {milestones.length} milestones ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-ember-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
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
                {rock.owner?.name || rock.owner?.email || 'Unassigned'}
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
                placeholder="Rock description..."
              />
            ) : (
              <p className="text-foreground">
                {rock.description || <span className="italic text-muted-foreground">No description</span>}
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
                className="h-10 px-3 text-sm rounded-lg border border-border bg-background"
              />
            ) : (
              <p className="text-foreground">
                {rock.due_date
                  ? new Date(rock.due_date).toLocaleDateString()
                  : <span className="italic text-muted-foreground">No due date</span>
                }
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">
              Status
            </label>
            <StatusBadge status={status} />
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <MilestoneEditor
              milestones={milestones}
              onChange={setMilestones}
            />
          ) : milestones.length > 0 ? (
            <div className="space-y-2">
              {milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    milestone.completed ? 'bg-success/10' : 'bg-muted/50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    milestone.completed
                      ? 'bg-success border-success text-white'
                      : 'border-muted-foreground'
                  }`}>
                    {milestone.completed && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={milestone.completed ? 'line-through text-muted-foreground' : 'text-foreground'}>
                      {milestone.title}
                    </p>
                    {milestone.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Due: {new Date(milestone.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground italic">No milestones defined</p>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add notes about this rock..."
            />
          ) : (
            <p className="text-foreground whitespace-pre-wrap">
              {rock.notes || <span className="italic text-muted-foreground">No notes</span>}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      {isEditing && (
        <Card className="border-danger/50">
          <CardHeader>
            <CardTitle className="text-danger">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete this rock, there is no going back.
            </p>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Delete Rock
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <div className="text-xs text-muted-foreground text-center space-x-4">
        <span>Created: {new Date(rock.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(rock.updated_at).toLocaleString()}</span>
        {rock.completed_at && (
          <span>Completed: {new Date(rock.completed_at).toLocaleString()}</span>
        )}
      </div>
    </div>
  )
}
