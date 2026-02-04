'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Textarea, Badge } from '@/components/ui'
import type { ScorecardMetric, GoalDirection, MetricFrequency, Profile, ScorecardEntry } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function MetricDetailPage({ params }: PageProps) {
  const router = useRouter()
  const [metricId, setMetricId] = useState<string | null>(null)
  const [metric, setMetric] = useState<ScorecardMetric | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [recentEntries, setRecentEntries] = useState<ScorecardEntry[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [target, setTarget] = useState('')
  const [unit, setUnit] = useState('')
  const [frequency, setFrequency] = useState<MetricFrequency>('weekly')
  const [goalDirection, setGoalDirection] = useState<GoalDirection>('above')
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(true)

  // Resolve params
  useEffect(() => {
    params.then((p) => setMetricId(p.id))
  }, [params])

  // Fetch data
  useEffect(() => {
    if (!metricId) return

    async function fetchData() {
      try {
        const [metricRes, profilesRes, entriesRes] = await Promise.all([
          fetch(`/api/eos/scorecard/metrics/${metricId}`),
          fetch('/api/profiles'),
          fetch(`/api/eos/scorecard/entries?metric_id=${metricId}&limit=10`),
        ])

        if (!metricRes.ok) {
          throw new Error('Metric not found')
        }

        const metricData = await metricRes.json()
        setMetric(metricData)

        // Initialize form state
        setName(metricData.name || '')
        setDescription(metricData.description || '')
        setTarget(metricData.target?.toString() || '')
        setUnit(metricData.unit || '')
        setFrequency(metricData.frequency || 'weekly')
        setGoalDirection(metricData.goal_direction || 'above')
        setOwnerId(metricData.owner_id || null)
        setIsActive(metricData.is_active !== false)

        if (profilesRes.ok) {
          const profilesData = await profilesRes.json()
          setProfiles(profilesData)
        }

        if (entriesRes.ok) {
          const entriesData = await entriesRes.json()
          setRecentEntries(entriesData)
        }
      } catch {
        setError('Failed to load metric')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [metricId])

  const handleSave = async () => {
    if (!metricId || !name.trim()) {
      setError('Name is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/scorecard/metrics/${metricId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          target: target ? parseFloat(target) : null,
          unit: unit.trim() || null,
          frequency,
          goal_direction: goalDirection,
          owner_id: ownerId,
          is_active: isActive,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update metric')
      }

      const updated = await res.json()
      setMetric(updated)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update metric')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!metricId) return
    if (!confirm('Are you sure you want to delete this metric? This will also delete all historical entries.')) {
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/eos/scorecard/metrics/${metricId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete metric')
      }

      router.push('/dashboard/scorecard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete metric')
      setIsDeleting(false)
    }
  }

  const cancelEdit = () => {
    if (metric) {
      // Reset form to original values
      setName(metric.name || '')
      setDescription(metric.description || '')
      setTarget(metric.target?.toString() || '')
      setUnit(metric.unit || '')
      setFrequency(metric.frequency || 'weekly')
      setGoalDirection(metric.goal_direction || 'above')
      setOwnerId(metric.owner_id || null)
      setIsActive(metric.is_active !== false)
    }
    setIsEditing(false)
    setError(null)
  }

  // Get owner name
  const ownerName = ownerId
    ? profiles.find((p) => p.id === ownerId)?.name ||
      profiles.find((p) => p.id === ownerId)?.email ||
      'Unknown'
    : 'Unassigned'

  // Format entry value for display
  const formatValue = (value: number | null, metricUnit: string | null) => {
    if (value === null) return '-'
    if (metricUnit === '$') return `$${value.toLocaleString()}`
    if (metricUnit === '%') return `${value}%`
    return metricUnit ? `${value} ${metricUnit}` : value.toString()
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!metric) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-danger">{error || 'Metric not found'}</p>
            <Link href="/dashboard/scorecard" className="text-ember-600 hover:text-ember-700 mt-4 inline-block">
              Back to Scorecard
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/scorecard" className="hover:text-foreground">
          Scorecard
        </Link>
        <span>/</span>
        <span className="text-foreground truncate max-w-[200px]">{metric.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {isEditing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-2xl font-bold"
              placeholder="Metric name"
            />
          ) : (
            <h1 className="text-2xl font-bold text-foreground">{metric.name}</h1>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={metric.frequency === 'weekly' ? 'info' : 'default'}>
              {metric.frequency === 'weekly' ? 'Weekly' : 'Monthly'}
            </Badge>
            {!metric.is_active && <Badge variant="default">Inactive</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>
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
        <div className="p-4 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>
      )}

      {/* Metric Details */}
      <Card>
        <CardHeader>
          <CardTitle>Metric Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
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
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name || profile.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="isActive" className="text-sm text-foreground">
                  Active (show on scorecard)
                </label>
              </div>
            </>
          ) : (
            <>
              {metric.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">
                    Description
                  </label>
                  <p className="text-foreground">{metric.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">
                    Target
                  </label>
                  <p className="text-foreground">
                    {metric.target !== null ? formatValue(metric.target, metric.unit) : 'Not set'}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">
                    Goal Direction
                  </label>
                  <p className="text-foreground">
                    {metric.goal_direction === 'above' && 'Above target is good (≥)'}
                    {metric.goal_direction === 'below' && 'Below target is good (≤)'}
                    {metric.goal_direction === 'equal' && 'Hit target exactly (=)'}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">
                  Owner
                </label>
                <p className="text-foreground">{ownerName}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Entries */}
      {recentEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentEntries.map((entry) => {
                const isOnTarget =
                  metric.target !== null &&
                  entry.value !== null &&
                  ((metric.goal_direction === 'above' && entry.value >= metric.target) ||
                    (metric.goal_direction === 'below' && entry.value <= metric.target) ||
                    (metric.goal_direction === 'equal' && entry.value === metric.target))

                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <span className="text-sm text-muted-foreground">
                      {new Date(entry.week_of).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span
                      className={`font-medium ${
                        metric.target !== null
                          ? isOnTarget
                            ? 'text-success'
                            : 'text-danger'
                          : 'text-foreground'
                      }`}
                    >
                      {formatValue(entry.value, metric.unit)}
                    </span>
                  </div>
                )
              })}
            </div>
            <Link
              href="/dashboard/scorecard/entry"
              className="text-sm text-ember-600 hover:text-ember-700 mt-3 inline-block"
            >
              Enter new data →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      {isEditing && (
        <Card className="border-danger/50">
          <CardHeader>
            <CardTitle className="text-danger">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Deleting this metric will also remove all historical entries. This action cannot be undone.
            </p>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Delete Metric
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <div className="text-xs text-muted-foreground text-center space-x-4">
        <span>Created: {new Date(metric.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(metric.updated_at).toLocaleString()}</span>
      </div>
    </div>
  )
}
