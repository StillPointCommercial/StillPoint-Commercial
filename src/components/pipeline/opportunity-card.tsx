'use client'

import type { Opportunity, Contact } from '@/lib/types'
import { ConfidenceBadge } from '@/components/ui/badge'
import { MessageCircle, Calendar, ArrowRight } from 'lucide-react'

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

interface OpportunityCardProps {
  opportunity: Opportunity
  contact?: Contact
  onEdit: (opp: Opportunity) => void
  onDragStart?: (e: React.DragEvent, opp: Opportunity) => void
  interactionCount?: number
}

export function OpportunityCard({ opportunity, contact, onEdit, onDragStart, interactionCount }: OpportunityCardProps) {
  const score = khalsaScore(opportunity)
  const closeDateOverdue = isOverdue(opportunity.expected_close_date)
  const nextStepOverdue = isOverdue(opportunity.next_step_date)

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

      {/* Close date */}
      {opportunity.expected_close_date && (
        <div className={`flex items-center gap-1 mt-1 text-[10px] ${closeDateOverdue ? 'text-attention-red' : 'text-text-light'}`}>
          <Calendar size={9} />
          <span>Close {opportunity.expected_close_date.slice(5)}</span>
        </div>
      )}

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
        {interactionCount !== undefined && (
          <span className="text-[10px] text-warm-gray flex items-center gap-0.5">
            <MessageCircle size={9} />
            {interactionCount}
          </span>
        )}
      </div>
    </div>
  )
}
