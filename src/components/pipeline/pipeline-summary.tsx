'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import type { Opportunity } from '@/lib/types'

/** Calculate average days between stage transitions across all won deals */
function calculateVelocity(opportunities: Opportunity[]): number | null {
  const wonDeals = opportunities.filter(o => o.stage === 'active_client' && o.stage_history && o.stage_history.length >= 2)
  if (wonDeals.length === 0) return null

  let totalDays = 0
  let count = 0

  for (const opp of wonDeals) {
    const history = opp.stage_history
    if (!history || history.length < 2) continue
    const firstEntry = new Date(history[0].entered_at)
    const lastEntry = new Date(history[history.length - 1].entered_at)
    const days = Math.floor((lastEntry.getTime() - firstEntry.getTime()) / (1000 * 60 * 60 * 24))
    if (days > 0) {
      totalDays += days
      count++
    }
  }

  return count > 0 ? Math.round(totalDays / count) : null
}

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

  // Pipeline velocity
  const avgDaysToClose = calculateVelocity(opportunities)

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
      {avgDaysToClose !== null && (
        <div>
          <span className="text-text-light">Avg close: </span>
          <span className="font-medium text-charcoal">{avgDaysToClose}d</span>
        </div>
      )}
    </div>
  )
}
