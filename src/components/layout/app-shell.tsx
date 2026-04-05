'use client'

import { Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'
import { OfflineBanner } from './offline-banner'
import { useSync } from '@/lib/hooks/use-sync'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isOnline, pendingCount } = useSync()

  return (
    <div className="flex min-h-screen bg-warm-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} />
        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
