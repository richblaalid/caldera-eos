// =============================================
// Agent System Types
// =============================================

// =============================================
// Agent Definitions
// =============================================

export interface AgentDefinition {
  id: string
  organization_id: string
  display_name: string
  persona: string
  tool_set: string[]
  data_sources: string[]
  output_scope: 'org' | 'user'
  triggers: AgentTrigger[]
  baseline_tasks: AgentBaselineTask[]
  config: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AgentTrigger {
  type: 'schedule' | 'event'
  cron?: string
  event_type?: string
  task: string
}

export interface AgentBaselineTask {
  task: string
  description: string
}

// =============================================
// Agent Outputs
// =============================================

export type AgentOutputType = 'analysis' | 'draft' | 'alert' | 'issue' | 'recommendation' | 'briefing'
export type AgentOutputStatus = 'completed' | 'pending_review' | 'approved' | 'rejected' | 'deferred' | 'expired'
export type TrustZone = 1 | 2

export interface AgentOutput {
  id: string
  organization_id: string
  agent_id: string
  output_type: AgentOutputType
  title: string
  summary: string | null
  content: Record<string, unknown>
  trust_zone: TrustZone
  status: AgentOutputStatus
  target_partner: string | null
  approved_by: string | null
  approved_at: string | null
  deferred_until: string | null
  execution_result: Record<string, unknown> | null
  related_eos_item_type: string | null
  related_eos_item_id: string | null
  created_at: string
  expires_at: string | null
}

export interface AgentOutputInsert {
  id?: string
  organization_id: string
  agent_id: string
  output_type: AgentOutputType
  title: string
  summary?: string | null
  content: Record<string, unknown>
  trust_zone?: TrustZone
  status?: AgentOutputStatus
  target_partner?: string | null
  expires_at?: string | null
  related_eos_item_type?: string | null
  related_eos_item_id?: string | null
}

// =============================================
// Agent Runs (execution log)
// =============================================

export type AgentRunStatus = 'running' | 'completed' | 'failed'
export type AgentTriggerType = 'schedule' | 'event' | 'request'

export interface AgentRun {
  id: string
  organization_id: string
  agent_id: string
  trigger_type: AgentTriggerType
  trigger_context: Record<string, unknown> | null
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  input_tokens: number | null
  output_tokens: number | null
  model: string | null
  outputs_created: number
  errors: AgentRunError[]
  status: AgentRunStatus
}

export interface AgentRunError {
  message: string
  code?: string
  timestamp?: string
}

export interface AgentRunInsert {
  id?: string
  organization_id: string
  agent_id: string
  trigger_type: AgentTriggerType
  trigger_context?: Record<string, unknown>
  model?: string
}

// =============================================
// Ingested Data
// =============================================

export type DataSource = 'gmail' | 'calendar' | 'quickbooks' | 'slack' | 'hubspot' | 'gusto' | 'grain' | 'google_drive'
export type DataType = 'email' | 'calendar_event' | 'invoice' | 'payment' | 'message' | 'transcript' | 'transcript_summary' | 'financial_report' | 'deal' | 'contact' | 'company' | 'engagement' | 'document' | 'coaching_feedback'

export interface IngestedData {
  id: string
  organization_id: string
  source: DataSource
  source_id: string
  data_type: DataType
  payload: Record<string, unknown>
  raw_payload: Record<string, unknown> | null
  entities: IngestedEntities
  relevance_tags: string[]
  embedding: number[] | null
  ingested_at: string
  source_timestamp: string | null
  processed_by: string[]
}

export interface IngestedEntities {
  people?: string[]
  companies?: string[]
  action_items?: string[]
  topics?: string[]
}

export interface IngestedDataInsert {
  id?: string
  organization_id: string
  source: DataSource
  source_id: string
  data_type: DataType
  payload: Record<string, unknown>
  raw_payload?: Record<string, unknown> | null
  entities?: IngestedEntities
  relevance_tags?: string[]
  source_timestamp?: string | null
}

// =============================================
// Briefings
// =============================================

export interface Briefing {
  id: string
  organization_id: string
  partner_id: string
  briefing_date: string
  tier1_urgent: BriefingItem[]
  tier2_business: BriefingItem[]
  tier3_industry: BriefingItem[]
  agent_work_queue: AgentWorkItem[]
  slack_message_ts: string | null
  slack_channel_id: string | null
  delivered_at: string | null
  commands_processed: BriefingCommand[]
  created_at: string
}

export interface BriefingItem {
  id: string
  title: string
  detail: string
  source: string
  action_needed?: boolean
  eos_type?: string
  eos_id?: string
}

export interface AgentWorkItem {
  id: string
  agent_id: string
  agent_name: string
  title: string
  summary: string
  output_id: string
  trust_zone: TrustZone
  status: AgentOutputStatus
}

export interface AgentInsightItem {
  agent_id: string
  agent_name: string
  title: string
  output_type: string
}

export interface BriefingCommand {
  command: string
  timestamp: string
  result: string
}

export interface BriefingInsert {
  id?: string
  organization_id: string
  partner_id: string
  briefing_date: string
  tier1_urgent?: BriefingItem[]
  tier2_business?: BriefingItem[]
  tier3_industry?: BriefingItem[]
  agent_work_queue?: AgentWorkItem[]
}

// =============================================
// Briefings v2 (Tactical Daily + Strategic Monday)
// =============================================

export type TacticalUrgency = 'must-do' | 'should-do'
export type StrategicCategory = 'financial' | 'pipeline' | 'rocks' | 'positioning' | 'pattern'
export type StrategicTrend = 'improving' | 'stable' | 'declining' | 'new'

export interface TacticalItem {
  id: string
  title: string
  context: string
  source: string
  urgency: TacticalUrgency
  data_refs?: string[]
}

export interface StrategicItem {
  id: string
  title: string
  detail: string
  category: StrategicCategory
  trend: StrategicTrend
}

export interface FYIItem {
  text: string
  source: string
}

export interface BriefingV2 {
  id: string
  organization_id: string
  partner_id: string
  briefing_date: string
  briefing_version: 2
  is_monday: boolean
  tactical_items: TacticalItem[]
  strategic_items: StrategicItem[]
  fyi_item: FYIItem | null
  agent_work_queue: AgentWorkItem[]
  agent_insights: AgentInsightItem[]
  slack_message_ts: string | null
  slack_channel_id: string | null
  delivered_at: string | null
  commands_processed: BriefingCommand[]
  created_at: string
}

export interface BriefingInsertV2 {
  id?: string
  organization_id: string
  partner_id: string
  briefing_date: string
  briefing_version?: number
  is_monday?: boolean
  tactical_items?: TacticalItem[]
  strategic_items?: StrategicItem[]
  fyi_item?: FYIItem | null
  agent_work_queue?: AgentWorkItem[]
  agent_insights?: AgentInsightItem[]
}

// =============================================
// Partner Preferences
// =============================================

export type NotificationLevel = 'minimal' | 'normal' | 'verbose'

export interface PartnerPreferences {
  id: string
  organization_id: string
  partner_id: string
  briefing_time: string
  briefing_timezone: string
  slack_channel_id: string | null
  notification_level: NotificationLevel
  focus_areas: string[]
  google_refresh_token: string | null
  google_history_id: string | null
  quickbooks_refresh_token: string | null
  quickbooks_realm_id: string | null
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PartnerPreferencesInsert {
  id?: string
  organization_id: string
  partner_id: string
  briefing_time?: string
  briefing_timezone?: string
  slack_channel_id?: string | null
  notification_level?: NotificationLevel
  focus_areas?: string[]
  google_refresh_token?: string | null
  google_history_id?: string | null
  quickbooks_refresh_token?: string | null
  quickbooks_realm_id?: string | null
  config?: Record<string, unknown>
}

// =============================================
// Agent Runtime Types
// =============================================

export interface AgentInvocation {
  agentId: string
  trigger: AgentTriggerType
  triggerContext: Record<string, unknown>
  requestingAgent?: string
  requestingPartner?: string
}

export interface AgentResult {
  outputs: AgentOutputInsert[]
  notifications: SlackNotification[]
  eosActions: EOSAction[]
  errors: AgentRunError[]
  tokenUsage: { input: number; output: number }
}

export interface SlackNotification {
  channel: string
  text: string
  blocks?: Record<string, unknown>[]
  thread_ts?: string
}

export interface EOSAction {
  type: 'create_issue' | 'create_todo' | 'update_scorecard'
  payload: Record<string, unknown>
}

// =============================================
// Command Parser Types
// =============================================

export type CommandType = 'approve' | 'reject' | 'defer' | 'status_query' | 'freeform'

export interface ParsedCommand {
  command_type: CommandType
  item_numbers: number[]
  parameters: Record<string, string>
  raw_text: string
}

// =============================================
// Email Classification Types
// =============================================

export type EmailCategory = 'client' | 'prospect' | 'vendor' | 'internal' | 'newsletter' | 'other'

export interface ClassifiedEmail {
  id: string
  from: string
  subject: string
  snippet: string
  category: EmailCategory
  entities: IngestedEntities
  action_needed: boolean
  priority: 'high' | 'medium' | 'low'
  timestamp: string
}

// =============================================
// Calendar Types
// =============================================

export type CalendarEventType = 'client_meeting' | 'internal' | 'l10' | '1on1' | 'external' | 'other'

export interface ClassifiedCalendarEvent {
  id: string
  title: string
  start: string
  end: string
  attendees: string[]
  event_type: CalendarEventType
  entities: IngestedEntities
  prep_notes?: string
}
