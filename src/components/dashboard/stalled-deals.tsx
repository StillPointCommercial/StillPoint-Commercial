'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { STAGE_LABELS } from '@/lib/types'
import type { StalledDeal } from '@/lib/hooks/use-dashboard-data'

export function StalledDeals({ deals }: { deals: StalledDeal[] }) {
  if (deals.length === 0) return null

  return (
    <div className="mb-6">
      <h2 className="font-dm-serif text-lg text-charcoal mb-3 flex items-center gap-2">
        <AlertTriangle size={18} className="text-attention-red" />
        Stalled Deals
      </h2>
      <p className="text-xs text-text-light mb-3">
        These deals are past their expected close date. Review and update or move to lost.
      </p>
      <div className="space-y-2">
        {deals.map(({ opportunity, contactName, daysPastDue }) => (
          <Link
            key={opportunity.id}
            href={opportunity.contact_id ? `/contacts/${opportunity.contact_id}` : '/pipeline'}
            className="flex items-center justify-between bg-cream border border-attention-red/20 rounded-card p-3 hover:border-attention-red/40 transition-colors group"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-charcoal truncate">
                <span className="font-medium">{opportunity.title}</span>
                <span className="text-text-light"> &middot; {contactName}</span>
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-text-light">{STAGE_LABELS[opportunity.stage]}</span>
                {opportunity.estimated_value > 0 && (
                  <span className="text-xs font-medium text-charcoal">
                    &euro;{opportunity.estimated_value.toLocaleString()}
                  </span>
                )}
                <span className="text-xs text-attention-red font-medium">
                  {daysPastDue}d overdue
                </span>
              </div>
            </div>
            <ArrowRight size={12} className="text-warm-gray group-hover:text-attention-red transition-colors shrink-0 ml-3" />
          </Link>
        ))}
      </div>
    </div>
  )
}
