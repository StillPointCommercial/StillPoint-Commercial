'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { syncAll, getPendingSyncCount } from '@/lib/db/sync'

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const syncingRef = useRef(false)

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return
    syncingRef.current = true
    setIsSyncing(true)

    try {
      await syncAll()
      setLastSyncedAt(new Date())
      const count = await getPendingSyncCount()
      setPendingCount(count)
    } catch (e) {
      console.error('Sync failed:', e)
    } finally {
      syncingRef.current = false
      setIsSyncing(false)
    }
  }, [])

  useEffect(() => {
    setIsOnline(navigator.onLine)

    function handleOnline() {
      setIsOnline(true)
      syncNow()
    }
    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial sync
    if (navigator.onLine) {
      syncNow()
    }

    // Periodic sync every 60 seconds
    const interval = setInterval(() => {
      if (navigator.onLine) syncNow()
    }, 60_000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [syncNow])

  // Update pending count periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      const count = await getPendingSyncCount()
      setPendingCount(count)
    }, 5_000)
    return () => clearInterval(interval)
  }, [])

  return { isSyncing, isOnline, pendingCount, lastSyncedAt, syncNow }
}
