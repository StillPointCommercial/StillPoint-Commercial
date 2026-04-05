'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import type { Opportunity } from '@/lib/types'

export function PipelineSummary() {
  const opportunities = useLiveQuery(() => db.opportunities.toArray()) ?? []

  const active = opportunities.filter((o: Opportunity) => o.stage !== 'lost' && o.stage !== 'paused')
  const totalValue = active.reduce((sum: number, o: Opportunity) => sum + (o.estimated_value || 0), 0)

  const weightedValue = active.reduce((sum: number, o: Opportunity) => {
    const weight = o.confidence === 'high' ? 0.8 : o.confidence === 'medium' ? 0.5 : 0.2
    return sum + (o.estimated_value || 0) * weight
  }, 0)

  return (
    <div className="flex flex-wrap gap-4 md:gap-6 mb-6 text-sm">
      <div>
        <span className="text-text-light">Active: </span>
        <span className="font-medium text-charcoal">{active.length}</span>
      </div>
      <div>
        <span className="text-text-light">Pipeline: </span>
        <span className="font-medium text-charcoal">&euro;{totalValue.toLocaleString()}</span>
      </div>
      <div>
        <span className="text-text-light">Weighted: </span>
        <span className="font-medium text-charcoal">&euro;{Math.round(weightedValue).toLocaleString()}</span>
      </div>
    </div>
  )
}
