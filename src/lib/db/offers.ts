import { db } from './dexie'
import type { Offer } from '@/lib/types'

function enqueue(action: 'create' | 'update' | 'delete', record_id: string, payload: Record<string, unknown>) {
  return db.sync_queue.add({
    table_name: 'offers',
    record_id,
    action,
    payload,
    created_at: new Date().toISOString(),
    synced: 0 as unknown as boolean,
    retry_count: 0,
  })
}

export async function getOffers(activeOnly = false): Promise<Offer[]> {
  let results = await db.offers.toArray()
  if (activeOnly) {
    results = results.filter(o => o.is_active)
  }
  return results.sort((a, b) => a.sort_order - b.sort_order)
}

export async function getOffer(id: string): Promise<Offer | undefined> {
  return db.offers.get(id)
}

export async function createOffer(data: Omit<Offer, 'id' | 'created_at' | 'updated_at'>): Promise<Offer> {
  const now = new Date().toISOString()
  const offer: Offer = {
    ...data,
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
  }
  await db.offers.add(offer)
  await enqueue('create', offer.id, offer as unknown as Record<string, unknown>)
  return offer
}

export async function updateOffer(id: string, data: Partial<Offer>): Promise<void> {
  const updates = { ...data, updated_at: new Date().toISOString() }
  await db.offers.update(id, updates)
  await enqueue('update', id, updates as Record<string, unknown>)
}

export async function deleteOffer(id: string): Promise<void> {
  await db.offers.delete(id)
  await enqueue('delete', id, {})
}
