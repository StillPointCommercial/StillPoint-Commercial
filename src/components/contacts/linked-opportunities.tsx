'use client'

import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import { useOpportunitiesForContact } from '@/lib/hooks/use-opportunities'
import { STAGE_LABELS } from '@/lib/types'
import type { Opportunity } from '@/lib/types'
import { Badge, ConfidenceBadge } from '@/components/ui/badge'
import { Briefcase, MessageCircle, Clock, ArrowRight, Calendar } from 'lucide-react'

function khalsaColor(opp: { khalsa_pain_identified: boolean; khalsa_decision_process_clear: boolean; khalsa_resources_confirmed: boolean; khalsa_champion_identified: boolean }) {
  const count = [opp.khalsa_pain_identified, opp.khalsa_decision_process_clear, opp.khalsa_resources_confirmed, opp.khalsa_champion_identified].filter(Boolean).length
  if (count >= 4) return 'border-l-success-green'
  if (count >= 2) return 'border-l-caution-amber'
  return 'border-l-attention-red'
}

function daysInCurrentStage(opp: Opportunity): number | null {
  if (!opp.stage_history || opp.stage_history.length === 0) return null
  const lastTransition = opp.stage_history[opp.stage_history.length - 1]
  const enteredAt = new Date(lastTransition.entered_at)
  return Math.floor((new Date().getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24))
}

export function LinkedOpportunities({ contactId }: { contactId: string }) {
  const opportunities = useOpportunitiesForContact(contactId)

  // Count interactions for this contact
  const interactionCount = useLiveQuery(
    () => db.timeline_entries.where('contact_id').equals(contactId).count(),
    [contactId]
  ) ?? 0

  if (opportunities.length === 0) return null

  // Split into active pipeline and closed/paused
  const active = opportunities.filter(o => o.stage !== 'lost' && o.stage !== 'paused')
  const closed = opportunities.filter(o => o.stage === 'lost' || o.stage === 'paused')
  const totalValue = active.reduce((sum, o) => sum + (o.estimated_value || 0), 0)

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-dm-serif text-lg text-charcoal flex items-center gap-2">
          <Briefcase size={18} />
          Opportunities
        </h3>
        {totalValue > 0 && (
          <span className="text-sm text-text-light">
            Total: <span className="font-medium text-charcoal">&euro;{totalValue.toLocaleString()}</span>
          </span>
        )}
      </div>
      <div className="space-y-2">
        {active.map(opp => {
          const days = daysInCurrentStage(opp)
          return (
            <div
              key={opp.id}
              className={`bg-cream border border-border rounded-card p-4 border-l-4 ${khalsaColor(opp)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium text-sm text-charcoal">{opp.title}</h4>
                  {opp.company && <p className="text-xs text-text-light">{opp.company}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{STAGE_LABELS[opp.stage]}</Badge>
                  <ConfidenceBadge confidence={opp.confidence} />
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                  {opp.estimated_value > 0 && (
                    <span className="text-sm font-medium text-charcoal">
                      &euro;{opp.estimated_value.toLocaleString()}
                    </span>
                  )}
                  {days !== null && days > 0 && (
                    <span className={`text-xs flex items-center gap-0.5 ${days >= 30 ? 'text-attention-red' : days >= 14 ? 'text-caution-amber' : 'text-text-light'}`}>
                      <Clock size={10} />
                      {days}d in stage
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-bronze flex items-center gap-1">
                  <MessageCircle size={10} />
                  {interactionCount}
                </span>
              </div>
              {opp.next_step && (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-text-light">
                  <ArrowRight size={10} />
                  <span className="truncate">{opp.next_step}</span>
                  {opp.next_step_date && <span className="ml-auto text-[10px]">{opp.next_step_date.slice(5)}</span>}
                </div>
              )}
              {opp.expected_close_date && (
                <div className={`flex items-center gap-1 mt-1 text-xs ${opp.expected_close_date < new Date().toISOString().split('T')[0] ? 'text-attention-red' : 'text-text-light'}`}>
                  <Calendar size={10} />
                  <span>Close {opp.expected_close_date}</span>
                </div>
              )}
            </div>
          )
        })}

        {closed.length > 0 && (
          <div className="pt-2">
            <p className="text-xs text-text-light mb-2">Closed / Paused</p>
            {closed.map(opp => (
              <div key={opp.id} className="bg-cream border border-border rounded-card p-3 opacity-60">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-charcoal">{opp.title}</span>
                  <Badge>{STAGE_LABELS[opp.stage]}</Badge>
                </div>
                {opp.estimated_value > 0 && (
                  <span className="text-xs text-text-light">&euro;{opp.estimated_value.toLocaleString()}</span>
                )}
                {(opp.win_reason || opp.loss_reason) && (
                  <p className="text-xs text-text-light mt-1">{opp.win_reason || opp.loss_reason}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Link href="/pipeline" className="text-xs text-terracotta hover:text-[#a07860] mt-3 inline-block">
        View full pipeline &rarr;
      </Link>
    </div>
  )
}
