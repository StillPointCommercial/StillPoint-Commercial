import { db } from './dexie'
import type { Contact, RelationshipStatus, IcpFit } from '@/lib/types'

function enqueue(action: 'create' | 'update' | 'delete', record_id: string, payload: Record<string, unknown>) {
  return db.sync_queue.add({
    table_name: 'contacts',
    record_id,
    action,
    payload,
    created_at: new Date().toISOString(),
    synced: 0 as unknown as boolean,
    retry_count: 0,
  })
}

export interface ContactFilters {
  search?: string
  status?: RelationshipStatus
  icp?: IcpFit
  tag?: string
}

export async function getContacts(filters?: ContactFilters): Promise<Contact[]> {
  let collection = db.contacts.toCollection()

  let results = await collection.toArray()

  if (filters?.status) {
    results = results.filter(c => c.relationship_status === filters.status)
  }
  if (filters?.icp) {
    results = results.filter(c => c.icp_fit === filters.icp)
  }
  if (filters?.tag) {
    results = results.filter(c => c.tags.includes(filters.tag!))
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    results = results.filter(c =>
      c.first_name.toLowerCase().includes(q) ||
      (c.last_name?.toLowerCase().includes(q)) ||
      (c.company?.toLowerCase().includes(q)) ||
      c.tags.some(t => t.toLowerCase().includes(q))
    )
  }

  return results.sort((a, b) => {
    const aDate = a.last_contact_date || '1970-01-01'
    const bDate = b.last_contact_date || '1970-01-01'
    return aDate.localeCompare(bDate)
  })
}

export async function getContact(id: string): Promise<Contact | undefined> {
  return db.contacts.get(id)
}

export async function createContact(data: Omit<Contact, 'id' | 'created_at' | 'updated_at'>): Promise<Contact> {
  const now = new Date().toISOString()
  const contact: Contact = {
    ...data,
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
  }

  await db.contacts.add(contact)
  await enqueue('create', contact.id, contact as unknown as Record<string, unknown>)
  return contact
}

export async function updateContact(id: string, data: Partial<Contact>): Promise<void> {
  const updates = { ...data, updated_at: new Date().toISOString() }
  await db.contacts.update(id, updates)
  await enqueue('update', id, updates as Record<string, unknown>)
}

export async function deleteContact(id: string): Promise<void> {
  // Enqueue deletes for related timeline entries
  const timelineEntries = await db.timeline_entries.where('contact_id').equals(id).toArray()
  for (const entry of timelineEntries) {
    await db.sync_queue.add({
      table_name: 'timeline_entries',
      record_id: entry.id,
      action: 'delete',
      payload: {},
      created_at: new Date().toISOString(),
      synced: 0 as unknown as boolean,
      retry_count: 0,
    })
  }

  // Enqueue deletes for related opportunities
  const opportunities = await db.opportunities.where('contact_id').equals(id).toArray()
  for (const opp of opportunities) {
    await db.sync_queue.add({
      table_name: 'opportunities',
      record_id: opp.id,
      action: 'delete',
      payload: {},
      created_at: new Date().toISOString(),
      synced: 0 as unknown as boolean,
      retry_count: 0,
    })
  }

  // Delete locally
  await db.timeline_entries.where('contact_id').equals(id).delete()
  await db.opportunities.where('contact_id').equals(id).delete()
  await db.contacts.delete(id)

  // Enqueue contact delete
  await enqueue('delete', id, {})
}
