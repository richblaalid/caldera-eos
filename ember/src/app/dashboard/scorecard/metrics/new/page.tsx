'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Textarea } from '@/components/ui'
import type { GoalDirection, MetricFrequency, Profile } from '@/types/database'

export default function NewMetricPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [target, setTarget] = useState('')
  const [unit, setUnit] = useState('')
  const [frequency, setFrequency] = useState<MetricFrequency>('weekly')
  const [goalDirection, setGoalDirection] = useState<GoalDirection>('above')
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

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/eos/scorecard/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          target: target ? parseFloat(target) : null,
          unit: unit.trim() || null,
          frequency,
          goal_direction: goalDirection,
          owner_id: ownerId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create metric')
      }

      router.push('/dashboard/scorecard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create metric')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/scorecard" className="hover:text-foreground">
          Scorecard
        </Link>
        <span>/</span>
        <span className="text-foreground">New Metric</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add Scorecard Metric</h1>
          <p className="text-muted-foreground mt-1">
            Define a new metric to track on your scorecard
          </p>
        </div>

        {error && (
          <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Metric Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Metric Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Weekly Revenue, New Leads, Customer Satisfaction"
              required
            />

            <Textarea
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this metric measure?"
              rows={2}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Target Value"
                type="number"
                step="any"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g., 100"
              />

              <Input
                label="Unit (optional)"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g., $, %, pts"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Goal Direction
                </label>
                <select
                  value={goalDirection}
                  onChange={(e) => setGoalDirection(e.target.value as GoalDirection)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background"
                >
                  <option value="above">Above target is good (≥)</option>
                  <option value="below">Below target is good (≤)</option>
                  <option value="equal">Hit target exactly (=)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as MetricFrequency)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
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
            onClick={() => router.push('/dashboard/scorecard')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create Metric
          </Button>
        </div>
      </form>
    </div>
  )
}
