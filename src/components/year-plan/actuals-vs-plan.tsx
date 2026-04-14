'use client'

import type { YearPlan, Opportunity, Contact, TimelineEntry } from '@/lib/types'
import type { BackwardCalc } from '@/lib/db/year-plan'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  plan: YearPlan
  calc: BackwardCalc
  opportunities: Opportunity[]
  contacts: Contact[]
  timelineEntries: TimelineEntry[]
}

export function ActualsVsPlan({ plan, calc, opportunities, contacts, timelineEntries }: Props) {
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
  const yearEnd = new Date(plan.year, 11, 31)
  const isCurrentYear = now.getFullYear() === plan.year

  // Time progress through the year (0-1)
  const yearProgress = isCurrentYear
    ? (now.getTime() - yearStart.getTime()) / (yearEnd.getTime() - yearStart.getTime())
    : now > yearEnd ? 1 : 0

  // Current quarter
  const currentQuarter = isCurrentYear ? Math.floor(now.getMonth() / 3) : -1

  // Filter to this year's data
  const yearStr = String(plan.year)
  const yearOpps = opportunities.filter(o => o.created_at?.startsWith(yearStr))
  const yearEntries = timelineEntries.filter(e => e.entry_date?.startsWith(yearStr))
  const yearContacts = contacts.filter(c => c.created_at?.startsWith(yearStr))

  // Actuals calculations
  const activeClientOpps = yearOpps.filter(o => o.stage === 'active_client')
  const wonRevenue = activeClientOpps.reduce((sum, o) => sum + (o.estimated_value || 0), 0)
  const pipelineOpps = yearOpps.filter(o => o.stage !== 'lost' && o.stage !== 'paused')
  const pipelineValue = pipelineOpps.reduce((sum, o) => sum + (o.estimated_value || 0), 0)
  const proposalOpps = yearOpps.filter(o => o.stage === 'proposal' || o.stage === 'active_client')
  const discoveryOpps = yearOpps.filter(o => ['discovery', 'proposal', 'active_client'].includes(o.stage))
  const totalInteractions = yearEntries.length
  const newContacts = yearContacts.length

  // Pipeline coverage ratio
  const expectedRevenue = plan.revenue_target * yearProgress
  const pipelineCoverage = expectedRevenue > 0 ? pipelineValue / (plan.revenue_target - wonRevenue) : 0

  // Lead source breakdown
  const sourceBreakdown = {
    referral: contacts.filter(c => c.lead_source === 'referral').length,
    networking: contacts.filter(c => c.lead_source === 'networking').length,
    cold: contacts.filter(c => c.lead_source === 'cold_outreach').length,
    inbound: contacts.filter(c => c.lead_source === 'inbound').length,
    existing: contacts.filter(c => c.lead_source === 'existing_client').length,
  }

  // Average interactions per won deal
  const avgInteractionsPerDeal = activeClientOpps.length > 0
    ? Math.round(activeClientOpps.reduce((sum, opp) => {
        const contactEntries = timelineEntries.filter(e => e.contact_id === opp.contact_id)
        return sum + contactEntries.length
      }, 0) / activeClientOpps.length)
    : 0

  return (
    <div className="space-y-6">
      {/* Year progress bar */}
      {isCurrentYear && (
        <div className="bg-cream border border-border rounded-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-dm-serif text-lg text-charcoal">Year Progress</h3>
            <span className="text-sm text-text-light">{Math.round(yearProgress * 100)}% of year elapsed</span>
          </div>
          <div className="w-full h-2 bg-sand rounded-full overflow-hidden">
            <div
              className="h-full bg-terracotta/40 rounded-full"
              style={{ width: `${yearProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ActualMetric
          label="Revenue Won"
          actual={wonRevenue}
          target={plan.revenue_target}
          format="currency"
          yearProgress={yearProgress}
        />
        <ActualMetric
          label="Deals Closed"
          actual={activeClientOpps.length}
          target={calc.totalDeals}
          format="number"
          yearProgress={yearProgress}
        />
        <ActualMetric
          label="Proposals Out"
          actual={proposalOpps.length}
          target={calc.proposalsNeeded}
          format="number"
          yearProgress={yearProgress}
        />
        <ActualMetric
          label="Discoveries"
          actual={discoveryOpps.length}
          target={calc.discoveriesNeeded}
          format="number"
          yearProgress={yearProgress}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ActualMetric
          label="New Contacts"
          actual={newContacts}
          target={calc.totalLeadsNeeded}
          format="number"
          yearProgress={yearProgress}
        />
        <ActualMetric
          label="Total Interactions"
          actual={totalInteractions}
          target={null}
          format="number"
          yearProgress={yearProgress}
        />
        <div className="bg-cream border border-border rounded-card p-4">
          <p className="text-xs text-text-light mb-1">Pipeline Coverage</p>
          <p className={`text-2xl font-medium ${pipelineCoverage >= 3 ? 'text-success-green' : pipelineCoverage >= 2 ? 'text-caution-amber' : 'text-attention-red'}`}>
            {pipelineCoverage.toFixed(1)}x
          </p>
          <p className="text-[10px] text-text-light mt-0.5">Target: 3x remaining</p>
        </div>
        <div className="bg-cream border border-border rounded-card p-4">
          <p className="text-xs text-text-light mb-1">Avg Interactions/Deal</p>
          <p className="text-2xl font-medium text-charcoal">
            {avgInteractionsPerDeal || '—'}
          </p>
          <p className="text-[10px] text-text-light mt-0.5">Industry avg: 8 touchpoints</p>
        </div>
      </div>

      {/* Pipeline breakdown */}
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

      {/* Lead source breakdown */}
      <div className="bg-cream border border-border rounded-card p-5">
        <h3 className="font-dm-serif text-lg text-charcoal mb-4">Lead Sources (All Time)</h3>
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(sourceBreakdown).map(([source, count]) => (
            <div key={source} className="text-center">
              <p className="text-lg font-medium text-charcoal">{count}</p>
              <p className="text-xs text-text-light capitalize">{source}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-light mt-3">
          Set lead source on contacts to track which channels convert best.
        </p>
      </div>

      {/* Quarterly pace */}
      {isCurrentYear && currentQuarter >= 0 && (
        <div className="bg-cream border border-border rounded-card p-5">
          <h3 className="font-dm-serif text-lg text-charcoal mb-3">
            Q{currentQuarter + 1} Pace
          </h3>
          {(() => {
            const q = calc.quarters[currentQuarter]
            const monthInQuarter = now.getMonth() % 3
            const quarterProgress = (monthInQuarter + now.getDate() / 30) / 3

            const qStart = `${plan.year}-${String(currentQuarter * 3 + 1).padStart(2, '0')}`
            const qEnd = `${plan.year}-${String(currentQuarter * 3 + 4).padStart(2, '0')}`

            const qOpps = yearOpps.filter(o => o.created_at >= qStart && o.created_at < qEnd)
            const qWon = qOpps.filter(o => o.stage === 'active_client')
            const qRevenue = qWon.reduce((s, o) => s + (o.estimated_value || 0), 0)
            const qProposals = qOpps.filter(o => o.stage === 'proposal' || o.stage === 'active_client').length

            return (
              <div className="grid grid-cols-3 gap-3">
                <PaceCard
                  label="Revenue"
                  actual={qRevenue}
                  target={q.revenue}
                  progress={quarterProgress}
                  format="currency"
                />
                <PaceCard
                  label="Deals"
                  actual={qWon.length}
                  target={q.deals}
                  progress={quarterProgress}
                  format="number"
                />
                <PaceCard
                  label="Proposals"
                  actual={qProposals}
                  target={q.proposals}
                  progress={quarterProgress}
                  format="number"
                />
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function ActualMetric({ label, actual, target, format, yearProgress }: {
  label: string
  actual: number
  target: number | null
  format: 'currency' | 'number'
  yearProgress: number
}) {
  const expectedActual = target !== null ? Math.round(target * yearProgress) : null
  const onPace = expectedActual !== null ? actual >= expectedActual : null

  const displayActual = format === 'currency'
    ? `€${actual >= 1000 ? `${(actual / 1000).toFixed(0)}k` : actual.toLocaleString()}`
    : actual.toString()

  const displayTarget = target !== null
    ? format === 'currency'
      ? `€${target >= 1000 ? `${(target / 1000).toFixed(0)}k` : target.toLocaleString()}`
      : target.toString()
    : null

  return (
    <div className="bg-cream border border-border rounded-card p-4">
      <p className="text-xs text-text-light mb-1">{label}</p>
      <p className="text-2xl font-medium text-charcoal">{displayActual}</p>
      {displayTarget && (
        <div className="flex items-center gap-1 mt-1">
          {onPace !== null && (
            onPace
              ? <TrendingUp size={10} className="text-success-green" />
              : <TrendingDown size={10} className="text-attention-red" />
          )}
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
