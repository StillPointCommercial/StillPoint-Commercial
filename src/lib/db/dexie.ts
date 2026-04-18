import Dexie, { type EntityTable } from 'dexie'
import type { Contact, TimelineEntry, Opportunity, SyncQueueItem, YearPlan, Company, Offer } from '@/lib/types'

class StillPointDB extends Dexie {
  contacts!: EntityTable<Contact, 'id'>
  timeline_entries!: EntityTable<TimelineEntry, 'id'>
  opportunities!: EntityTable<Opportunity, 'id'>
  sync_queue!: EntityTable<SyncQueueItem, 'id'>
  year_plans!: EntityTable<YearPlan, 'id'>
  companies!: EntityTable<Company, 'id'>
  offers!: EntityTable<Offer, 'id'>

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

    // v4: Add companies, offers tables + new fields on contacts/opportunities/year_plans
    this.version(4).stores({
      contacts: 'id, user_id, relationship_status, next_action_date, last_contact_date, company, lead_source, company_id',
      timeline_entries: 'id, contact_id, user_id, entry_date, entry_type',
      opportunities: 'id, user_id, contact_id, stage, offer_id, company_id, expected_close_date',
      sync_queue: '++id, table_name, record_id, synced, created_at',
      year_plans: 'id, user_id, year',
      companies: 'id, user_id, name',
      offers: 'id, user_id, is_active, sort_order',
    }).upgrade(tx => {
      return Promise.all([
        tx.table('contacts').toCollection().modify(contact => {
          if (contact.company_id === undefined) contact.company_id = null
        }),
        tx.table('opportunities').toCollection().modify(opp => {
          if (opp.offer_id === undefined) opp.offer_id = null
          if (opp.company_id === undefined) opp.company_id = null
          if (opp.revenue_type === undefined) opp.revenue_type = 'one_time'
          if (opp.monthly_value === undefined) opp.monthly_value = null
          if (opp.expected_close_date === undefined) opp.expected_close_date = null
          if (opp.decision_maker_id === undefined) opp.decision_maker_id = null
          if (opp.next_step === undefined) opp.next_step = null
          if (opp.next_step_date === undefined) opp.next_step_date = null
          if (opp.win_reason === undefined) opp.win_reason = null
          if (opp.loss_reason === undefined) opp.loss_reason = null
        }),
        tx.table('year_plans').toCollection().modify(plan => {
          if (plan.offer_targets === undefined) plan.offer_targets = []
        }),
      ])
    })

    // v5: Add proposal tracking fields on opportunities
    this.version(5).stores({
      contacts: 'id, user_id, relationship_status, next_action_date, last_contact_date, company, lead_source, company_id',
      timeline_entries: 'id, contact_id, user_id, entry_date, entry_type',
      opportunities: 'id, user_id, contact_id, stage, offer_id, company_id, expected_close_date',
      sync_queue: '++id, table_name, record_id, synced, created_at',
      year_plans: 'id, user_id, year',
      companies: 'id, user_id, name',
      offers: 'id, user_id, is_active, sort_order',
    }).upgrade(tx => {
      return tx.table('opportunities').toCollection().modify(opp => {
        if (opp.proposal_sent_date === undefined) opp.proposal_sent_date = null
        if (opp.proposal_value === undefined) opp.proposal_value = null
      })
    })
  }
}

export const db = new StillPointDB()
