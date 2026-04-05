import Dexie, { type EntityTable } from 'dexie'
import type { Contact, TimelineEntry, Opportunity, SyncQueueItem } from '@/lib/types'

class StillPointDB extends Dexie {
  contacts!: EntityTable<Contact, 'id'>
  timeline_entries!: EntityTable<TimelineEntry, 'id'>
  opportunities!: EntityTable<Opportunity, 'id'>
  sync_queue!: EntityTable<SyncQueueItem, 'id'>

  constructor() {
    super('StillPointCIS')
    this.version(1).stores({
      contacts: 'id, user_id, relationship_status, next_action_date, last_contact_date, company',
      timeline_entries: 'id, contact_id, user_id, entry_date, entry_type',
      opportunities: 'id, user_id, contact_id, stage',
      sync_queue: '++id, table_name, record_id, synced, created_at',
    })
  }
}

export const db = new StillPointDB()
