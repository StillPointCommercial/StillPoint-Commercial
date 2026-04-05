import { db } from './dexie'
import type { TimelineEntry } from '@/lib/types'

function enqueue(action: 'create' | 'update' | 'delete', record_id: string, payload: Record<string, unknown>) {
  return db.sync_queue.add({
    table_name: 'timeline_entries',
    record_id,
    action,
    payload,
    created_at: new Date().toISOString(),
    synced: 0 as unknown as boolean,
    retry_count: 0,
  })
}

function enqueueContactUpdate(record_id: string, payload: Record<string, unknown>) {
  return db.sync_queue.add({
    table_name: 'contacts',
    record_id,
    action: 'update',
    payload,
    created_at: new Date().toISOString(),
    synced: 0 as unknown as boolean,
    retry_count: 0,
  })
}

export async function getTimelineForContact(contactId: string): Promise<TimelineEntry[]> {
  const entries = await db.timeline_entries
    .where('contact_id')
    .equals(contactId)
    .toArray()

  return entries.sort((a, b) => b.entry_date.localeCompare(a.entry_date))
}

export async function getRecentTimeline(limit: number = 10): Promise<TimelineEntry[]> {
  const entries = await db.timeline_entries.toArray()
  return entries
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
}

export async function createTimelineEntry(
  data: Omit<TimelineEntry, 'id' | 'created_at'>
): Promise<TimelineEntry> {
  const entry: TimelineEntry = {
    ...data,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  }

  await db.timeline_entries.add(entry)
  await enqueue('create', entry.id, entry as unknown as Record<string, unknown>)

  // Update last_contact_date on the contact
  const contact = await db.contacts.get(data.contact_id)
  if (contact) {
    const currentLast = contact.last_contact_date
    if (!currentLast || data.entry_date > currentLast) {
      const contactUpdates = {
        last_contact_date: data.entry_date,
        updated_at: new Date().toISOString(),
      }
      await db.contacts.update(data.contact_id, contactUpdates)
      await enqueueContactUpdate(data.contact_id, contactUpdates)
    }
  }

  return entry
}

export async function updateTimelineEntry(id: string, data: Partial<TimelineEntry>): Promise<void> {
  await db.timeline_entries.update(id, data)
  await enqueue('update', id, data as Record<string, unknown>)
}

export async function deleteTimelineEntry(id: string): Promise<void> {
  await db.timeline_entries.delete(id)
  await enqueue('delete', id, {})
}
