'use client'

import { WifiOff } from 'lucide-react'

interface OfflineBannerProps {
  isOnline: boolean
  pendingCount: number
}

export function OfflineBanner({ isOnline, pendingCount }: OfflineBannerProps) {
  if (isOnline) return null

  return (
    <div className="bg-caution-amber/10 border-b border-caution-amber/30 px-4 py-2 flex items-center gap-2 text-sm">
      <WifiOff size={16} className="text-caution-amber shrink-0" />
      <span className="text-charcoal-light">
        You are offline.
        {pendingCount > 0 && ` ${pendingCount} change${pendingCount > 1 ? 's' : ''} will sync when connection is restored.`}
      </span>
    </div>
  )
}
