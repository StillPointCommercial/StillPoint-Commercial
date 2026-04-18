'use client'

import type { Opportunity, Contact } from '@/lib/types'
import { ConfidenceBadge } from '@/components/ui/badge'
import { MessageCircle, Calendar, ArrowRight, Clock } from 'lucide-react'

function khalsaScore(opp: Opportunity): number {
  return [opp.khalsa_pain_identified, opp.khalsa_decision_process_clear, opp.khalsa_resources_confirmed, opp.khalsa_champion_identified].filter(Boolean).length
}

function khalsaBorderColor(score: number): string {
  if (score >= 4) return 'border-l-success-green'
  if (score >= 2) return 'border-l-caution-amber'
  return 'border-l-attention-red'
}

function isOverdue(date: string | null): boolean {
  if (!date) return false
  return date < new Date().toISOString().split('T')[0]
}

/** Calculate days in current stage from stage_history */
function daysInCurrentStage(opp: Opportunity): number | null {
  if (!opp.stage_history || opp.stage_history.length === 0) return null
  const lastTransition = opp.stage_history[opp.stage_history.length - 1]
  const enteredAt = new Date(lastTransition.entered_at)
  const now = new Date()
  return Math.floor((now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24))
}

function agingColor(days: number): string {
  if (days >= 30) return 'text-attention-red'
  if (days >= 14) return 'text-caution-amber'
  return 'text-text-light'
}

interface OpportunityCardProps {
  opportunity: Opportunity
  contact?: Contact
  onEdit: (opp: Opportunity) => void
  onDragStart?: (e: React.DragEvent, opp: Opportunity) => void
  onQuickLog?: (opp: Opportunity) => void
  interactionCount?: number
}

export function OpportunityCard({ opportunity, contact, onEdit, onDragStart, onQuickLog, interactionCount }: OpportunityCardProps) {
  const score = khalsaScore(opportunity)
  const closeDateOverdue = isOverdue(opportunity.expected_close_date)
  const nextStepOverdue = isOverdue(opportunity.next_step_date)
  const daysInStage = daysInCurrentStage(opportunity)

  return (
    <div
      draggable={opportunity.stage !== 'active_client'}
      onDragStart={(e) => onDragStart?.(e, opportunity)}
      onClick={() => onEdit(opportunity)}
      className={`
        bg-warm-white border border-border rounded-card p-3 cursor-pointer
        hover:border-terracotta-muted transition-colors border-l-4
        ${khalsaBorderColor(score)}
      `}
    >
      <h4 className="font-medium text-sm text-charcoal truncate">{opportunity.title}</h4>
      {contact && (
        <p className="text-xs text-text-light truncate mt-0.5">
          {contact.first_name} {contact.last_name}
          {opportunity.company && ` · ${opportunity.company}`}
        </p>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {opportunity.estimated_value > 0 && (
            <span className="text-sm font-medium text-charcoal">
              &euro;{opportunity.estimated_value.toLocaleString()}
            </span>
          )}
          {opportunity.revenue_type === 'recurring' && opportunity.monthly_value && (
            <span className="text-[10px] text-text-light">&euro;{opportunity.monthly_value.toLocaleString()}/mo</span>
          )}
        </div>
        <ConfidenceBadge confidence={opportunity.confidence} />
      </div>

      {/* Next step */}
      {opportunity.next_step && (
        <div className={`flex items-center gap-1 mt-1.5 text-[10px] ${nextStepOverdue ? 'text-attention-red' : 'text-text-light'}`}>
          <ArrowRight size={9} />
          <span className="truncate">{opportunity.next_step}</span>
          {opportunity.next_step_date && (
            <span className="flex-shrink-0 ml-auto">{opportunity.next_step_date.slice(5)}</span>
          )}
        </div>
      )}

      {/* Close date + deal aging */}
      <div className="flex items-center gap-3 mt-1">
        {opportunity.expected_close_date && (
          <div className={`flex items-center gap-1 text-[10px] ${closeDateOverdue ? 'text-attention-red' : 'text-text-light'}`}>
            <Calendar size={9} />
            <span>Close {opportunity.expected_close_date.slice(5)}</span>
          </div>
        )}
        {daysInStage !== null && daysInStage > 0 && (
          <div className={`flex items-center gap-1 text-[10px] ${agingColor(daysInStage)}`}>
            <Clock size={9} />
            <span>{daysInStage}d in stage</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1">
          {['P', 'D', 'R', 'C'].map((letter, i) => {
            const checked = [opportunity.khalsa_pain_identified, opportunity.khalsa_decision_process_clear, opportunity.khalsa_resources_confirmed, opportunity.khalsa_champion_identified][i]
            return (
              <span
                key={letter}
                className={`text-[10px] w-5 h-5 flex items-center justify-center rounded-badge ${
                  checked ? 'bg-success-green/15 text-success-green' : 'bg-stone/20 text-warm-gray'
                }`}
              >
                {letter}
              </span>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          {onQuickLog && opportunity.contact_id && (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickLog(opportunity) }}
              className="text-[10px] text-warm-gray hover:text-terracotta flex items-center gap-0.5 transition-colors"
              title="Quick log"
            >
              <MessageCircle size={9} />+
            </button>
          )}
          {interactionCount !== undefined && (
            <span className="text-[10px] text-warm-gray flex items-center gap-0.5">
              <MessageCircle size={9} />
              {interactionCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
