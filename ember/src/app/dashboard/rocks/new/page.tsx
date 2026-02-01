'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Textarea } from '@/components/ui'
import type { RockStatus, RockMilestone, Profile } from '@/types/database'
import { v4 as uuidv4 } from 'uuid'

// Get current quarter
function getCurrentQuarter(): string {
  const now = new Date()
  const quarter = Math.ceil((now.getMonth() + 1) / 3)
  return `Q${quarter} ${now.getFullYear()}`
}

// Milestone editor component
function MilestoneEditor({
  milestones,
  onChange
}: {
  milestones: RockMilestone[]
  onChange: (milestones: RockMilestone[]) => void
}) {
  const handleAdd = () => {
    const newMilestone: RockMilestone = {
      id: uuidv4(),
      title: '',
      completed: false,
    }
    onChange([...milestones, newMilestone])
  }

  const handleUpdate = (id: string, field: keyof RockMilestone, value: string) => {
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
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={milestone.title}
              onChange={(e) => handleUpdate(milestone.id, 'title', e.target.value)}
              placeholder="Milestone title"
              className="w-full text-sm bg-transparent border-none focus:outline-none text-foreground"
            />
            <input
              type="date"
              value={milestone.due_date || ''}
              onChange={(e) => handleUpdate(milestone.id, 'due_date', e.target.value)}
              className="text-xs text-muted-foreground bg-transparent border rounded px-2 py-1"
            />
          </div>
          <button
            type="button"
            onClick={() => handleRemove(milestone.id)}
            className="text-muted-foreground hover:text-danger text-sm"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        className="text-sm text-ember-600 hover:text-ember-700"
      >
        + Add Milestone
      </button>
    </div>
  )
}

export default function NewRockPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [quarter, setQuarter] = useState(getCurrentQuarter())
  const [status, setStatus] = useState<RockStatus>('on_track')
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [milestones, setMilestones] = useState<RockMilestone[]>([])
  const [dueDate, setDueDate] = useState('')

  // Fetch profiles
  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch('/api/profiles')
        if (res.ok) {
          const data = await res.json()
          setProfiles(data)
        }
      } catch {
        console.error('Failed to fetch profiles')
      }
    }
    fetchProfiles()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/eos/rocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          quarter,
          status,
          owner_id: ownerId,
          milestones: milestones.filter(m => m.title.trim()),
          due_date: dueDate || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create rock')
      }

      const rock = await res.json()
      router.push(`/dashboard/rocks/${rock.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rock')
      setIsSubmitting(false)
    }
  }

  // Generate quarter options (current and next 3 quarters)
  const quarterOptions: string[] = []
  const now = new Date()
  for (let i = 0; i < 4; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + (i * 3), 1)
    const q = Math.ceil((date.getMonth() + 1) / 3)
    quarterOptions.push(`Q${q} ${date.getFullYear()}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/rocks" className="hover:text-foreground">
          Rocks
        </Link>
        <span>/</span>
        <span className="text-foreground">New Rock</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create New Rock</h1>
          <p className="text-muted-foreground mt-1">
            Define a new quarterly priority
          </p>
        </div>

        {error && (
          <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Main form */}
        <Card>
          <CardHeader>
            <CardTitle>Rock Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's the rock?"
              required
            />

            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the rock in more detail..."
              rows={3}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Quarter
                </label>
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background"
                >
                  {quarterOptions.map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RockStatus)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background"
                >
                  <option value="on_track">On Track</option>
                  <option value="at_risk">At Risk</option>
                  <option value="off_track">Off Track</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Owner
                </label>
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
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Milestones */}
        <Card>
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <MilestoneEditor
              milestones={milestones}
              onChange={setMilestones}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/rocks')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create Rock
          </Button>
        </div>
      </form>
    </div>
  )
}
