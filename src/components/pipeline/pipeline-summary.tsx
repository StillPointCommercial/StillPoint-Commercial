'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import type { Opportunity } from '@/lib/types'

export function PipelineSummary() {
  const opportunities = useLiveQuery(() => db.opportunities.toArray()) ?? []

  // In-progress pipeline (excludes won/lost/paused)
  const inProgress = opportunities.filter(
    (o: Opportunity) => o.stage !== 'lost' && o.stage !== 'paused' && o.stage !== 'active_client'
  )
  const pipelineValue = inProgress.reduce((sum: number, o: Opportunity) => sum + (o.estimated_value || 0), 0)

  const weightedValue = inProgress.reduce((sum: number, o: Opportunity) => {
    const weight = o.confidence === 'high' ? 0.8 : o.confidence === 'medium' ? 0.5 : 0.2
    return sum + (o.estimated_value || 0) * weight
  }, 0)

  // Won deals
  const won = opportunities.filter((o: Opportunity) => o.stage === 'active_client')
  const securedValue = won.reduce((sum: number, o: Opportunity) => sum + (o.estimated_value || 0), 0)

  return (
    <div className="flex flex-wrap gap-4 md:gap-6 mb-6 text-sm">
      <div>
        <span className="text-text-light">In pipeline: </span>
        <span className="font-medium text-charcoal">{inProgress.length}</span>
      </div>
      <div>
        <span className="text-text-light">Pipeline: </span>
        <span className="font-medium text-charcoal">&euro;{pipelineValue.toLocaleString()}</span>
      </div>
      <div>
        <span className="text-text-light">Weighted: </span>
        <span className="font-medium text-charcoal">&euro;{Math.round(weightedValue).toLocaleString()}</span>
      </div>
      {securedValue > 0 && (
        <div>
          <span className="text-text-light">Secured: </span>
          <span className="font-medium text-success-green">&euro;{securedValue.toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}
