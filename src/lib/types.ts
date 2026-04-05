// ============================================
// Enum types (matching Supabase enums)
// ============================================

export type RelationshipStatus = 'dormant' | 'warming' | 'active' | 'client' | 'past_client'
export type IcpFit = 'strong' | 'moderate' | 'weak' | 'not_assessed'
export type EntryType = 'note' | 'meeting' | 'call' | 'email' | 'transcript'
export type OpportunityStage = 'lead' | 'warming' | 'discovery' | 'proposal' | 'active_client' | 'paused' | 'lost'
export type ConfidenceLevel = 'low' | 'medium' | 'high'

// ============================================
// Data models
// ============================================

export interface Contact {
  id: string
  user_id: string
  first_name: string
  last_name: string | null
  company: string | null
  role: string | null
  phone: string | null
  email: string | null
  linkedin_url: string | null
  relationship_status: RelationshipStatus
  icp_fit: IcpFit
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

export interface Opportunity {
  id: string
  user_id: string
  contact_id: string | null
  company: string | null
  title: string
  stage: OpportunityStage
  estimated_value: number
  confidence: ConfidenceLevel
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
  table_name: 'contacts' | 'timeline_entries' | 'opportunities'
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

// Active pipeline stages (for kanban board)
export const ACTIVE_STAGES: OpportunityStage[] = [
  'lead', 'warming', 'discovery', 'proposal', 'active_client',
]
