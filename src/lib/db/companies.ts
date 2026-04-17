import { db } from './dexie'
import type { Company } from '@/lib/types'

function enqueue(action: 'create' | 'update' | 'delete', record_id: string, payload: Record<string, unknown>) {
  return db.sync_queue.add({
    table_name: 'companies',
    record_id,
    action,
    payload,
    created_at: new Date().toISOString(),
    synced: 0 as unknown as boolean,
    retry_count: 0,
  })
}

export async function getCompanies(): Promise<Company[]> {
  return db.companies.toArray()
}

export async function getCompany(id: string): Promise<Company | undefined> {
  return db.companies.get(id)
}

export async function findOrCreateCompany(userId: string, name: string): Promise<Company> {
  // Check if company with this name already exists (case-insensitive)
  const all = await db.companies.toArray()
  const existing = all.find(c => c.name.toLowerCase() === name.toLowerCase())
  if (existing) return existing

  const now = new Date().toISOString()
  const company: Company = {
    id: crypto.randomUUID(),
    user_id: userId,
    name,
    industry: null,
    website: null,
    notes: null,
    created_at: now,
    updated_at: now,
  }
  await db.companies.add(company)
  await enqueue('create', company.id, company as unknown as Record<string, unknown>)
  return company
}

export async function updateCompany(id: string, data: Partial<Company>): Promise<void> {
  const updates = { ...data, updated_at: new Date().toISOString() }
  await db.companies.update(id, updates)
  await enqueue('update', id, updates as Record<string, unknown>)
}

export async function deleteCompany(id: string): Promise<void> {
  await db.companies.delete(id)
  await enqueue('delete', id, {})
}
