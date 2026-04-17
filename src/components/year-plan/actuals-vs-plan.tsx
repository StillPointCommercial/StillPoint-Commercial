'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import type { YearPlan, Opportunity, Contact, TimelineEntry } from '@/lib/types'
import type { BackwardCalc } from '@/lib/db/year-plan'
import { DELIVERY_TYPE_LABELS, REVENUE_TYPE_LABELS } from '@/lib/types'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  plan: YearPlan
  calc: BackwardCalc
  opportunities: Opportunity[]
  contacts: Contact[]
  timelineEntries: TimelineEntry[]
}

export function ActualsVsPlan({ plan, calc, opportunities, contacts, timelineEntries }: Props) {
  const offers = useLiveQuery(() => db.offers.toArray()) ?? []

  if (plan.revenue_target === 0) {
    return (
      <div className="text-center py-16 text-text-light">
        <p className="text-lg mb-2">Set your revenue target first</p>
        <p className="text-sm">Go to the Targets tab to set your annual revenue goal.</p>
      </div>
    )
  }

  const now = new Date()
  const yearStart = new Date(plan.year, 0, 1)
  const yearEnd = new Date(plan.year + 1, 0, 1)
  const isCurrentYear = now.getFullYear() === plan.year
  const currentQuarter = isCurrentYear ? Math.floor(now.getMonth() / 3) : -1

  const yearProgress = isCurrentYear
    ? (now.getTime() - yearStart.getTime()) / (yearEnd.getTime() - yearStart.getTime())
    : now > yearEnd ? 1 : 0

  // Filter to this year
  const yearStr = String(plan.year)
  const yearOpps = opportunities.filter(o => o.created_at?.startsWith(yearStr))
  const yearEntries = timelineEntries.filter(e => e.entry_date?.startsWith(yearStr))
  const yearContacts = contacts.filter(c => c.created_at?.startsWith(yearStr))

  // Core metrics
  const wonOpps = yearOpps.filter(o => o.stage === 'active_client')
  const wonRevenue = wonOpps.reduce((sum, o) => sum + (o.estimated_value || 0), 0)
  const pipelineOpps = yearOpps.filter(o => !['lost', 'paused', 'active_client'].includes(o.stage))
  const pipelineValue = pipelineOpps.reduce((sum, o) => sum + (o.estimated_value || 0), 0)
  const proposalOpps = yearOpps.filter(o => o.stage === 'proposal' || o.stage === 'active_client')
  const discoveryOpps = yearOpps.filter(o => ['discovery', 'proposal', 'active_client'].includes(o.stage))
  const lostOpps = yearOpps.filter(o => o.stage === 'lost')

  const pipelineCoverage = (plan.revenue_target - wonRevenue) > 0
    ? pipelineValue / (plan.revenue_target - wonRevenue)
    : wonRevenue >= plan.revenue_target ? 999 : 0

  const avgInteractionsPerDeal = wonOpps.length > 0
    ? Math.round(wonOpps.reduce((sum, opp) => {
        const contactEntries = timelineEntries.filter(e => e.contact_id === opp.contact_id)
        return sum + contactEntries.length
      }, 0) / wonOpps.length)
    : 0

  // Recurring vs one-time revenue
  const recurringRevenue = wonOpps.filter(o => o.revenue_type === 'recurring').reduce((s, o) => s + (o.estimated_value || 0), 0)
  const oneTimeRevenue = wonRevenue - recurringRevenue
  const recurringMonthly = wonOpps.filter(o => o.revenue_type === 'recurring').reduce((s, o) => s + (o.monthly_value || 0), 0)

  // Win/loss reason analysis
  const winReasons = wonOpps.filter(o => o.win_reason).reduce((acc, o) => {
    acc[o.win_reason!] = (acc[o.win_reason!] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const lossReasons = lostOpps.filter(o => o.loss_reason).reduce((acc, o) => {
    acc[o.loss_reason!] = (acc[o.loss_reason!] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Lead source breakdown
  const sourceBreakdown = {
    referral: contacts.filter(c => c.lead_source === 'referral').length,
    networking: contacts.filter(c => c.lead_source === 'networking').length,
    cold: contacts.filter(c => c.lead_source === 'cold_outreach').length,
    inbound: contacts.filter(c => c.lead_source === 'inbound').length,
    existing: contacts.filter(c => c.lead_source === 'existing_client').length,
  }

  // Offer performance
  const offerPerformance = offers.map(offer => {
    const offerOpps = yearOpps.filter(o => o.offer_id === offer.id)
    const offerWon = offerOpps.filter(o => o.stage === 'active_client')
    const offerLost = offerOpps.filter(o => o.stage === 'lost')
    const offerRevenue = offerWon.reduce((s, o) => s + (o.estimated_value || 0), 0)
    const offerPipeline = offerOpps.filter(o => !['lost', 'paused', 'active_client'].includes(o.stage))
    const pipelineVal = offerPipeline.reduce((s, o) => s + (o.estimated_value || 0), 0)
    const target = (plan.offer_targets ?? []).find(t => t.offer_id === offer.id)
    return {
      offer,
      won: offerWon.length,
      lost: offerLost.length,
      pipeline: offerPipeline.length,
      revenue: offerRevenue,
      pipelineValue: pipelineVal,
      targetCount: target?.target_count ?? 0,
      targetRevenue: target?.target_revenue ?? 0,
    }
  }).filter(p => p.won > 0 || p.pipeline > 0 || p.lost > 0 || p.targetCount > 0)

  return (
    <div className="space-y-6">
      {/* Year progress */}
      {isCurrentYear && (
        <div className="bg-cream border border-border rounded-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-dm-serif text-lg text-charcoal">Year Progress</h3>
            <span className="text-sm text-text-light">{Math.round(yearProgress * 100)}% of year elapsed</span>
          </div>
          <div className="w-full h-2 bg-sand rounded-full overflow-hidden">
            <div className="h-full bg-terracotta/40 rounded-full" style={{ width: `${yearProgress * 100}%` }} />
          </div>
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ActualMetric label="Revenue Won" actual={wonRevenue} target={plan.revenue_target} format="currency" yearProgress={yearProgress} />
        <ActualMetric label="Deals Closed" actual={wonOpps.length} target={calc.totalDeals} format="number" yearProgress={yearProgress} />
        <ActualMetric label="Proposals Out" actual={proposalOpps.length} target={calc.proposalsNeeded} format="number" yearProgress={yearProgress} />
        <ActualMetric label="Discoveries" actual={discoveryOpps.length} target={calc.discoveriesNeeded} format="number" yearProgress={yearProgress} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ActualMetric label="New Contacts" actual={yearContacts.length} target={calc.totalLeadsNeeded} format="number" yearProgress={yearProgress} />
        <ActualMetric label="Total Interactions" actual={yearEntries.length} target={null} format="number" yearProgress={yearProgress} />
        <div className="bg-cream border border-border rounded-card p-4">
          <p className="text-xs text-text-light mb-1">Pipeline Coverage</p>
          <p className={`text-2xl font-medium ${pipelineCoverage >= 3 ? 'text-success-green' : pipelineCoverage >= 2 ? 'text-caution-amber' : 'text-attention-red'}`}>
            {pipelineCoverage >= 999 ? '✓' : `${pipelineCoverage.toFixed(1)}x`}
          </p>
          <p className="text-[10px] text-text-light mt-0.5">Target: 3x remaining</p>
        </div>
        <div className="bg-cream border border-border rounded-card p-4">
          <p className="text-xs text-text-light mb-1">Avg Interactions/Deal</p>
          <p className="text-2xl font-medium text-charcoal">{avgInteractionsPerDeal || '—'}</p>
          <p className="text-[10px] text-text-light mt-0.5">Industry avg: 8 touchpoints</p>
        </div>
      </div>

      {/* Revenue breakdown: recurring vs one-time */}
      {wonRevenue > 0 && (
        <div className="bg-cream border border-border rounded-card p-5">
          <h3 className="font-dm-serif text-lg text-charcoal mb-4">Revenue Breakdown</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-text-light">One-time</p>
              <p className="text-xl font-medium text-charcoal">&euro;{oneTimeRevenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-text-light">Recurring (total)</p>
              <p className="text-xl font-medium text-charcoal">&euro;{recurringRevenue.toLocaleString()}</p>
            </div>
            {recurringMonthly > 0 && (
              <div>
                <p className="text-xs text-text-light">MRR</p>
                <p className="text-xl font-medium text-success-green">&euro;{recurringMonthly.toLocaleString()}/mo</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offer performance */}
      {offerPerformance.length > 0 && (
        <div className="bg-cream border border-border rounded-card p-5">
          <h3 className="font-dm-serif text-lg text-charcoal mb-4">Performance by Offer</h3>
          <div className="space-y-3">
            {offerPerformance.map(({ offer, won, lost, pipeline, revenue, pipelineValue: pVal, targetCount, targetRevenue }) => (
              <div key={offer.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-charcoal">{offer.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sand text-text-light">
                      {DELIVERY_TYPE_LABELS[offer.delivery_type]}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-text-light">
                    <span className="text-success-green">{won} won</span>
                    <span>{pipeline} in pipeline</span>
                    {lost > 0 && <span className="text-attention-red">{lost} lost</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-charcoal">&euro;{revenue.toLocaleString()}</p>
                  {targetRevenue > 0 && (
                    <p className="text-[10px] text-text-light">
                      of &euro;{targetRevenue.toLocaleString()} target ({Math.round(revenue / targetRevenue * 100)}%)
                    </p>
                  )}
                  {pVal > 0 && (
                    <p className="text-[10px] text-text-light">&euro;{pVal.toLocaleString()} in pipeline</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline by stage */}
      <div className="bg-cream border border-border rounded-card p-5">
        <h3 className="font-dm-serif text-lg text-charcoal mb-4">Pipeline by Stage</h3>
        <div className="space-y-2">
          {(['lead', 'warming', 'discovery', 'proposal', 'active_client'] as const).map(stage => {
            const stageOpps = yearOpps.filter(o => o.stage === stage)
            const stageValue = stageOpps.reduce((s, o) => s + (o.estimated_value || 0), 0)
            const stageLabels: Record<string, string> = { lead: 'Lead', warming: 'Warming', discovery: 'Discovery', proposal: 'Proposal', active_client: 'Won' }
            return (
              <div key={stage} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-text w-20">{stageLabels[stage]}</span>
                  <span className="text-xs text-text-light">{stageOpps.length} opps</span>
                </div>
                <span className="text-sm font-medium text-charcoal">&euro;{stageValue.toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Win/loss reasons */}
      {(Object.keys(winReasons).length > 0 || Object.keys(lossReasons).length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.keys(winReasons).length > 0 && (
            <div className="bg-cream border border-border rounded-card p-5">
              <h3 className="font-dm-serif text-lg text-charcoal mb-3">Why We Win</h3>
              <div className="space-y-2">
                {Object.entries(winReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between">
                    <span className="text-sm text-text">{reason}</span>
                    <span className="text-sm font-medium text-success-green">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.keys(lossReasons).length > 0 && (
            <div className="bg-cream border border-border rounded-card p-5">
              <h3 className="font-dm-serif text-lg text-charcoal mb-3">Why We Lose</h3>
              <div className="space-y-2">
                {Object.entries(lossReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between">
                    <span className="text-sm text-text">{reason}</span>
                    <span className="text-sm font-medium text-attention-red">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lead sources */}
      <div className="bg-cream border border-border rounded-card p-5">
        <h3 className="font-dm-serif text-lg text-charcoal mb-4">Lead Sources (All Time)</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {Object.entries(sourceBreakdown).map(([source, count]) => (
            <div key={source} className="text-center">
              <p className="text-lg font-medium text-charcoal">{count}</p>
              <p className="text-xs text-text-light capitalize">{source}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quarterly pace */}
      {isCurrentYear && currentQuarter >= 0 && (
        <div className="bg-cream border border-border rounded-card p-5">
          <h3 className="font-dm-serif text-lg text-charcoal mb-3">Q{currentQuarter + 1} Pace</h3>
          {(() => {
            const q = calc.quarters[currentQuarter]
            const monthInQuarter = now.getMonth() % 3
            const quarterProgress = (monthInQuarter + now.getDate() / 30) / 3
            const qStart = `${plan.year}-${String(currentQuarter * 3 + 1).padStart(2, '0')}`
            const qEndMonth = currentQuarter * 3 + 4
            const qEnd = qEndMonth <= 12
              ? `${plan.year}-${String(qEndMonth).padStart(2, '0')}`
              : `${plan.year + 1}-01`
            const qOpps = yearOpps.filter(o => o.created_at >= qStart && o.created_at < qEnd)
            const qWon = qOpps.filter(o => o.stage === 'active_client')
            const qRevenue = qWon.reduce((s, o) => s + (o.estimated_value || 0), 0)
            const qProposals = qOpps.filter(o => o.stage === 'proposal' || o.stage === 'active_client').length

            return (
              <div className="grid grid-cols-3 gap-3">
                <PaceCard label="Revenue" actual={qRevenue} target={q.revenue} progress={quarterProgress} format="currency" />
                <PaceCard label="Deals" actual={qWon.length} target={q.deals} progress={quarterProgress} format="number" />
                <PaceCard label="Proposals" actual={qProposals} target={q.proposals} progress={quarterProgress} format="number" />
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function ActualMetric({ label, actual, target, format, yearProgress }: {
  label: string; actual: number; target: number | null; format: 'currency' | 'number'; yearProgress: number
}) {
  const expectedActual = target !== null ? Math.round(target * yearProgress) : null
  const onPace = expectedActual !== null ? actual >= expectedActual : null
  const displayActual = format === 'currency'
    ? `€${actual >= 1000 ? `${(actual / 1000).toFixed(0)}k` : actual.toLocaleString()}`
    : actual.toString()
  const displayTarget = target !== null
    ? format === 'currency' ? `€${target >= 1000 ? `${(target / 1000).toFixed(0)}k` : target.toLocaleString()}` : target.toString()
    : null

  return (
    <div className="bg-cream border border-border rounded-card p-4">
      <p className="text-xs text-text-light mb-1">{label}</p>
      <p className="text-2xl font-medium text-charcoal">{displayActual}</p>
      {displayTarget && (
        <div className="flex items-center gap-1 mt-1">
          {onPace !== null && (onPace ? <TrendingUp size={10} className="text-success-green" /> : <TrendingDown size={10} className="text-attention-red" />)}
          <span className="text-[10px] text-text-light">of {displayTarget} target</span>
        </div>
      )}
    </div>
  )
}

function PaceCard({ label, actual, target, progress, format }: {
  label: string; actual: number; target: number; progress: number; format: 'currency' | 'number'
}) {
  const expected = Math.round(target * progress)
  const paceRatio = expected > 0 ? actual / expected : actual > 0 ? 999 : 0
  const status = paceRatio >= 1 ? 'ahead' : paceRatio >= 0.7 ? 'on-track' : 'behind'
  const statusColors = { ahead: 'text-success-green', 'on-track': 'text-caution-amber', behind: 'text-attention-red' }
  const statusLabels = { ahead: 'Ahead', 'on-track': 'On track', behind: 'Behind' }
  const displayActual = format === 'currency' ? `€${actual.toLocaleString()}` : String(actual)
  const displayTarget = format === 'currency' ? `€${target.toLocaleString()}` : String(target)

  return (
    <div className="bg-sand-light rounded-input p-3">
      <p className="text-xs text-text-light mb-1">{label}</p>
      <p className="text-lg font-medium text-charcoal">{displayActual}</p>
      <p className="text-[10px] text-text-light">of {displayTarget}</p>
      <p className={`text-xs font-medium mt-1 ${statusColors[status]}`}>{statusLabels[status]}</p>
    </div>
  )
}
