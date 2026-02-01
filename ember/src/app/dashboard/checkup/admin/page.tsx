'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui'
import type { CheckupPeriod } from '@/types/database'

export default function CheckupAdminPage() {
  const [periods, setPeriods] = useState<CheckupPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    is_active: true,
  })

  // Load periods
  useEffect(() => {
    async function loadPeriods() {
      try {
        const res = await fetch('/api/eos/checkup/periods')
        const data = await res.json()
        setPeriods(data)
      } catch (err) {
        console.error('Error loading periods:', err)
        setError('Failed to load periods')
      } finally {
        setLoading(false)
      }
    }
    loadPeriods()
  }, [])

  // Generate default period name
  useEffect(() => {
    if (showForm && !formData.name) {
      const now = new Date()
      const quarter = Math.ceil((now.getMonth() + 1) / 3)
      const year = now.getFullYear()
      const isBaseline = periods.length === 0

      setFormData(prev => ({
        ...prev,
        name: isBaseline ? `Q${quarter} ${year} Baseline` : `Q${quarter} ${year} Assessment`,
      }))
    }
  }, [showForm, periods.length, formData.name])

  // Create new period
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/eos/checkup/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create period')
      }

      const newPeriod = await res.json()
      setPeriods(prev => [newPeriod, ...prev])
      setShowForm(false)
      setFormData({ name: '', start_date: '', end_date: '', is_active: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create period')
    } finally {
      setSaving(false)
    }
  }

  // Toggle active status
  const toggleActive = async (period: CheckupPeriod) => {
    try {
      const res = await fetch(`/api/eos/checkup/periods`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: period.id,
          is_active: !period.is_active,
        }),
      })

      if (res.ok) {
        setPeriods(prev =>
          prev.map(p => ({
            ...p,
            is_active: p.id === period.id ? !p.is_active : (period.is_active ? p.is_active : false),
          }))
        )
      }
    } catch (err) {
      console.error('Error toggling active:', err)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/checkup"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Checkup
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">Manage Assessment Periods</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage checkup assessment periods
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-ember-500 text-white rounded-lg font-medium hover:bg-ember-600 transition-colors"
        >
          New Period
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Create New Period</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Period Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Q1 2025 Baseline"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ember-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ember-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ember-500"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-ember-500 border-border rounded focus:ring-ember-500"
                />
                <span className="text-sm text-foreground">Set as active period</span>
              </label>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setFormData({ name: '', start_date: '', end_date: '', is_active: true })
                    setError(null)
                  }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-ember-500 text-white rounded-lg font-medium hover:bg-ember-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Period'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Periods List */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Assessment Periods</h2>
          {periods.length > 0 ? (
            <div className="space-y-3">
              {periods.map(period => (
                <div
                  key={period.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {period.is_active && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    )}
                    <div>
                      <Link
                        href={`/dashboard/checkup/${period.id}`}
                        className="font-medium text-foreground hover:text-ember-600 dark:hover:text-ember-400"
                      >
                        {period.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {new Date(period.start_date).toLocaleDateString()} -{' '}
                        {new Date(period.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(period)}
                      className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                        period.is_active
                          ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20'
                          : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20'
                      }`}
                    >
                      {period.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <Link
                      href={`/dashboard/checkup/${period.id}`}
                      className="px-3 py-1 text-sm text-ember-600 hover:bg-ember-50 dark:hover:bg-ember-950/20 rounded-lg transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No assessment periods created yet. Create your first one to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">About EOS Checkups</h2>
          <div className="prose prose-sm dark:prose-invert text-muted-foreground">
            <p>
              The EOS Organizational Checkup is a 20-question assessment that measures your
              organization&apos;s strength across the 6 Key Components of EOS:
            </p>
            <ul className="mt-3 space-y-1">
              <li><strong>Vision</strong> - Do you have a clear, shared vision?</li>
              <li><strong>People</strong> - Do you have the right people in the right seats?</li>
              <li><strong>Data</strong> - Do you have a pulse on your business?</li>
              <li><strong>Issues</strong> - Do you solve problems effectively?</li>
              <li><strong>Process</strong> - Are your core processes documented and followed?</li>
              <li><strong>Traction</strong> - Do you have discipline and accountability?</li>
            </ul>
            <p className="mt-3">
              Take a baseline assessment when starting EOS, then repeat quarterly to track progress.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
