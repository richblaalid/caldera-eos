'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Textarea } from '@/components/ui'
import type { Profile } from '@/types/database'

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
          type="button"
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

export default function NewIssuePage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(0)
  const [ownerId, setOwnerId] = useState<string | null>(null)

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
      const res = await fetch('/api/eos/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          owner_id: ownerId,
          status: 'open',
          source: 'manual',
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create issue')
      }

      const issue = await res.json()
      router.push(`/dashboard/issues/${issue.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/issues" className="hover:text-foreground">
          Issues
        </Link>
        <span>/</span>
        <span className="text-foreground">New Issue</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Issue</h1>
          <p className="text-muted-foreground mt-1">
            Identify an issue to be discussed and solved
          </p>
        </div>

        {error && (
          <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Issue Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's the issue?"
              required
            />

            <Textarea
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide more context about this issue..."
              rows={4}
            />

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Priority
              </label>
              <PrioritySelector value={priority} onChange={setPriority} />
            </div>

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
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/issues')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create Issue
          </Button>
        </div>
      </form>
    </div>
  )
}
