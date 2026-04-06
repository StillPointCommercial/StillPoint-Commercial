'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import { useOpportunitiesForContact } from '@/lib/hooks/use-opportunities'
import { STAGE_LABELS, CONFIDENCE_LABELS } from '@/lib/types'
import { Badge, ConfidenceBadge } from '@/components/ui/badge'
import { Briefcase, MessageCircle } from 'lucide-react'

function khalsaColor(opp: { khalsa_pain_identified: boolean; khalsa_decision_process_clear: boolean; khalsa_resources_confirmed: boolean; khalsa_champion_identified: boolean }) {
  const count = [opp.khalsa_pain_identified, opp.khalsa_decision_process_clear, opp.khalsa_resources_confirmed, opp.khalsa_champion_identified].filter(Boolean).length
  if (count >= 4) return 'border-l-success-green'
  if (count >= 2) return 'border-l-caution-amber'
  return 'border-l-attention-red'
}

export function LinkedOpportunities({ contactId }: { contactId: string }) {
  const opportunities = useOpportunitiesForContact(contactId)

  // Count interactions for this contact (relevant to all opportunities)
  const interactionCount = useLiveQuery(
    () => db.timeline_entries.where('contact_id').equals(contactId).count(),
    [contactId]
  ) ?? 0

  if (opportunities.length === 0) return null

  return (
    <div className="mt-6">
      <h3 className="font-dm-serif text-lg text-charcoal mb-3 flex items-center gap-2">
        <Briefcase size={18} />
        Opportunities
      </h3>
      <div className="space-y-2">
        {opportunities.map(opp => (
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
              {opp.estimated_value > 0 ? (
                <span className="text-sm font-medium text-charcoal">
                  &euro;{opp.estimated_value.toLocaleString()}
                </span>
              ) : <span />}
              <span className="text-xs text-muted-bronze flex items-center gap-1">
                <MessageCircle size={10} />
                {interactionCount} {interactionCount === 1 ? 'interaction' : 'interactions'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
