'use client'

import type { Opportunity, Contact } from '@/lib/types'
import { CONFIDENCE_LABELS } from '@/lib/types'
import { ConfidenceBadge } from '@/components/ui/badge'

function khalsaScore(opp: Opportunity): number {
  return [opp.khalsa_pain_identified, opp.khalsa_decision_process_clear, opp.khalsa_resources_confirmed, opp.khalsa_champion_identified].filter(Boolean).length
}

function khalsaBorderColor(score: number): string {
  if (score >= 4) return 'border-l-success-green'
  if (score >= 2) return 'border-l-caution-amber'
  return 'border-l-attention-red'
}

interface OpportunityCardProps {
  opportunity: Opportunity
  contact?: Contact
  onEdit: (opp: Opportunity) => void
  onDragStart?: (e: React.DragEvent, opp: Opportunity) => void
}

export function OpportunityCard({ opportunity, contact, onEdit, onDragStart }: OpportunityCardProps) {
  const score = khalsaScore(opportunity)

  return (
    <div
      draggable
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
        {opportunity.estimated_value > 0 && (
          <span className="text-sm font-medium text-charcoal">
            &euro;{opportunity.estimated_value.toLocaleString()}
          </span>
        )}
        <ConfidenceBadge confidence={opportunity.confidence} />
      </div>
      <div className="flex gap-1 mt-2">
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
    </div>
  )
}
