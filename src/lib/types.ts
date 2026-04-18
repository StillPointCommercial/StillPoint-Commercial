// ============================================
// Enum types (matching Supabase enums)
// ============================================

export type RelationshipStatus = 'dormant' | 'warming' | 'active' | 'client' | 'past_client'
export type IcpFit = 'strong' | 'moderate' | 'weak' | 'not_assessed'
export type EntryType = 'note' | 'meeting' | 'call' | 'email' | 'transcript'
export type OpportunityStage = 'lead' | 'warming' | 'discovery' | 'proposal' | 'active_client' | 'paused' | 'lost'
export type ConfidenceLevel = 'low' | 'medium' | 'high'
export type LeadSource = 'referral' | 'inbound' | 'networking' | 'cold_outreach' | 'existing_client' | 'other'
export type DeliveryType = 'project' | 'retainer' | 'advisory'
export type RevenueType = 'one_time' | 'recurring'

// ============================================
// Data models
// ============================================

export interface Company {
  id: string
  user_id: string
  name: string
  industry: string | null
  website: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  user_id: string
  first_name: string
  last_name: string | null
  company: string | null
  company_id: string | null
  role: string | null
  phone: string | null
  email: string | null
  linkedin_url: string | null
  relationship_status: RelationshipStatus
  icp_fit: IcpFit
  lead_source: LeadSource
  referred_by: string | null // contact ID of referrer
  tags: string[]
  general_notes: string | null
  last_contact_date: string | null
  next_action: string | null
  next_action_date: string | null
  created_at: string
  updated_at: string
}

export interface TimelineEntry {
  id: string
  user_id: string
  contact_id: string
  entry_type: EntryType
  title: string | null
  content: string | null
  ai_summary: string | null
  outcome: string | null
  next_step: string | null
  next_step_date: string | null
  entry_date: string
  created_at: string
}

export interface Offer {
  id: string
  user_id: string
  name: string
  description: string | null
  price_from: number
  price_to: number | null         // null = fixed price (use price_from)
  delivery_type: DeliveryType
  revenue_type: RevenueType
  typical_duration_months: number | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface StageTransition {
  stage: OpportunityStage
  entered_at: string // ISO timestamp
}

export interface Opportunity {
  id: string
  user_id: string
  contact_id: string | null
  company: string | null
  company_id: string | null
  title: string
  offer_id: string | null
  stage: OpportunityStage
  stage_history: StageTransition[]
  estimated_value: number
  monthly_value: number | null       // for recurring: monthly amount
  revenue_type: RevenueType
  confidence: ConfidenceLevel
  expected_close_date: string | null // YYYY-MM-DD
  decision_maker_id: string | null   // contact ID of decision maker
  next_step: string | null
  next_step_date: string | null
  proposal_sent_date: string | null  // YYYY-MM-DD
  proposal_value: number | null
  win_reason: string | null
  loss_reason: string | null
  notes: string | null
  khalsa_pain_identified: boolean
  khalsa_decision_process_clear: boolean
  khalsa_resources_confirmed: boolean
  khalsa_champion_identified: boolean
  khalsa_yellow_lights: string | null
  created_at: string
  updated_at: string
}

// ============================================
// Year Plan
// ============================================

export interface ConversionAssumptions {
  lead_to_qualified: number     // 0-100 percentage
  qualified_to_discovery: number
  discovery_to_proposal: number
  proposal_to_won: number
}

export interface OfferTarget {
  offer_id: string
  target_count: number
  target_revenue: number
}

export interface YearPlan {
  id: string
  user_id: string
  year: number
  revenue_target: number
  avg_deal_size: number
  target_new_clients: number
  target_upsells: number
  pct_revenue_existing: number  // 0-100
  pct_revenue_new: number       // 0-100
  offer_targets: OfferTarget[]  // per-offer breakdown
  // Conversion rates by lead source
  conversions_cold: ConversionAssumptions
  conversions_warm: ConversionAssumptions
  conversions_existing: ConversionAssumptions
  // Quarterly adjustments (weights, e.g. Q1=20%, Q2=25%, Q3=25%, Q4=30%)
  quarterly_weights: [number, number, number, number]
  notes: string | null
  created_at: string
  updated_at: string
}

// ============================================
// Joined types
// ============================================

export interface ContactWithDetails extends Contact {
  opportunities?: Opportunity[]
  timeline_entries?: TimelineEntry[]
}

// ============================================
// Sync queue
// ============================================

export interface SyncQueueItem {
  id?: number
  table_name: 'contacts' | 'timeline_entries' | 'opportunities' | 'companies' | 'offers'
  record_id: string
  action: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  created_at: string
  /** 0 = pending, 1 = synced, 2 = failed */
  synced: number | boolean
  retry_count?: number
}

// ============================================
// Label maps for display
// ============================================

export const STATUS_LABELS: Record<RelationshipStatus, string> = {
  dormant: 'Dormant',
  warming: 'Warming',
  active: 'Active',
  client: 'Client',
  past_client: 'Past Client',
}

export const ICP_LABELS: Record<IcpFit, string> = {
  strong: 'Strong Fit',
  moderate: 'Moderate Fit',
  weak: 'Weak Fit',
  not_assessed: 'Not Assessed',
}

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  referral: 'Referral',
  inbound: 'Inbound',
  networking: 'Networking',
  cold_outreach: 'Cold Outreach',
  existing_client: 'Existing Client',
  other: 'Other',
}

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  note: 'Note',
  meeting: 'Meeting',
  call: 'Call',
  email: 'Email',
  transcript: 'Transcript',
}

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  lead: 'Lead',
  warming: 'Warming',
  discovery: 'Discovery',
  proposal: 'Proposal',
  active_client: 'Active Client',
  paused: 'Paused',
  lost: 'Lost',
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  project: 'Project',
  retainer: 'Retainer',
  advisory: 'Advisory',
}

export const REVENUE_TYPE_LABELS: Record<RevenueType, string> = {
  one_time: 'One-time',
  recurring: 'Recurring',
}

export const WIN_REASON_OPTIONS = [
  'Strong relationship / trust',
  'Pain was acute and urgent',
  'No real competition',
  'Referral carried weight',
  'Price was right',
  'Track record / case studies',
  'Other',
] as const

export const LOSS_REASON_OPTIONS = [
  'Lost on price',
  'Lost to competitor',
  'No budget / not a priority',
  'Decision maker changed',
  'Timing — delayed indefinitely',
  'Poor qualification (should not have pursued)',
  'Relationship not strong enough',
  'Other',
] as const

// Active pipeline stages (for kanban board)
export const ACTIVE_STAGES: OpportunityStage[] = [
  'lead', 'warming', 'discovery', 'proposal', 'active_client',
]
