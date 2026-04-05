import { db } from './dexie'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

const TABLES = ['contacts', 'timeline_entries', 'opportunities'] as const
const MAX_RETRY_COUNT = 5

/** Module-level guard to prevent concurrent syncs within the same tab */
let isSyncing = false

export async function pullFromSupabase() {
  if (!isSupabaseConfigured()) return
  const supabase = createClient()

  // Collect all record_ids that have pending local changes so we don't overwrite them
  const pendingItems = await db.sync_queue.where('synced').equals(0).toArray()
  const pendingKeys = new Set(pendingItems.map(item => `${item.table_name}:${item.record_id}`))

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) {
      console.error(`Pull error for ${table}:`, error.message)
      continue
    }
    if (data && data.length > 0) {
      for (const remoteRecord of data) {
        const key = `${table}:${remoteRecord.id}`

        // Skip records that have pending local changes
        if (pendingKeys.has(key)) {
          continue
        }

        // Compare updated_at timestamps — only overwrite if remote is newer
        const localRecord = await (db[table] as any).get(remoteRecord.id)
        if (localRecord) {
          const localUpdatedAt = localRecord.updated_at || localRecord.created_at
          const remoteUpdatedAt = remoteRecord.updated_at || remoteRecord.created_at
          if (remoteUpdatedAt && localUpdatedAt && remoteUpdatedAt <= localUpdatedAt) {
            // Local version is same or newer, skip
            continue
          }
        }

        await (db[table] as any).put(remoteRecord)
      }
    }
  }
}

export async function pushToSupabase() {
  if (!isSupabaseConfigured()) return

  // Multi-tab guard: prevent concurrent syncs
  if (isSyncing) {
    console.warn('Sync already in progress, skipping')
    return
  }

  isSyncing = true
  try {
    const supabase = createClient()
    const pending = await db.sync_queue
      .where('synced')
      .equals(0)
      .toArray()

    // Filter out items that have exceeded retry limit (should already be marked 2, but safety check)
    const retryable = pending
      .filter(item => (item.retry_count ?? 0) < MAX_RETRY_COUNT)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))

    for (const item of retryable) {
      let error: any = null

      try {
        if (item.action === 'create') {
          const result = await supabase.from(item.table_name).upsert(item.payload)
          error = result.error
        } else if (item.action === 'update') {
          const result = await supabase
            .from(item.table_name)
            .update(item.payload)
            .eq('id', item.record_id)
          error = result.error
        } else if (item.action === 'delete') {
          const result = await supabase
            .from(item.table_name)
            .delete()
            .eq('id', item.record_id)
          error = result.error
        }
      } catch (e) {
        console.error(`Sync error for ${item.table_name}/${item.record_id}:`, e)
        error = e
      }

      if (error) {
        const newRetryCount = (item.retry_count ?? 0) + 1
        if (newRetryCount >= MAX_RETRY_COUNT) {
          // Mark as permanently failed
          console.error(
            `Sync item ${item.table_name}/${item.record_id} failed after ${MAX_RETRY_COUNT} attempts, marking as failed`
          )
          await db.sync_queue.update(item.id!, { synced: 2, retry_count: newRetryCount })
        } else {
          console.warn(
            `Sync retry ${newRetryCount}/${MAX_RETRY_COUNT} for ${item.table_name}/${item.record_id}:`,
            typeof error === 'object' && error?.message ? error.message : error
          )
          await db.sync_queue.update(item.id!, { retry_count: newRetryCount })
        }
        continue
      }

      // Mark as synced
      await db.sync_queue.update(item.id!, { synced: 1 })
    }

    // Clean up only successfully synced items (synced === 1)
    await db.sync_queue.where('synced').equals(1).delete()
  } finally {
    isSyncing = false
  }
}

export async function syncAll() {
  await pushToSupabase()
  await pullFromSupabase()
}

/** Count of pending (unsynced, non-failed) items */
export async function getPendingSyncCount(): Promise<number> {
  return db.sync_queue.where('synced').equals(0).count()
}

/** Count of permanently failed items */
export async function getFailedSyncCount(): Promise<number> {
  return db.sync_queue.where('synced').equals(2).count()
}
