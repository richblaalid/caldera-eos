import Link from 'next/link'
import { getOrCreateVTO } from '@/lib/eos'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import type { VTO, CoreValue, AccountabilityRole } from '@/types/database'

// V/TO Section Components
function CoreValuesSection({ values }: { values: CoreValue[] }) {
  if (!values || values.length === 0) {
    return (
      <p className="text-muted-foreground text-sm italic">
        No core values defined yet. Click Edit to add values.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {values.map((value, index) => (
        <div key={value.id || index} className="border-l-4 border-ember-500 pl-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{value.name}</span>
            {value.hire_fire && (
              <span className="text-xs bg-ember-100 text-ember-700 px-2 py-0.5 rounded-full">
                Hire/Fire
              </span>
            )}
          </div>
          {value.definition && (
            <p className="text-sm text-muted-foreground mt-1">{value.definition}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function CoreFocusSection({ coreFocus }: { coreFocus: VTO['core_focus'] }) {
  const hasPurpose = coreFocus?.purpose && coreFocus.purpose.trim()
  const hasNiche = coreFocus?.niche && coreFocus.niche.trim()

  if (!hasPurpose && !hasNiche) {
    return (
      <p className="text-muted-foreground text-sm italic">
        No core focus defined yet. Click Edit to add purpose and niche.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-muted-foreground">Purpose / Cause / Passion</h4>
        <p className="text-foreground mt-1">
          {hasPurpose ? coreFocus.purpose : <span className="italic text-muted-foreground">Not defined</span>}
        </p>
      </div>
      <div>
        <h4 className="text-sm font-medium text-muted-foreground">Niche</h4>
        <p className="text-foreground mt-1">
          {hasNiche ? coreFocus.niche : <span className="italic text-muted-foreground">Not defined</span>}
        </p>
      </div>
    </div>
  )
}

function TenYearTargetSection({ target }: { target: VTO['ten_year_target'] }) {
  const hasGoal = target?.goal && target.goal.trim()

  if (!hasGoal) {
    return (
      <p className="text-muted-foreground text-sm italic">
        No 10-year target defined yet. Click Edit to set your BHAG.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-ember-50 rounded-lg border border-ember-200">
        <p className="text-lg font-semibold text-ember-900">{target.goal}</p>
        {target.target_date && (
          <p className="text-sm text-ember-600 mt-1">Target: {target.target_date}</p>
        )}
      </div>
      {(target.revenue || target.team_size || target.structure) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {target.revenue && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Revenue</p>
              <p className="font-semibold text-foreground">{target.revenue}</p>
            </div>
          )}
          {target.team_size && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Team Size</p>
              <p className="font-semibold text-foreground">{target.team_size} people</p>
            </div>
          )}
          {target.structure && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Structure</p>
              <p className="font-semibold text-foreground">{target.structure}</p>
            </div>
          )}
          {target.revenue_per_person && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Rev/Person</p>
              <p className="font-semibold text-foreground">{target.revenue_per_person}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MarketingStrategySection({ strategy }: { strategy: VTO['marketing_strategy'] }) {
  const hasContent = strategy?.three_uniques && strategy.three_uniques.length > 0

  if (!hasContent && !strategy?.target_market?.industry) {
    return (
      <p className="text-muted-foreground text-sm italic">
        No marketing strategy defined yet. Click Edit to add your strategy.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {strategy?.target_market && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Target Market</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {strategy.target_market.industry && (
              <div><span className="text-muted-foreground">Industry:</span> {strategy.target_market.industry}</div>
            )}
            {strategy.target_market.company_size && (
              <div><span className="text-muted-foreground">Size:</span> {strategy.target_market.company_size}</div>
            )}
            {strategy.target_market.geographic && (
              <div><span className="text-muted-foreground">Geographic:</span> {strategy.target_market.geographic}</div>
            )}
            {strategy.target_market.decision_maker && (
              <div><span className="text-muted-foreground">Decision Maker:</span> {strategy.target_market.decision_maker}</div>
            )}
          </div>
        </div>
      )}
      {strategy?.three_uniques && strategy.three_uniques.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Three Uniques</h4>
          <ol className="list-decimal list-inside space-y-1">
            {strategy.three_uniques.map((unique, i) => (
              <li key={i} className="text-foreground">{unique}</li>
            ))}
          </ol>
        </div>
      )}
      {strategy?.proven_process && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Proven Process</h4>
          <p className="text-foreground">{strategy.proven_process}</p>
        </div>
      )}
      {strategy?.guarantee && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Guarantee</h4>
          <p className="text-foreground">{strategy.guarantee}</p>
        </div>
      )}
    </div>
  )
}

function ThreeYearPictureSection({ picture }: { picture: VTO['three_year_picture'] }) {
  const hasContent = picture?.target_date || picture?.revenue

  if (!hasContent) {
    return (
      <p className="text-muted-foreground text-sm italic">
        No 3-year picture defined yet. Click Edit to set your targets.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {picture.target_date && (
        <p className="text-sm text-muted-foreground">Target Date: {picture.target_date}</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {picture.revenue && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Revenue</p>
            <p className="font-semibold text-foreground">{picture.revenue}</p>
          </div>
        )}
        {picture.profit && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Profit</p>
            <p className="font-semibold text-foreground">{picture.profit}</p>
          </div>
        )}
        {picture.team_size && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Team Size</p>
            <p className="font-semibold text-foreground">{picture.team_size} people</p>
          </div>
        )}
      </div>
      {picture.what_does_it_look_like && picture.what_does_it_look_like.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">What does it look like?</h4>
          <ul className="list-disc list-inside space-y-1">
            {picture.what_does_it_look_like.map((item, i) => (
              <li key={i} className="text-foreground">{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function OneYearPlanSection({ plan }: { plan: VTO['one_year_plan'] }) {
  const hasContent = plan?.target_date || plan?.revenue

  if (!hasContent) {
    return (
      <p className="text-muted-foreground text-sm italic">
        No 1-year plan defined yet. Click Edit to set your annual goals.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {plan.target_date && (
        <p className="text-sm text-muted-foreground">Target Date: {plan.target_date}</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {plan.revenue && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Revenue</p>
            <p className="font-semibold text-foreground">{plan.revenue}</p>
          </div>
        )}
        {plan.profit && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Profit</p>
            <p className="font-semibold text-foreground">{plan.profit}</p>
          </div>
        )}
        {plan.team_size && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Team Size</p>
            <p className="font-semibold text-foreground">{plan.team_size} people</p>
          </div>
        )}
      </div>
      {plan.goals && plan.goals.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Goals for the Year</h4>
          <ol className="list-decimal list-inside space-y-1">
            {plan.goals.map((goal) => (
              <li key={goal.id} className={`text-foreground ${goal.completed ? 'line-through text-muted-foreground' : ''}`}>
                {goal.description}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function AccountabilityChartSection({ roles }: { roles: AccountabilityRole[] }) {
  if (!roles || roles.length === 0) {
    return (
      <p className="text-muted-foreground text-sm italic">
        No accountability chart defined yet. Click Edit to add roles.
      </p>
    )
  }

  const seatOrder = ['visionary', 'integrator', 'sales', 'operations', 'finance', 'other']
  const sortedRoles = [...roles].sort((a, b) =>
    seatOrder.indexOf(a.seat) - seatOrder.indexOf(b.seat)
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedRoles.map((role, index) => (
        <div key={index} className="border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            {role.seat}
          </div>
          <div className="font-semibold text-foreground">{role.title}</div>
          {role.owner_name && (
            <div className="text-sm text-ember-600">{role.owner_name}</div>
          )}
          {role.lma && role.lma.length > 0 && (
            <ul className="mt-2 text-xs text-muted-foreground space-y-0.5">
              {role.lma.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

export default async function VTOPage() {
  const vto = await getOrCreateVTO()

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vision/Traction Organizer</h1>
          <p className="text-muted-foreground mt-1">
            Your company&apos;s strategic vision and execution plan
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Version {vto.version}
          </span>
          <Link
            href="/dashboard/vto/edit"
            className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium rounded-lg bg-ember-600 text-white hover:bg-ember-700 transition-colors"
          >
            Edit V/TO
          </Link>
        </div>
      </div>

      {/* Vision Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground border-b pb-2">Vision</h2>

        <Card>
          <CardHeader>
            <CardTitle>Core Values</CardTitle>
          </CardHeader>
          <CardContent>
            <CoreValuesSection values={vto.core_values} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Core Focus</CardTitle>
          </CardHeader>
          <CardContent>
            <CoreFocusSection coreFocus={vto.core_focus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>10-Year Target</CardTitle>
          </CardHeader>
          <CardContent>
            <TenYearTargetSection target={vto.ten_year_target} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marketing Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <MarketingStrategySection strategy={vto.marketing_strategy} />
          </CardContent>
        </Card>
      </div>

      {/* Traction Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground border-b pb-2">Traction</h2>

        <Card>
          <CardHeader>
            <CardTitle>3-Year Picture</CardTitle>
          </CardHeader>
          <CardContent>
            <ThreeYearPictureSection picture={vto.three_year_picture} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>1-Year Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <OneYearPlanSection plan={vto.one_year_plan} />
          </CardContent>
        </Card>
      </div>

      {/* Accountability Chart */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground border-b pb-2">Accountability Chart</h2>

        <Card>
          <CardContent className="pt-6">
            <AccountabilityChartSection roles={vto.accountability_chart} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
