'use client'

import Link from 'next/link'
import { Briefcase, ArrowRight, Calendar } from 'lucide-react'
import { STAGE_LABELS } from '@/lib/types'
import type { DealAction } from '@/lib/hooks/use-dashboard-data'

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

function DealActionCard({ action }: { action: DealAction }) {
  return (
    <Link
      href={action.contactId ? `/contacts/${action.contactId}` : '/pipeline'}
      className="flex items-center justify-between bg-cream border border-border rounded-card p-3 hover:border-terracotta-muted transition-colors group"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-charcoal truncate">
          <span className="font-medium">{action.dealTitle}</span>
          <span className="text-text-light"> &middot; {action.contactName}</span>
        </p>
        <p className="text-xs text-text-light mt-0.5 truncate">{action.action}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-bronze">{STAGE_LABELS[action.stage as keyof typeof STAGE_LABELS] || action.stage}</span>
          {action.estimatedValue > 0 && (
            <span className="text-[10px] font-medium text-charcoal">&euro;{action.estimatedValue.toLocaleString()}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <span className="text-xs text-muted-bronze">{dayLabel(action.date)}</span>
        <ArrowRight size={12} className="text-warm-gray group-hover:text-terracotta transition-colors" />
      </div>
    </Link>
  )
}

interface DealActionsProps {
  today: DealAction[]
  week: DealAction[]
  later: DealAction[]
}

export function DealActions({ today, week, later }: DealActionsProps) {
  const hasAny = today.length > 0 || week.length > 0 || later.length > 0

  if (!hasAny) return null

  return (
    <div className="mb-6">
      <h2 className="font-dm-serif text-lg text-charcoal mb-3 flex items-center gap-2">
        <Briefcase size={18} className="text-terracotta" />
        Deal Actions
      </h2>

      {today.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-charcoal bg-terracotta/10 px-2 py-0.5 rounded-badge">
              Today
            </span>
            <span className="text-xs text-text-light">{today.length} {today.length === 1 ? 'action' : 'actions'}</span>
          </div>
          <div className="space-y-2">
            {today.map((a, i) => <DealActionCard key={`deal-today-${i}`} action={a} />)}
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
            {week.map((a, i) => <DealActionCard key={`deal-week-${i}`} action={a} />)}
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
            {later.slice(0, 5).map((a, i) => <DealActionCard key={`deal-later-${i}`} action={a} />)}
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
