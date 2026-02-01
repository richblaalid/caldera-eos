'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Textarea, Select } from '@/components/ui'
import type { VTO, CoreValue, OneYearGoal, AccountabilityRole, AccountabilitySeat } from '@/types/database'
import { v4 as uuidv4 } from 'uuid'

const SEAT_OPTIONS: { value: AccountabilitySeat; label: string }[] = [
  { value: 'visionary', label: 'Visionary' },
  { value: 'integrator', label: 'Integrator' },
  { value: 'sales', label: 'Sales' },
  { value: 'operations', label: 'Operations' },
  { value: 'finance', label: 'Finance' },
  { value: 'other', label: 'Other' },
]

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Core Value Editor
function CoreValueEditor({
  value,
  onChange,
  onRemove,
}: {
  value: CoreValue
  onChange: (value: CoreValue) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-start gap-4 p-4 border rounded-lg">
      <div className="flex-1 space-y-3">
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Value name"
          className="font-semibold"
        />
        <Textarea
          value={value.definition}
          onChange={(e) => onChange({ ...value, definition: e.target.value })}
          placeholder="Definition - what does this value mean?"
          rows={2}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.hire_fire}
            onChange={(e) => onChange({ ...value, hire_fire: e.target.checked })}
            className="rounded border-border"
          />
          <span>We hire/fire for this</span>
        </label>
      </div>
      <Button variant="ghost" size="sm" onClick={onRemove}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Button>
    </div>
  )
}

// Goal Editor
function GoalEditor({
  goal,
  onChange,
  onRemove,
}: {
  goal: OneYearGoal
  onChange: (goal: OneYearGoal) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={goal.completed}
        onChange={(e) => onChange({ ...goal, completed: e.target.checked })}
        className="rounded border-border"
      />
      <Input
        value={goal.description}
        onChange={(e) => onChange({ ...goal, description: e.target.value })}
        placeholder="Goal description"
        className={goal.completed ? 'line-through text-muted-foreground' : ''}
      />
      <Button variant="ghost" size="sm" onClick={onRemove}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Button>
    </div>
  )
}

// Accountability Role Editor
function AccountabilityRoleEditor({
  role,
  onChange,
  onRemove,
}: {
  role: AccountabilityRole
  onChange: (role: AccountabilityRole) => void
  onRemove: () => void
}) {
  const [newLMA, setNewLMA] = useState('')

  const addLMA = () => {
    if (newLMA.trim()) {
      onChange({ ...role, lma: [...role.lma, newLMA.trim()] })
      setNewLMA('')
    }
  }

  const removeLMA = (index: number) => {
    onChange({ ...role, lma: role.lma.filter((_, i) => i !== index) })
  }

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Seat"
            value={role.seat}
            onChange={(e) => onChange({ ...role, seat: e.target.value as AccountabilitySeat })}
            options={SEAT_OPTIONS}
          />
          <Input
            label="Title"
            value={role.title}
            onChange={(e) => onChange({ ...role, title: e.target.value })}
            placeholder="e.g., Head of Sales"
          />
          <Input
            label="Person"
            value={role.owner_name || ''}
            onChange={(e) => onChange({ ...role, owner_name: e.target.value })}
            placeholder="Name"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove} className="mt-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>

      {/* LMA (Lead, Manage, Accountability) */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          LMA (Lead, Manage, Accountability)
        </label>
        <div className="space-y-2">
          {role.lma.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">•</span>
              <span className="flex-1 text-sm">{item}</span>
              <button
                type="button"
                onClick={() => removeLMA(index)}
                className="text-muted-foreground hover:text-danger"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Input
            value={newLMA}
            onChange={(e) => setNewLMA(e.target.value)}
            placeholder="Add responsibility..."
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLMA())}
          />
          <Button variant="outline" size="sm" onClick={addLMA} type="button">
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function VTOEditPage() {
  const router = useRouter()
  const [vto, setVTO] = useState<VTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Fetch VTO on mount
  useEffect(() => {
    async function fetchVTO() {
      try {
        const response = await fetch('/api/eos/vto')
        if (response.ok) {
          const data = await response.json()
          setVTO(data)
        } else if (response.status === 404) {
          // Create empty VTO structure
          setVTO({
            id: '',
            version: 0,
            core_values: [],
            core_focus: { purpose: '', niche: '' },
            ten_year_target: { goal: '', target_date: '' },
            marketing_strategy: { target_market: {}, three_uniques: [] },
            three_year_picture: { target_date: '', measurables: [], what_does_it_look_like: [] },
            one_year_plan: { target_date: '', measurables: [], goals: [] },
            quarterly_rocks: [],
            issues_list: [],
            accountability_chart: [],
            created_at: '',
            updated_at: '',
          })
        } else {
          throw new Error('Failed to fetch V/TO')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load V/TO')
      } finally {
        setLoading(false)
      }
    }
    fetchVTO()
  }, [])

  // Auto-save with debounce
  const debouncedVTO = useDebounce(vto, 1500)

  const saveVTO = useCallback(async (data: VTO) => {
    setSaving(true)
    try {
      const response = await fetch('/api/eos/vto', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to save')
      const saved = await response.json()
      setVTO(saved)
      setLastSaved(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    if (debouncedVTO && debouncedVTO.id !== '') {
      saveVTO(debouncedVTO)
    }
  }, [debouncedVTO, saveVTO])

  // Helper functions
  const addCoreValue = () => {
    if (!vto) return
    const newValue: CoreValue = {
      id: uuidv4(),
      name: '',
      definition: '',
      hire_fire: false,
      order: vto.core_values.length,
    }
    setVTO({ ...vto, core_values: [...vto.core_values, newValue] })
  }

  const updateCoreValue = (index: number, value: CoreValue) => {
    if (!vto) return
    const updated = [...vto.core_values]
    updated[index] = value
    setVTO({ ...vto, core_values: updated })
  }

  const removeCoreValue = (index: number) => {
    if (!vto) return
    setVTO({ ...vto, core_values: vto.core_values.filter((_, i) => i !== index) })
  }

  const addGoal = () => {
    if (!vto) return
    const newGoal: OneYearGoal = {
      id: uuidv4(),
      description: '',
      completed: false,
      order: vto.one_year_plan.goals.length,
    }
    setVTO({
      ...vto,
      one_year_plan: {
        ...vto.one_year_plan,
        goals: [...vto.one_year_plan.goals, newGoal],
      },
    })
  }

  const updateGoal = (index: number, goal: OneYearGoal) => {
    if (!vto) return
    const updated = [...vto.one_year_plan.goals]
    updated[index] = goal
    setVTO({
      ...vto,
      one_year_plan: { ...vto.one_year_plan, goals: updated },
    })
  }

  const removeGoal = (index: number) => {
    if (!vto) return
    setVTO({
      ...vto,
      one_year_plan: {
        ...vto.one_year_plan,
        goals: vto.one_year_plan.goals.filter((_, i) => i !== index),
      },
    })
  }

  const addThreeUnique = () => {
    if (!vto) return
    setVTO({
      ...vto,
      marketing_strategy: {
        ...vto.marketing_strategy,
        three_uniques: [...vto.marketing_strategy.three_uniques, ''],
      },
    })
  }

  const updateThreeUnique = (index: number, value: string) => {
    if (!vto) return
    const updated = [...vto.marketing_strategy.three_uniques]
    updated[index] = value
    setVTO({
      ...vto,
      marketing_strategy: { ...vto.marketing_strategy, three_uniques: updated },
    })
  }

  const removeThreeUnique = (index: number) => {
    if (!vto) return
    setVTO({
      ...vto,
      marketing_strategy: {
        ...vto.marketing_strategy,
        three_uniques: vto.marketing_strategy.three_uniques.filter((_, i) => i !== index),
      },
    })
  }

  // Accountability Chart helpers
  const addAccountabilityRole = () => {
    if (!vto) return
    const newRole: AccountabilityRole = {
      seat: 'other',
      title: '',
      owner_name: '',
      lma: [],
    }
    setVTO({
      ...vto,
      accountability_chart: [...vto.accountability_chart, newRole],
    })
  }

  const updateAccountabilityRole = (index: number, role: AccountabilityRole) => {
    if (!vto) return
    const updated = [...vto.accountability_chart]
    updated[index] = role
    setVTO({ ...vto, accountability_chart: updated })
  }

  const removeAccountabilityRole = (index: number) => {
    if (!vto) return
    setVTO({
      ...vto,
      accountability_chart: vto.accountability_chart.filter((_, i) => i !== index),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ember-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 text-danger">
          {error}
        </div>
      </div>
    )
  }

  if (!vto) return null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit V/TO</h1>
          <p className="text-muted-foreground mt-1">
            Changes are saved automatically
          </p>
        </div>
        <div className="flex items-center gap-4">
          {saving && (
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ember-600" />
              Saving...
            </span>
          )}
          {lastSaved && !saving && (
            <span className="text-sm text-muted-foreground">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" onClick={() => router.push('/dashboard/vto')}>
            Done
          </Button>
        </div>
      </div>

      {/* Vision Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground border-b pb-2">Vision</h2>

        {/* Core Values */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Core Values</CardTitle>
            <Button variant="outline" size="sm" onClick={addCoreValue}>
              Add Value
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {vto.core_values.map((value, index) => (
              <CoreValueEditor
                key={value.id}
                value={value}
                onChange={(v) => updateCoreValue(index, v)}
                onRemove={() => removeCoreValue(index)}
              />
            ))}
            {vto.core_values.length === 0 && (
              <p className="text-muted-foreground text-sm italic">
                No core values yet. Click &quot;Add Value&quot; to start.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Core Focus */}
        <Card>
          <CardHeader>
            <CardTitle>Core Focus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Purpose / Cause / Passion
              </label>
              <Textarea
                value={vto.core_focus.purpose}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    core_focus: { ...vto.core_focus, purpose: e.target.value },
                  })
                }
                placeholder="Why does your company exist beyond making money?"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Niche
              </label>
              <Textarea
                value={vto.core_focus.niche}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    core_focus: { ...vto.core_focus, niche: e.target.value },
                  })
                }
                placeholder="What does your company do better than anyone else?"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* 10-Year Target */}
        <Card>
          <CardHeader>
            <CardTitle>10-Year Target (BHAG)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Textarea
                label="The Big Goal"
                value={vto.ten_year_target.goal}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    ten_year_target: { ...vto.ten_year_target, goal: e.target.value },
                  })
                }
                placeholder="Your 10-year vision..."
                rows={3}
              />
              <div className="space-y-4">
                <Input
                  label="Target Year"
                  value={vto.ten_year_target.target_date}
                  onChange={(e) =>
                    setVTO({
                      ...vto,
                      ten_year_target: { ...vto.ten_year_target, target_date: e.target.value },
                    })
                  }
                  placeholder="e.g., 2035"
                />
                <Input
                  label="Revenue Target"
                  value={vto.ten_year_target.revenue || ''}
                  onChange={(e) =>
                    setVTO({
                      ...vto,
                      ten_year_target: { ...vto.ten_year_target, revenue: e.target.value },
                    })
                  }
                  placeholder="e.g., $20M"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input
                label="Team Size"
                type="number"
                value={vto.ten_year_target.team_size || ''}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    ten_year_target: { ...vto.ten_year_target, team_size: parseInt(e.target.value) || undefined },
                  })
                }
                placeholder="50"
              />
              <Input
                label="Structure"
                value={vto.ten_year_target.structure || ''}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    ten_year_target: { ...vto.ten_year_target, structure: e.target.value },
                  })
                }
                placeholder="e.g., Employee-owned"
              />
              <Input
                label="Reputation"
                value={vto.ten_year_target.reputation || ''}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    ten_year_target: { ...vto.ten_year_target, reputation: e.target.value },
                  })
                }
                placeholder="Known for..."
              />
              <Input
                label="Rev/Person"
                value={vto.ten_year_target.revenue_per_person || ''}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    ten_year_target: { ...vto.ten_year_target, revenue_per_person: e.target.value },
                  })
                }
                placeholder="$400K"
              />
            </div>
          </CardContent>
        </Card>

        {/* Marketing Strategy */}
        <Card>
          <CardHeader>
            <CardTitle>Marketing Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Target Market
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Input
                  label="Industry"
                  value={vto.marketing_strategy.target_market.industry || ''}
                  onChange={(e) =>
                    setVTO({
                      ...vto,
                      marketing_strategy: {
                        ...vto.marketing_strategy,
                        target_market: { ...vto.marketing_strategy.target_market, industry: e.target.value },
                      },
                    })
                  }
                  placeholder="Technology, Healthcare..."
                />
                <Input
                  label="Company Size"
                  value={vto.marketing_strategy.target_market.company_size || ''}
                  onChange={(e) =>
                    setVTO({
                      ...vto,
                      marketing_strategy: {
                        ...vto.marketing_strategy,
                        target_market: { ...vto.marketing_strategy.target_market, company_size: e.target.value },
                      },
                    })
                  }
                  placeholder="50-500 employees"
                />
                <Input
                  label="Decision Maker"
                  value={vto.marketing_strategy.target_market.decision_maker || ''}
                  onChange={(e) =>
                    setVTO({
                      ...vto,
                      marketing_strategy: {
                        ...vto.marketing_strategy,
                        target_market: { ...vto.marketing_strategy.target_market, decision_maker: e.target.value },
                      },
                    })
                  }
                  placeholder="CTO, VP Engineering..."
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-muted-foreground">
                  Three Uniques
                </label>
                <Button variant="outline" size="sm" onClick={addThreeUnique}>
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {vto.marketing_strategy.three_uniques.map((unique, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <Input
                      value={unique}
                      onChange={(e) => updateThreeUnique(index, e.target.value)}
                      placeholder="What makes you unique?"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeThreeUnique(index)}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Textarea
              label="Proven Process"
              value={vto.marketing_strategy.proven_process || ''}
              onChange={(e) =>
                setVTO({
                  ...vto,
                  marketing_strategy: { ...vto.marketing_strategy, proven_process: e.target.value },
                })
              }
              placeholder="Your methodology or process..."
              rows={2}
            />

            <Textarea
              label="Guarantee"
              value={vto.marketing_strategy.guarantee || ''}
              onChange={(e) =>
                setVTO({
                  ...vto,
                  marketing_strategy: { ...vto.marketing_strategy, guarantee: e.target.value },
                })
              }
              placeholder="What do you guarantee?"
              rows={2}
            />
          </CardContent>
        </Card>
      </div>

      {/* Traction Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground border-b pb-2">Traction</h2>

        {/* 3-Year Picture */}
        <Card>
          <CardHeader>
            <CardTitle>3-Year Picture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input
                label="Target Date"
                value={vto.three_year_picture.target_date}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    three_year_picture: { ...vto.three_year_picture, target_date: e.target.value },
                  })
                }
                placeholder="February 2028"
              />
              <Input
                label="Revenue"
                value={vto.three_year_picture.revenue || ''}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    three_year_picture: { ...vto.three_year_picture, revenue: e.target.value },
                  })
                }
                placeholder="$8M"
              />
              <Input
                label="Profit"
                value={vto.three_year_picture.profit || ''}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    three_year_picture: { ...vto.three_year_picture, profit: e.target.value },
                  })
                }
                placeholder="$1M"
              />
              <Input
                label="Team Size"
                type="number"
                value={vto.three_year_picture.team_size || ''}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    three_year_picture: { ...vto.three_year_picture, team_size: parseInt(e.target.value) || undefined },
                  })
                }
                placeholder="25"
              />
            </div>
          </CardContent>
        </Card>

        {/* 1-Year Plan */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>1-Year Plan</CardTitle>
            <Button variant="outline" size="sm" onClick={addGoal}>
              Add Goal
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input
                label="Target Date"
                value={vto.one_year_plan.target_date}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    one_year_plan: { ...vto.one_year_plan, target_date: e.target.value },
                  })
                }
                placeholder="December 2025"
              />
              <Input
                label="Revenue"
                value={vto.one_year_plan.revenue || ''}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    one_year_plan: { ...vto.one_year_plan, revenue: e.target.value },
                  })
                }
                placeholder="$4M"
              />
              <Input
                label="Profit"
                value={vto.one_year_plan.profit || ''}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    one_year_plan: { ...vto.one_year_plan, profit: e.target.value },
                  })
                }
                placeholder="Return to profitability"
              />
              <Input
                label="Team Size"
                type="number"
                value={vto.one_year_plan.team_size || ''}
                onChange={(e) =>
                  setVTO({
                    ...vto,
                    one_year_plan: { ...vto.one_year_plan, team_size: parseInt(e.target.value) || undefined },
                  })
                }
                placeholder="18"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Goals for the Year
              </label>
              <div className="space-y-2">
                {vto.one_year_plan.goals.map((goal, index) => (
                  <GoalEditor
                    key={goal.id}
                    goal={goal}
                    onChange={(g) => updateGoal(index, g)}
                    onRemove={() => removeGoal(index)}
                  />
                ))}
                {vto.one_year_plan.goals.length === 0 && (
                  <p className="text-muted-foreground text-sm italic">
                    No goals yet. Click &quot;Add Goal&quot; to start.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accountability Chart Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground border-b pb-2">Accountability Chart</h2>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Roles & Responsibilities</CardTitle>
            <Button variant="outline" size="sm" onClick={addAccountabilityRole}>
              Add Role
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {vto.accountability_chart.map((role, index) => (
              <AccountabilityRoleEditor
                key={index}
                role={role}
                onChange={(r) => updateAccountabilityRole(index, r)}
                onRemove={() => removeAccountabilityRole(index)}
              />
            ))}
            {vto.accountability_chart.length === 0 && (
              <p className="text-muted-foreground text-sm italic">
                No roles defined yet. Click &quot;Add Role&quot; to build your Accountability Chart.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
