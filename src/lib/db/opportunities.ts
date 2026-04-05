import { db } from './dexie'
import type { Opportunity, OpportunityStage } from '@/lib/types'

function enqueue(action: 'create' | 'update' | 'delete', record_id: string, payload: Record<string, unknown>) {
  return db.sync_queue.add({
    table_name: 'opportunities',
    record_id,
    action,
    payload,
    created_at: new Date().toISOString(),
    synced: 0 as unknown as boolean,
    retry_count: 0,
  })
}

export async function getOpportunities(stage?: OpportunityStage): Promise<Opportunity[]> {
  if (stage) {
    return db.opportunities.where('stage').equals(stage).toArray()
  }
  return db.opportunities.toArray()
}

export async function getOpportunitiesForContact(contactId: string): Promise<Opportunity[]> {
  return db.opportunities.where('contact_id').equals(contactId).toArray()
}

export async function getOpportunity(id: string): Promise<Opportunity | undefined> {
  return db.opportunities.get(id)
}

export async function createOpportunity(
  data: Omit<Opportunity, 'id' | 'created_at' | 'updated_at'>
): Promise<Opportunity> {
  const now = new Date().toISOString()
  const opportunity: Opportunity = {
    ...data,
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
  }

  await db.opportunities.add(opportunity)
  await enqueue('create', opportunity.id, opportunity as unknown as Record<string, unknown>)
  return opportunity
}

export async function updateOpportunity(id: string, data: Partial<Opportunity>): Promise<void> {
  const updates = { ...data, updated_at: new Date().toISOString() }
  await db.opportunities.update(id, updates)
  await enqueue('update', id, updates as Record<string, unknown>)
}

export async function deleteOpportunity(id: string): Promise<void> {
  await db.opportunities.delete(id)
  await enqueue('delete', id, {})
}
