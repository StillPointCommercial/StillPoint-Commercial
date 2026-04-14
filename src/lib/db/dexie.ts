import Dexie, { type EntityTable } from 'dexie'
import type { Contact, TimelineEntry, Opportunity, SyncQueueItem, YearPlan } from '@/lib/types'

class StillPointDB extends Dexie {
  contacts!: EntityTable<Contact, 'id'>
  timeline_entries!: EntityTable<TimelineEntry, 'id'>
  opportunities!: EntityTable<Opportunity, 'id'>
  sync_queue!: EntityTable<SyncQueueItem, 'id'>
  year_plans!: EntityTable<YearPlan, 'id'>

  constructor() {
    super('StillPointCIS')

    this.version(1).stores({
      contacts: 'id, user_id, relationship_status, next_action_date, last_contact_date, company',
      timeline_entries: 'id, contact_id, user_id, entry_date, entry_type',
      opportunities: 'id, user_id, contact_id, stage',
      sync_queue: '++id, table_name, record_id, synced, created_at',
    })

    this.version(2).stores({
      contacts: 'id, user_id, relationship_status, next_action_date, last_contact_date, company, lead_source',
      timeline_entries: 'id, contact_id, user_id, entry_date, entry_type',
      opportunities: 'id, user_id, contact_id, stage',
      sync_queue: '++id, table_name, record_id, synced, created_at',
      year_plans: 'id, user_id, year',
    }).upgrade(tx => {
      // Backfill new Contact fields
      return tx.table('contacts').toCollection().modify(contact => {
        if (contact.lead_source === undefined) contact.lead_source = 'other'
        if (contact.referred_by === undefined) contact.referred_by = null
      })
    })

    this.version(3).stores({
      contacts: 'id, user_id, relationship_status, next_action_date, last_contact_date, company, lead_source',
      timeline_entries: 'id, contact_id, user_id, entry_date, entry_type',
      opportunities: 'id, user_id, contact_id, stage',
      sync_queue: '++id, table_name, record_id, synced, created_at',
      year_plans: 'id, user_id, year',
    }).upgrade(tx => {
      // Backfill stage_history on existing opportunities
      return tx.table('opportunities').toCollection().modify(opp => {
        if (opp.stage_history === undefined) {
          opp.stage_history = [{ stage: opp.stage, entered_at: opp.created_at }]
        }
      })
    })
  }
}

export const db = new StillPointDB()
