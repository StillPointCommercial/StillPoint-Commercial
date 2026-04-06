'use client'

import Link from 'next/link'
import { CalendarCheck, ArrowRight, Calendar } from 'lucide-react'
import type { PlannedAction } from '@/lib/hooks/use-dashboard-data'

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function dayLabel(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return formatDate(dateStr)
}

function ActionCard({ action }: { action: PlannedAction }) {
  return (
    <Link
      href={`/contacts/${action.contactId}`}
      className="flex items-center justify-between bg-cream border border-border rounded-card p-3 hover:border-terracotta-muted transition-colors group"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-charcoal truncate">
          <span className="font-medium">{action.contactName}</span>
          {action.company && <span className="text-text-light"> &middot; {action.company}</span>}
        </p>
        <p className="text-xs text-text-light mt-0.5 truncate">{action.action}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <span className="text-xs text-muted-bronze">{dayLabel(action.date)}</span>
        <ArrowRight size={12} className="text-warm-gray group-hover:text-terracotta transition-colors" />
      </div>
    </Link>
  )
}

interface PlannedActionsProps {
  today: PlannedAction[]
  week: PlannedAction[]
  later: PlannedAction[]
  overdueCount: number
}

export function PlannedActions({ today, week, later, overdueCount }: PlannedActionsProps) {
  const hasAny = today.length > 0 || week.length > 0 || later.length > 0

  if (!hasAny && overdueCount === 0) return null

  return (
    <div className="mb-6">
      <h2 className="font-dm-serif text-lg text-charcoal mb-3 flex items-center gap-2">
        <CalendarCheck size={18} className="text-terracotta" />
        Planned Actions
      </h2>

      {!hasAny && (
        <p className="text-sm text-text-light py-4 text-center">
          No upcoming actions scheduled. Add next steps to your contacts or timeline entries.
        </p>
      )}

      {today.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-charcoal bg-terracotta/10 px-2 py-0.5 rounded-badge">
              Today
            </span>
            <span className="text-xs text-text-light">{today.length} {today.length === 1 ? 'action' : 'actions'}</span>
          </div>
          <div className="space-y-2">
            {today.map((a, i) => <ActionCard key={`today-${i}`} action={a} />)}
          </div>
        </div>
      )}

      {week.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-charcoal-light flex items-center gap-1">
              <Calendar size={12} />
              This Week
            </span>
            <span className="text-xs text-text-light">{week.length} {week.length === 1 ? 'action' : 'actions'}</span>
          </div>
          <div className="space-y-2">
            {week.map((a, i) => <ActionCard key={`week-${i}`} action={a} />)}
          </div>
        </div>
      )}

      {later.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-text-light">Later</span>
            <span className="text-xs text-text-light">{later.length} {later.length === 1 ? 'action' : 'actions'}</span>
          </div>
          <div className="space-y-2">
            {later.slice(0, 5).map((a, i) => <ActionCard key={`later-${i}`} action={a} />)}
            {later.length > 5 && (
              <p className="text-xs text-text-light text-center py-1">
                +{later.length - 5} more planned
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
