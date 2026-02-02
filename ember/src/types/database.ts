// =============================================
// Core Types
// =============================================

export interface Profile {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  role: 'partner' | string
  slack_user_id: string | null
  created_at: string
  updated_at: string
}

// =============================================
// V/TO (Vision/Traction Organizer)
// =============================================

export interface CoreValue {
  id: string
  name: string
  definition: string
  hire_fire: boolean // "We hire/fire for this"
  order: number
}

export interface CoreFocus {
  purpose: string // Purpose / Cause / Passion
  niche: string   // What we do better than anyone
}

export interface TenYearTarget {
  goal: string           // The Big Goal (BHAG)
  target_date: string    // Target year (e.g., "2035")
  revenue?: string       // e.g., "$20M"
  team_size?: number     // e.g., 50
  structure?: string     // e.g., "employee-owned"
  reputation?: string    // e.g., "premier AI product team"
  revenue_per_person?: string // e.g., "$400K"
  description?: string   // What this looks like narrative
}

export interface TargetMarket {
  geographic?: string
  demographic?: string
  psychographic?: string
  industry?: string
  company_size?: string
  decision_maker?: string
}

export interface MarketingStrategy {
  target_market: TargetMarket
  three_uniques: string[]
  proven_process?: string
  guarantee?: string
}

export interface ThreeYearPicture {
  target_date: string      // e.g., "February 2028"
  revenue?: string         // e.g., "$8M"
  profit?: string
  team_size?: number       // e.g., 25
  measurables: string[]
  what_does_it_look_like: string[] // Bullet points
}

export interface OneYearGoal {
  id: string
  description: string
  completed: boolean
  order: number
}

export interface OneYearPlan {
  target_date: string      // e.g., "December 2025"
  revenue?: string         // e.g., "$4M"
  profit?: string          // e.g., "Return to profitability"
  team_size?: number       // e.g., 18
  measurables: string[]
  goals: OneYearGoal[]
}

export type AccountabilitySeat = 'visionary' | 'integrator' | 'sales' | 'operations' | 'finance' | 'other'

export interface AccountabilityRole {
  seat: AccountabilitySeat
  title: string
  owner_id?: string        // Reference to profile
  owner_name?: string      // Display name
  lma: string[]            // Lead, Manage, Accountability items
}

export interface VTOIssue {
  id: string
  description: string
  created_at: string
  resolved: boolean
}

export interface VTO {
  id: string
  version: number
  // Vision
  core_values: CoreValue[]
  core_focus: CoreFocus
  ten_year_target: TenYearTarget
  marketing_strategy: MarketingStrategy
  // Traction
  three_year_picture: ThreeYearPicture
  one_year_plan: OneYearPlan
  // Quarterly Rocks - references to rocks table by ID
  quarterly_rocks: string[]
  // Long-term V/TO Issues (separate from weekly issues)
  issues_list: VTOIssue[]
  // Accountability Chart
  accountability_chart: AccountabilityRole[]
  // Metadata
  created_at: string
  updated_at: string
}

// =============================================
// Rocks (Quarterly Priorities)
// =============================================

export type RockStatus = 'on_track' | 'off_track' | 'at_risk' | 'complete'

export interface RockMilestone {
  id: string
  title: string
  due_date?: string
  completed: boolean
  completed_at?: string
}

export interface Rock {
  id: string
  title: string
  description: string | null
  owner_id: string | null
  quarter: string
  status: RockStatus
  milestones: RockMilestone[]
  notes: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// =============================================
// Issues (IDS Workflow)
// =============================================

export type IssueStatus = 'open' | 'identified' | 'discussed' | 'solved' | 'dropped'
export type IssueSource = 'manual' | 'transcript' | 'insight' | 'chat'

export interface Issue {
  id: string
  title: string
  description: string | null
  priority: number
  status: IssueStatus
  owner_id: string | null
  source: IssueSource
  source_id: string | null
  resolution: string | null
  created_at: string
  updated_at: string
}

// =============================================
// To-dos (7-day action items)
// =============================================

export interface Todo {
  id: string
  title: string
  description: string | null
  owner_id: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  meeting_id: string | null
  rock_id: string | null
  issue_id: string | null
  created_at: string
  updated_at: string
}

// =============================================
// Scorecard
// =============================================

export type MetricFrequency = 'weekly' | 'monthly'
export type GoalDirection = 'above' | 'below' | 'equal'

export interface ScorecardMetric {
  id: string
  name: string
  description: string | null
  owner_id: string | null
  target: number | null
  unit: string | null
  frequency: MetricFrequency
  goal_direction: GoalDirection
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ScorecardEntry {
  id: string
  metric_id: string
  value: number | null
  week_of: string
  notes: string | null
  created_at: string
  updated_at: string
}

// =============================================
// Meetings
// =============================================

export type MeetingType = 'l10' | 'quarterly' | 'annual' | 'other'

export interface AgendaItem {
  id: string
  title: string
  duration_minutes?: number
  completed?: boolean
  notes?: string
}

export interface MeetingPrepContent {
  summary?: string
  rocks_update?: string[]
  issues_to_discuss?: string[]
  scorecard_highlights?: string[]
  todos_review?: string[]
  generated_at?: string
}

export interface Meeting {
  id: string
  title: string
  meeting_type: MeetingType
  meeting_date: string
  duration_minutes: number | null
  attendees: string[]
  agenda: AgendaItem[]
  notes: string | null
  prep_content: MeetingPrepContent | null
  prep_generated_at: string | null
  created_at: string
  updated_at: string
}

// =============================================
// Transcripts
// =============================================

export interface TranscriptExtractedItem {
  type: 'issue' | 'todo' | 'decision' | 'action'
  title: string
  description?: string
  owner?: string
  priority?: number
  due_date?: string
  context: string
  created?: boolean // Tracks if item was already created as EOS entity
}

export interface TranscriptExtractions {
  issues: TranscriptExtractedItem[]
  todos: TranscriptExtractedItem[]
  decisions: TranscriptExtractedItem[]
  summary: string
}

export interface Transcript {
  id: string
  title: string | null
  meeting_id: string | null
  meeting_date: string | null
  participants: string[]
  full_text: string | null
  summary: string | null
  extractions: TranscriptExtractions | null
  source: string | null
  file_path: string | null
  processed: boolean
  processed_at: string | null
  created_at: string
  updated_at: string
}

export interface TranscriptChunk {
  id: string
  transcript_id: string
  content: string
  speaker: string | null
  timestamp_start: number | null
  timestamp_end: number | null
  chunk_index: number | null
  embedding: number[] | null
  created_at: string
}

// =============================================
// Chat Messages
// =============================================

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessageMetadata {
  sources?: string[]
  eos_context?: {
    rocks?: string[]
    issues?: string[]
    todos?: string[]
  }
  tool_executions?: Array<{
    tool: string
    result: string
  }>
}

export interface ChatMessage {
  id: string
  user_id: string
  conversation_id: string
  role: ChatRole
  content: string
  metadata: ChatMessageMetadata
  created_at: string
}

// =============================================
// Insights
// =============================================

export type InsightType = 'pattern' | 'suggestion' | 'warning' | 'observation' | 'reminder'

export interface InsightSource {
  type: 'transcript' | 'rock' | 'issue' | 'todo' | 'meeting'
  id: string
  title?: string
}

export interface InsightRelatedEntities {
  rocks?: string[]
  issues?: string[]
  todos?: string[]
  meetings?: string[]
}

export interface Insight {
  id: string
  type: InsightType
  title: string
  content: string
  priority: number
  sources: InsightSource[]
  related_entities: InsightRelatedEntities
  acknowledged: boolean
  acknowledged_at: string | null
  acknowledged_by: string | null
  expires_at: string | null
  created_at: string
}

// =============================================
// Organizational Checkup
// =============================================

export type EOSComponent = 'vision' | 'people' | 'data' | 'issues' | 'process' | 'traction'

export interface CheckupPeriod {
  id: string
  organization_id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CheckupQuestion {
  id: string
  component: EOSComponent
  question_order: number
  question_text: string
  created_at: string
}

export interface CheckupResponse {
  id: string
  period_id: string
  user_id: string
  question_id: string
  score: number // 1-5
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CheckupCompletion {
  id: string
  period_id: string
  user_id: string
  total_score: number
  vision_score: number
  people_score: number
  data_score: number
  issues_score: number
  process_score: number
  traction_score: number
  completed_at: string
}

export interface SlackSettings {
  id: string
  organization_id: string
  bot_token: string | null
  channel_id: string | null
  channel_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Component score breakdown with max scores
export interface ComponentScores {
  vision: { score: number; max: number }
  people: { score: number; max: number }
  data: { score: number; max: number }
  issues: { score: number; max: number }
  process: { score: number; max: number }
  traction: { score: number; max: number }
  total: { score: number; max: number }
}

// =============================================
// Insert/Update Types (with proper defaults)
// =============================================

export interface ProfileInsert {
  id: string
  email?: string | null
  name?: string | null
  avatar_url?: string | null
  role?: string
  slack_user_id?: string | null
}

export interface VTOInsert {
  id?: string
  version?: number
  core_values?: CoreValue[]
  core_focus?: Partial<CoreFocus>
  ten_year_target?: Partial<TenYearTarget>
  marketing_strategy?: Partial<MarketingStrategy>
  three_year_picture?: Partial<ThreeYearPicture>
  one_year_plan?: Partial<OneYearPlan>
  quarterly_rocks?: string[]
  issues_list?: VTOIssue[]
  accountability_chart?: AccountabilityRole[]
}

export interface RockInsert {
  id?: string
  title: string
  description?: string | null
  owner_id?: string | null
  quarter: string
  status?: RockStatus
  milestones?: RockMilestone[]
  notes?: string | null
  due_date?: string | null
  completed_at?: string | null
}

export interface IssueInsert {
  id?: string
  title: string
  description?: string | null
  priority?: number
  status?: IssueStatus
  owner_id?: string | null
  source?: IssueSource
  source_id?: string | null
  resolution?: string | null
}

export interface TodoInsert {
  id?: string
  title: string
  description?: string | null
  owner_id?: string | null
  due_date?: string | null
  completed?: boolean
  completed_at?: string | null
  meeting_id?: string | null
  rock_id?: string | null
  issue_id?: string | null
}

export interface ScorecardMetricInsert {
  id?: string
  name: string
  description?: string | null
  owner_id?: string | null
  target?: number | null
  unit?: string | null
  frequency?: MetricFrequency
  goal_direction?: GoalDirection
  display_order?: number
  is_active?: boolean
}

export interface ScorecardEntryInsert {
  id?: string
  metric_id: string
  value?: number | null
  week_of: string
  notes?: string | null
}

export interface MeetingInsert {
  id?: string
  title: string
  meeting_type?: MeetingType
  meeting_date: string
  duration_minutes?: number | null
  attendees?: string[]
  agenda?: AgendaItem[]
  notes?: string | null
  prep_content?: MeetingPrepContent | null
  prep_generated_at?: string | null
}

export interface TranscriptInsert {
  id?: string
  title?: string | null
  meeting_id?: string | null
  meeting_date?: string | null
  participants?: string[]
  full_text?: string | null
  summary?: string | null
  extractions?: TranscriptExtractions | null
  source?: string | null
  file_path?: string | null
  processed?: boolean
  processed_at?: string | null
}

export interface TranscriptChunkInsert {
  id?: string
  transcript_id: string
  content: string
  speaker?: string | null
  timestamp_start?: number | null
  timestamp_end?: number | null
  chunk_index?: number | null
  embedding?: number[] | null
}

export interface ChatMessageInsert {
  id?: string
  user_id: string
  conversation_id?: string
  role: ChatRole
  content: string
  metadata?: ChatMessageMetadata
}

export interface InsightInsert {
  id?: string
  type: InsightType
  title: string
  content: string
  priority?: number
  sources?: InsightSource[]
  related_entities?: InsightRelatedEntities
  acknowledged?: boolean
  acknowledged_at?: string | null
  acknowledged_by?: string | null
  expires_at?: string | null
}

export interface CheckupPeriodInsert {
  id?: string
  organization_id: string
  name: string
  start_date: string
  end_date: string
  is_active?: boolean
}

export interface CheckupResponseInsert {
  id?: string
  period_id: string
  user_id: string
  question_id: string
  score: number
  notes?: string | null
}

export interface CheckupCompletionInsert {
  id?: string
  period_id: string
  user_id: string
  total_score: number
  vision_score: number
  people_score: number
  data_score: number
  issues_score: number
  process_score: number
  traction_score: number
}

export interface SlackSettingsInsert {
  id?: string
  organization_id: string
  bot_token?: string | null
  channel_id?: string | null
  channel_name?: string | null
  is_active?: boolean
}

// =============================================
// Database Schema Type (Supabase)
// =============================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: Partial<ProfileInsert>
        Relationships: []
      }
      vto: {
        Row: VTO
        Insert: VTOInsert
        Update: Partial<VTOInsert>
        Relationships: []
      }
      rocks: {
        Row: Rock
        Insert: RockInsert
        Update: Partial<RockInsert>
        Relationships: [
          {
            foreignKeyName: 'rocks_owner_id_fkey'
            columns: ['owner_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      issues: {
        Row: Issue
        Insert: IssueInsert
        Update: Partial<IssueInsert>
        Relationships: [
          {
            foreignKeyName: 'issues_owner_id_fkey'
            columns: ['owner_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      todos: {
        Row: Todo
        Insert: TodoInsert
        Update: Partial<TodoInsert>
        Relationships: [
          {
            foreignKeyName: 'todos_owner_id_fkey'
            columns: ['owner_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      scorecard_metrics: {
        Row: ScorecardMetric
        Insert: ScorecardMetricInsert
        Update: Partial<ScorecardMetricInsert>
        Relationships: [
          {
            foreignKeyName: 'scorecard_metrics_owner_id_fkey'
            columns: ['owner_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      scorecard_entries: {
        Row: ScorecardEntry
        Insert: ScorecardEntryInsert
        Update: Partial<ScorecardEntryInsert>
        Relationships: [
          {
            foreignKeyName: 'scorecard_entries_metric_id_fkey'
            columns: ['metric_id']
            referencedRelation: 'scorecard_metrics'
            referencedColumns: ['id']
          }
        ]
      }
      meetings: {
        Row: Meeting
        Insert: MeetingInsert
        Update: Partial<MeetingInsert>
        Relationships: []
      }
      transcripts: {
        Row: Transcript
        Insert: TranscriptInsert
        Update: Partial<TranscriptInsert>
        Relationships: [
          {
            foreignKeyName: 'transcripts_meeting_id_fkey'
            columns: ['meeting_id']
            referencedRelation: 'meetings'
            referencedColumns: ['id']
          }
        ]
      }
      transcript_chunks: {
        Row: TranscriptChunk
        Insert: TranscriptChunkInsert
        Update: Partial<TranscriptChunkInsert>
        Relationships: [
          {
            foreignKeyName: 'transcript_chunks_transcript_id_fkey'
            columns: ['transcript_id']
            referencedRelation: 'transcripts'
            referencedColumns: ['id']
          }
        ]
      }
      chat_messages: {
        Row: ChatMessage
        Insert: ChatMessageInsert
        Update: Partial<ChatMessageInsert>
        Relationships: [
          {
            foreignKeyName: 'chat_messages_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      insights: {
        Row: Insight
        Insert: InsightInsert
        Update: Partial<InsightInsert>
        Relationships: [
          {
            foreignKeyName: 'insights_acknowledged_by_fkey'
            columns: ['acknowledged_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      checkup_periods: {
        Row: CheckupPeriod
        Insert: CheckupPeriodInsert
        Update: Partial<CheckupPeriodInsert>
        Relationships: []
      }
      checkup_questions: {
        Row: CheckupQuestion
        Insert: never // Read-only, seeded
        Update: never
        Relationships: []
      }
      checkup_responses: {
        Row: CheckupResponse
        Insert: CheckupResponseInsert
        Update: Partial<CheckupResponseInsert>
        Relationships: [
          {
            foreignKeyName: 'checkup_responses_period_id_fkey'
            columns: ['period_id']
            referencedRelation: 'checkup_periods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'checkup_responses_question_id_fkey'
            columns: ['question_id']
            referencedRelation: 'checkup_questions'
            referencedColumns: ['id']
          }
        ]
      }
      checkup_completions: {
        Row: CheckupCompletion
        Insert: CheckupCompletionInsert
        Update: Partial<CheckupCompletionInsert>
        Relationships: [
          {
            foreignKeyName: 'checkup_completions_period_id_fkey'
            columns: ['period_id']
            referencedRelation: 'checkup_periods'
            referencedColumns: ['id']
          }
        ]
      }
      slack_settings: {
        Row: SlackSettings
        Insert: SlackSettingsInsert
        Update: Partial<SlackSettingsInsert>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// =============================================
// Helper Types
// =============================================

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Convenience exports for common queries
export type RockWithOwner = Rock & { owner: Profile | null }
export type IssueWithOwner = Issue & { owner: Profile | null }
export type TodoWithOwner = Todo & { owner: Profile | null }
export type MetricWithOwner = ScorecardMetric & { owner: Profile | null }

// =============================================
// Search Types
// =============================================

export type SearchEntityType = 'rocks' | 'issues' | 'todos' | 'transcripts' | 'meetings'

export interface SearchResults {
  rocks: RockWithOwner[]
  issues: IssueWithOwner[]
  todos: TodoWithOwner[]
  transcripts: Transcript[]
  meetings: Meeting[]
}
