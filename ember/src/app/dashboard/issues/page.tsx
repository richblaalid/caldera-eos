import Link from 'next/link'
import { getIssues, getProfiles } from '@/lib/eos'
import { Card, CardContent, StatusBadge, Badge } from '@/components/ui'
import type { IssueWithOwner, IssueStatus, Profile } from '@/types/database'

// Status filter component
function StatusFilter({
  currentStatus
}: {
  currentStatus: string | null
}) {
  const statuses: { value: string | null; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'identified', label: 'Identified' },
    { value: 'discussed', label: 'Discussed' },
    { value: 'solved', label: 'Solved' },
    { value: 'dropped', label: 'Dropped' },
  ]

  return (
    <div className="flex gap-2 flex-wrap">
      {statuses.map(({ value, label }) => {
        const isActive = currentStatus === value
        const href = value
          ? `/dashboard/issues?status=${value}`
          : `/dashboard/issues`

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

// Priority indicator
function PriorityIndicator({ priority }: { priority: number }) {
  if (priority >= 3) {
    return <Badge variant="danger">P{priority}</Badge>
  } else if (priority >= 2) {
    return <Badge variant="warning">P{priority}</Badge>
  } else if (priority >= 1) {
    return <Badge variant="info">P{priority}</Badge>
  }
  return null
}

// Issue card component
function IssueCard({ issue }: { issue: IssueWithOwner }) {
  return (
    <Link href={`/dashboard/issues/${issue.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <PriorityIndicator priority={issue.priority} />
                <h3 className="font-semibold text-foreground truncate">{issue.title}</h3>
              </div>
              {issue.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {issue.description}
                </p>
              )}
            </div>
            <StatusBadge status={issue.status} />
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              {issue.owner && (
                <span className="text-muted-foreground">
                  {issue.owner.name || issue.owner.email}
                </span>
              )}
              <span className="text-muted-foreground">
                {issue.source !== 'manual' && (
                  <span className="capitalize">{issue.source}</span>
                )}
              </span>
            </div>
            <span className="text-muted-foreground">
              {new Date(issue.created_at).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// Empty state component
function EmptyState() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-muted-foreground mb-4">
          No issues found.
        </p>
        <Link
          href="/dashboard/issues/new"
          className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-ember-600 text-white hover:bg-ember-700 transition-colors"
        >
          Add First Issue
        </Link>
      </CardContent>
    </Card>
  )
}

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function IssuesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const statusFilter = params.status || null

  const issues = await getIssues(statusFilter || undefined)

  // Calculate stats
  const allIssues = await getIssues()
  const stats = {
    total: allIssues.length,
    open: allIssues.filter(i => i.status === 'open').length,
    identified: allIssues.filter(i => i.status === 'identified').length,
    discussed: allIssues.filter(i => i.status === 'discussed').length,
    solved: allIssues.filter(i => i.status === 'solved').length,
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Issues</h1>
          <p className="text-muted-foreground mt-1">
            Track and resolve issues using IDS (Identify, Discuss, Solve)
          </p>
        </div>
        <Link
          href="/dashboard/issues/new"
          className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-ember-600 text-white hover:bg-ember-700 transition-colors"
        >
          Add Issue
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.open}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Open</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.identified}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Identified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.discussed}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Discussed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-success">{stats.solved}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Solved</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Filter by Status
          </label>
          <StatusFilter currentStatus={statusFilter} />
        </div>
      </div>

      {/* Issue List */}
      {issues.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  )
}
