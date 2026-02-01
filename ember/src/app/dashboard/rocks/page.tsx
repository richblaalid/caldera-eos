import Link from 'next/link'
import { getRocks, getCurrentQuarter, getProfiles } from '@/lib/eos'
import { Card, CardContent, StatusBadge } from '@/components/ui'
import type { RockWithOwner, Profile } from '@/types/database'

// Status filter component
function StatusFilter({
  currentStatus,
  quarter
}: {
  currentStatus: string | null
  quarter: string
}) {
  const statuses: { value: string | null; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'on_track', label: 'On Track' },
    { value: 'at_risk', label: 'At Risk' },
    { value: 'off_track', label: 'Off Track' },
    { value: 'complete', label: 'Complete' },
  ]

  return (
    <div className="flex gap-2 flex-wrap">
      {statuses.map(({ value, label }) => {
        const isActive = currentStatus === value
        const href = value
          ? `/dashboard/rocks?quarter=${encodeURIComponent(quarter)}&status=${value}`
          : `/dashboard/rocks?quarter=${encodeURIComponent(quarter)}`

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

// Owner filter component
function OwnerFilter({
  profiles,
  currentOwner,
  quarter,
  status
}: {
  profiles: Profile[]
  currentOwner: string | null
  quarter: string
  status: string | null
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      <Link
        href={status
          ? `/dashboard/rocks?quarter=${encodeURIComponent(quarter)}&status=${status}`
          : `/dashboard/rocks?quarter=${encodeURIComponent(quarter)}`
        }
        className={`
          px-3 py-1.5 text-sm rounded-lg transition-colors
          ${currentOwner === null
            ? 'bg-ember-600 text-white'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }
        `}
      >
        All Owners
      </Link>
      {profiles.map((profile) => {
        const isActive = currentOwner === profile.id
        const baseUrl = `/dashboard/rocks?quarter=${encodeURIComponent(quarter)}&owner=${profile.id}`
        const href = status ? `${baseUrl}&status=${status}` : baseUrl

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
            {profile.name || profile.email || 'Unknown'}
          </Link>
        )
      })}
    </div>
  )
}

// Rock card component
function RockCard({ rock }: { rock: RockWithOwner }) {
  const completedMilestones = rock.milestones?.filter(m => m.completed).length || 0
  const totalMilestones = rock.milestones?.length || 0

  return (
    <Link href={`/dashboard/rocks/${rock.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{rock.title}</h3>
              {rock.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {rock.description}
                </p>
              )}
            </div>
            <StatusBadge status={rock.status} />
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              {rock.owner && (
                <span className="text-muted-foreground">
                  {rock.owner.name || rock.owner.email}
                </span>
              )}
              {totalMilestones > 0 && (
                <span className="text-muted-foreground">
                  {completedMilestones}/{totalMilestones} milestones
                </span>
              )}
            </div>
            {rock.due_date && (
              <span className="text-muted-foreground">
                Due: {new Date(rock.due_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// Empty state component
function EmptyState({ quarter }: { quarter: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-muted-foreground mb-4">
          No rocks found for {quarter}.
        </p>
        <Link
          href="/dashboard/rocks/new"
          className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-ember-600 text-white hover:bg-ember-700 transition-colors"
        >
          Create Your First Rock
        </Link>
      </CardContent>
    </Card>
  )
}

interface PageProps {
  searchParams: Promise<{ quarter?: string; status?: string; owner?: string }>
}

export default async function RocksPage({ searchParams }: PageProps) {
  const params = await searchParams
  const quarter = params.quarter || getCurrentQuarter()
  const statusFilter = params.status || null
  const ownerFilter = params.owner || null

  // Fetch rocks and profiles in parallel
  const [allRocks, profiles] = await Promise.all([
    getRocks(quarter),
    getProfiles()
  ])

  // Apply filters
  let rocks = allRocks
  if (statusFilter) {
    rocks = rocks.filter(rock => rock.status === statusFilter)
  }
  if (ownerFilter) {
    rocks = rocks.filter(rock => rock.owner_id === ownerFilter)
  }

  // Calculate stats
  const stats = {
    total: allRocks.length,
    onTrack: allRocks.filter(r => r.status === 'on_track').length,
    atRisk: allRocks.filter(r => r.status === 'at_risk').length,
    offTrack: allRocks.filter(r => r.status === 'off_track').length,
    complete: allRocks.filter(r => r.status === 'complete').length,
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quarterly Rocks</h1>
          <p className="text-muted-foreground mt-1">
            {quarter} priorities and goals
          </p>
        </div>
        <Link
          href="/dashboard/rocks/new"
          className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-ember-600 text-white hover:bg-ember-700 transition-colors"
        >
          Add Rock
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
            <p className="text-2xl font-bold text-success">{stats.onTrack}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">On Track</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.atRisk}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">At Risk</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-danger">{stats.offTrack}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Off Track</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-success">{stats.complete}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Complete</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Filter by Status
          </label>
          <StatusFilter currentStatus={statusFilter} quarter={quarter} />
        </div>
        {profiles.length > 0 && (
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Filter by Owner
            </label>
            <OwnerFilter
              profiles={profiles}
              currentOwner={ownerFilter}
              quarter={quarter}
              status={statusFilter}
            />
          </div>
        )}
      </div>

      {/* Rock List */}
      {rocks.length === 0 ? (
        <EmptyState quarter={quarter} />
      ) : (
        <div className="space-y-4">
          {rocks.map((rock) => (
            <RockCard key={rock.id} rock={rock} />
          ))}
        </div>
      )}
    </div>
  )
}
