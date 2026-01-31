import Link from 'next/link'
import { getTodos, getProfiles } from '@/lib/eos'
import { Card, CardContent, Badge } from '@/components/ui'
import type { TodoWithOwner, Profile } from '@/types/database'
import { TodoListClient } from './TodoListClient'
import { QuickAddTodo } from './QuickAddTodo'

// Filter component
function StatusFilter({
  currentFilter
}: {
  currentFilter: string | null
}) {
  const filters: { value: string | null; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'overdue', label: 'Overdue' },
  ]

  return (
    <div className="flex gap-2 flex-wrap">
      {filters.map(({ value, label }) => {
        const isActive = currentFilter === value
        const href = value
          ? `/dashboard/todos?filter=${value}`
          : `/dashboard/todos`

        return (
          <Link
            key={label}
            href={href}
            className={`
              px-3 py-1.5 text-sm rounded-lg transition-colors
              ${isActive
                ? 'bg-ember-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }
            `}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}

// Owner filter
function OwnerFilter({
  profiles,
  currentOwner
}: {
  profiles: Profile[]
  currentOwner: string | null
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      <Link
        href="/dashboard/todos"
        className={`
          px-3 py-1.5 text-sm rounded-lg transition-colors
          ${!currentOwner
            ? 'bg-ember-600 text-white'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }
        `}
      >
        All
      </Link>
      {profiles.map((profile) => {
        const isActive = currentOwner === profile.id
        const href = `/dashboard/todos?owner=${profile.id}`
        const displayName = profile.name?.split(' ')[0] || profile.email

        return (
          <Link
            key={profile.id}
            href={href}
            className={`
              px-3 py-1.5 text-sm rounded-lg transition-colors
              ${isActive
                ? 'bg-ember-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }
            `}
          >
            {displayName}
          </Link>
        )
      })}
    </div>
  )
}

// Empty state component
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-muted-foreground mb-4">
          {hasFilters ? 'No to-dos match your filters.' : 'No to-dos yet.'}
        </p>
        <Link
          href="/dashboard/todos/new"
          className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-ember-600 text-white hover:bg-ember-700 transition-colors"
        >
          Add First To-do
        </Link>
      </CardContent>
    </Card>
  )
}

// Helper to check if a date is overdue
function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  return due < today
}

// Helper to check if due today
function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  return due.getTime() === today.getTime()
}

// Helper to check if due this week
function isDueThisWeek(dueDate: string | null): boolean {
  if (!dueDate) return false
  const today = new Date()
  const endOfWeek = new Date(today)
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()))
  const due = new Date(dueDate)
  return due >= today && due <= endOfWeek
}

interface PageProps {
  searchParams: Promise<{ filter?: string; owner?: string }>
}

export default async function TodosPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filterParam = params.filter || null
  const ownerParam = params.owner || null

  // Build filters for query
  const queryFilters: { owner_id?: string; completed?: boolean } = {}
  if (ownerParam) {
    queryFilters.owner_id = ownerParam
  }
  if (filterParam === 'completed') {
    queryFilters.completed = true
  } else if (filterParam === 'pending') {
    queryFilters.completed = false
  }

  // Fetch data
  const [todos, profiles] = await Promise.all([
    getTodos(queryFilters),
    getProfiles()
  ])

  // If filtering by overdue, filter client-side
  let filteredTodos = todos
  if (filterParam === 'overdue') {
    filteredTodos = todos.filter(t => !t.completed && isOverdue(t.due_date))
  }

  // Calculate stats from all todos (unfiltered)
  const allTodos = await getTodos()
  const stats = {
    total: allTodos.length,
    completed: allTodos.filter(t => t.completed).length,
    pending: allTodos.filter(t => !t.completed).length,
    overdue: allTodos.filter(t => !t.completed && isOverdue(t.due_date)).length,
    dueToday: allTodos.filter(t => !t.completed && isDueToday(t.due_date)).length,
    dueThisWeek: allTodos.filter(t => !t.completed && isDueThisWeek(t.due_date)).length,
  }

  const hasFilters = !!filterParam || !!ownerParam

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">To-dos</h1>
          <p className="text-muted-foreground mt-1">
            7-day action items from L10 meetings
          </p>
        </div>
        <Link
          href="/dashboard/todos/new"
          className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-ember-600 text-white hover:bg-ember-700 transition-colors"
        >
          Add To-do
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-success">{stats.completed}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-danger' : 'text-foreground'}`}>
              {stats.overdue}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      {(stats.dueToday > 0 || stats.dueThisWeek > 0) && (
        <div className="flex gap-4 text-sm">
          {stats.dueToday > 0 && (
            <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg">
              {stats.dueToday} due today
            </span>
          )}
          {stats.dueThisWeek > 0 && (
            <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg">
              {stats.dueThisWeek} due this week
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Filter by Status
          </label>
          <StatusFilter currentFilter={filterParam} />
        </div>
        {profiles.length > 0 && (
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Filter by Owner
            </label>
            <OwnerFilter profiles={profiles} currentOwner={ownerParam} />
          </div>
        )}
      </div>

      {/* Quick Add */}
      <QuickAddTodo profiles={profiles} />

      {/* Todo List */}
      {filteredTodos.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <TodoListClient todos={filteredTodos} />
      )}
    </div>
  )
}
