import { createClient } from '@supabase/supabase-js'
import { extractCashBalance, extractTotalExpenses, extractTotalIncome, extractNetIncome } from '@/lib/qbo-report-parser'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================
// Types
// ============================================

interface MetricComputer {
  metricName: string
  automation: 'full' | 'partial' | 'manual'
  compute: (orgId: string) => Promise<{ value: number; notes: string } | null>
}

interface ScorecardResult {
  metricsComputed: number
  metricsSkipped: number
  manualMetrics: Array<{ metricName: string; ownerId: string | null }>
  entries: Array<{ metricName: string; value: number; notes: string }>
  errors: string[]
}

// ============================================
// Week calculation
// ============================================

/** Get Monday of the current week as YYYY-MM-DD */
export function getCurrentWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

// ============================================
// Metric Computers
// ============================================

const CLOSED_LOST_STAGES = ['closedlost', 'closed lost', 'lost']

async function computeWeightedPipeline(orgId: string): Promise<{ value: number; notes: string } | null> {
  const { data: deals } = await supabaseAdmin
    .from('ingested_data')
    .select('payload')
    .eq('organization_id', orgId)
    .eq('source', 'hubspot')
    .eq('data_type', 'deal')

  if (!deals || deals.length === 0) return null

  let weightedTotal = 0
  let dealCount = 0
  const topDeals: Array<{ name: string; weighted: number }> = []

  for (const d of deals) {
    const p = d.payload as Record<string, unknown>
    const stage = ((p.stage as string) || '').toLowerCase()

    // Skip closed-lost deals
    if (CLOSED_LOST_STAGES.includes(stage)) continue

    const amount = (p.amount as number) || 0
    const probability = (p.probability as number) || 0

    // HubSpot stores probability as 0-100 (from hs_deal_stage_probability)
    // but some stages return decimal 0-1. Normalize to fraction.
    const probFraction = probability > 1 ? probability / 100 : probability

    const weighted = amount * probFraction
    weightedTotal += weighted
    dealCount++

    topDeals.push({ name: (p.deal_name as string) || 'Unknown', weighted })
  }

  topDeals.sort((a, b) => b.weighted - a.weighted)
  const top3 = topDeals.slice(0, 3).map(d =>
    `${d.name}: $${Math.round(d.weighted).toLocaleString()}`
  ).join(', ')

  return {
    value: Math.round(weightedTotal),
    notes: `${dealCount} open deals. Top: ${top3}`,
  }
}

async function computeWeeklySalesLeads(orgId: string): Promise<{ value: number; notes: string } | null> {
  const { data: deals } = await supabaseAdmin
    .from('ingested_data')
    .select('payload')
    .eq('organization_id', orgId)
    .eq('source', 'hubspot')
    .eq('data_type', 'deal')

  if (!deals || deals.length === 0) return null

  const newDeals: string[] = []

  for (const d of deals) {
    const p = d.payload as Record<string, unknown>
    const ageInDays = (p.deal_age_days as number) ?? 999

    if (ageInDays <= 7) {
      newDeals.push((p.deal_name as string) || 'Unknown')
    }
  }

  return {
    value: newDeals.length,
    notes: newDeals.length > 0
      ? `New this week: ${newDeals.join(', ')}`
      : 'No new deals created this week',
  }
}

async function computeCashFlowRunway(orgId: string): Promise<{ value: number; notes: string } | null> {
  // Get latest Balance Sheet report
  const { data: bsRecords } = await supabaseAdmin
    .from('ingested_data')
    .select('payload')
    .eq('organization_id', orgId)
    .eq('source', 'quickbooks')
    .eq('data_type', 'financial_report')
    .filter('payload->>report_type', 'eq', 'balance_sheet')
    .order('source_timestamp', { ascending: false })
    .limit(1)

  if (!bsRecords || bsRecords.length === 0) return null

  // Get latest 3-month P&L report
  const { data: pnlRecords } = await supabaseAdmin
    .from('ingested_data')
    .select('payload')
    .eq('organization_id', orgId)
    .eq('source', 'quickbooks')
    .eq('data_type', 'financial_report')
    .filter('payload->>report_type', 'eq', 'profit_and_loss_3mo')
    .order('source_timestamp', { ascending: false })
    .limit(1)

  if (!pnlRecords || pnlRecords.length === 0) return null

  const bsPayload = bsRecords[0].payload as Record<string, unknown>
  const pnlPayload = pnlRecords[0].payload as Record<string, unknown>

  const reportData = bsPayload.report_data as Record<string, unknown>
  const pnlReportData = pnlPayload.report_data as Record<string, unknown>

  if (!reportData || !pnlReportData) return null

  const cashBalance = extractCashBalance(reportData)
  const totalExpenses3mo = extractTotalExpenses(pnlReportData)

  if (cashBalance === null || totalExpenses3mo === null || totalExpenses3mo === 0) {
    return null
  }

  const avgMonthlyExpenses = totalExpenses3mo / 3
  const runwayMonths = cashBalance / avgMonthlyExpenses

  return {
    value: Math.round(runwayMonths * 10) / 10, // 1 decimal place
    notes: `Cash: $${Math.round(cashBalance).toLocaleString()}, Avg monthly expenses: $${Math.round(avgMonthlyExpenses).toLocaleString()}, Runway: ${runwayMonths.toFixed(1)} months`,
  }
}

async function computeNetMargin(orgId: string): Promise<{ value: number; notes: string } | null> {
  const { data: pnlRecords } = await supabaseAdmin
    .from('ingested_data')
    .select('payload')
    .eq('organization_id', orgId)
    .eq('source', 'quickbooks')
    .eq('data_type', 'financial_report')
    .filter('payload->>report_type', 'eq', 'profit_and_loss')
    .order('source_timestamp', { ascending: false })
    .limit(1)

  if (!pnlRecords || pnlRecords.length === 0) return null

  const payload = pnlRecords[0].payload as Record<string, unknown>
  const reportData = payload.report_data as Record<string, unknown>

  if (!reportData) return null

  const totalIncome = extractTotalIncome(reportData)
  const netIncome = extractNetIncome(reportData)

  if (totalIncome === null || totalIncome === 0 || netIncome === null) return null

  const marginPct = (netIncome / totalIncome) * 100
  const totalExpenses = extractTotalExpenses(reportData)

  return {
    value: Math.round(marginPct * 10) / 10,
    notes: `Revenue: $${Math.round(totalIncome).toLocaleString()}, Expenses: $${Math.round(totalExpenses ?? 0).toLocaleString()}, Net Income: $${Math.round(netIncome).toLocaleString()}`,
  }
}

const CALDERA_DOMAINS = ['withcaldera.com', 'bko.group']

async function computeBDOutreach(orgId: string): Promise<{ value: number; notes: string } | null> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Count 1: HubSpot engagements (calls, emails, meetings) from last 7 days
  const { data: engagements } = await supabaseAdmin
    .from('ingested_data')
    .select('payload')
    .eq('organization_id', orgId)
    .eq('source', 'hubspot')
    .eq('data_type', 'engagement')
    .gte('source_timestamp', sevenDaysAgo)

  const hsCount = engagements?.length || 0
  const hsByType = new Map<string, number>()
  for (const e of engagements || []) {
    const type = (e.payload as Record<string, unknown>).engagement_type as string || 'unknown'
    hsByType.set(type, (hsByType.get(type) || 0) + 1)
  }

  // Count 2: Outbound Gmail emails (from Caldera to external recipients) from last 7 days
  const { data: emails } = await supabaseAdmin
    .from('ingested_data')
    .select('payload')
    .eq('organization_id', orgId)
    .eq('source', 'gmail')
    .eq('data_type', 'email')
    .gte('source_timestamp', sevenDaysAgo)

  let gmailOutbound = 0
  for (const e of emails || []) {
    const p = e.payload as Record<string, unknown>
    const from = ((p.from as string) || '').toLowerCase()
    const to = ((p.to as string) || '').toLowerCase()

    // From Caldera domain AND to external recipient
    const isFromCaldera = CALDERA_DOMAINS.some(d => from.includes(d))
    const isToExternal = !CALDERA_DOMAINS.some(d => to.includes(d))

    if (isFromCaldera && isToExternal) {
      gmailOutbound++
    }
  }

  const total = hsCount + gmailOutbound

  // Build breakdown notes
  const hsBreakdown = [...hsByType.entries()]
    .map(([type, count]) => `${count} ${type}s`)
    .join(', ')

  return {
    value: total,
    notes: [
      hsCount > 0 ? `HubSpot: ${hsBreakdown}` : 'HubSpot: 0',
      `Gmail outbound: ${gmailOutbound}`,
    ].join(' | '),
  }
}

// ============================================
// Registry
// ============================================

const metricComputers: MetricComputer[] = [
  {
    metricName: 'Weighted Pipeline',
    automation: 'full',
    compute: computeWeightedPipeline,
  },
  {
    metricName: 'Weekly Sales Leads',
    automation: 'full',
    compute: computeWeeklySalesLeads,
  },
  {
    metricName: 'Cash Flow Runway',
    automation: 'full',
    compute: computeCashFlowRunway,
  },
  {
    metricName: 'Net Margin %',
    automation: 'full',
    compute: computeNetMargin,
  },
  {
    metricName: 'Weekly BD Outreach Activities',
    automation: 'full',
    compute: computeBDOutreach,
  },
]

const MANUAL_METRICS = [
  'Billable Utilization',
  'Monthly Thought Leadership Articles',
  'Bench Utilization Rate',
]

// ============================================
// Orchestrator
// ============================================

export async function computeWeeklyScorecard(orgId: string): Promise<ScorecardResult> {
  const weekOf = getCurrentWeekStart()
  const result: ScorecardResult = {
    metricsComputed: 0,
    metricsSkipped: 0,
    manualMetrics: [],
    entries: [],
    errors: [],
  }

  // Load all active metrics for this org
  const { data: metrics, error: metricsError } = await supabaseAdmin
    .from('scorecard_metrics')
    .select('id, name, owner_id')
    .eq('organization_id', orgId)
    .eq('is_active', true)

  if (metricsError || !metrics) {
    result.errors.push(`Failed to load metrics: ${metricsError?.message || 'No data'}`)
    return result
  }

  for (const metric of metrics) {
    // Check if we have a computer for this metric
    const computer = metricComputers.find(
      c => c.metricName.toLowerCase() === metric.name.toLowerCase()
    )

    if (!computer) {
      // Check if it's a known manual metric
      const isManual = MANUAL_METRICS.some(
        m => m.toLowerCase() === metric.name.toLowerCase()
      )
      if (isManual) {
        result.manualMetrics.push({ metricName: metric.name, ownerId: metric.owner_id })
      } else {
        result.metricsSkipped++
      }
      continue
    }

    try {
      const computed = await computer.compute(orgId)
      if (!computed) {
        result.metricsSkipped++
        continue
      }

      // Upsert the entry
      const { error: upsertError } = await supabaseAdmin
        .from('scorecard_entries')
        .upsert(
          {
            metric_id: metric.id,
            week_of: weekOf,
            value: computed.value,
            notes: `[Auto] ${computed.notes}`,
          },
          { onConflict: 'metric_id,week_of' }
        )

      if (upsertError) {
        result.errors.push(`Upsert failed for ${metric.name}: ${upsertError.message}`)
        continue
      }

      result.metricsComputed++
      result.entries.push({
        metricName: metric.name,
        value: computed.value,
        notes: computed.notes,
      })
    } catch (error: unknown) {
      const err = error as { message?: string }
      result.errors.push(`Compute failed for ${metric.name}: ${err.message || 'Unknown error'}`)
    }
  }

  return result
}
