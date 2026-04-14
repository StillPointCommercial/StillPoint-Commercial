'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import { getYearPlan, calculateBackward } from '@/lib/db/year-plan'
import { Target } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import type { YearPlan } from '@/lib/types'
import type { BackwardCalc } from '@/lib/db/year-plan'

export function PaceWidget() {
  const [plan, setPlan] = useState<YearPlan | null>(null)
  const [calc, setCalc] = useState<BackwardCalc | null>(null)

  const opportunities = useLiveQuery(() => db.opportunities.toArray()) ?? []

  const currentYear = new Date().getFullYear()

  useEffect(() => {
    getYearPlan(currentYear).then(p => {
      if (p && p.revenue_target > 0) {
        setPlan(p)
        setCalc(calculateBackward(p))
      }
    })
  }, [currentYear])

  if (!plan || !calc || plan.revenue_target === 0) return null

  const now = new Date()
  const currentQuarter = Math.floor(now.getMonth() / 3)
  const q = calc.quarters[currentQuarter]

  // Quarter progress
  const monthInQuarter = now.getMonth() % 3
  const quarterProgress = (monthInQuarter + now.getDate() / 30) / 3

  // This year's won deals
  const yearStr = String(plan.year)
  const yearOpps = opportunities.filter(o => o.created_at?.startsWith(yearStr))
  const wonRevenue = yearOpps
    .filter(o => o.stage === 'active_client')
    .reduce((s, o) => s + (o.estimated_value || 0), 0)
  const pipelineValue = yearOpps
    .filter(o => o.stage !== 'lost' && o.stage !== 'paused')
    .reduce((s, o) => s + (o.estimated_value || 0), 0)

  const revPct = plan.revenue_target > 0 ? Math.round((wonRevenue / plan.revenue_target) * 100) : 0
  const yearPct = Math.round(quarterProgress * 25 + currentQuarter * 25)
  const pipelineCoverage = (plan.revenue_target - wonRevenue) > 0
    ? (pipelineValue / (plan.revenue_target - wonRevenue)).toFixed(1)
    : '—'

  // Count proposals out
  const proposalsOut = yearOpps.filter(o => o.stage === 'proposal').length

  return (
    <Link
      href="/year-plan"
      className="block mb-6 bg-cream border border-border rounded-card p-4 hover:border-terracotta-muted transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <Target size={16} className="text-terracotta" />
        <h3 className="font-medium text-sm text-charcoal">Q{currentQuarter + 1} Pace</h3>
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-xl font-medium text-charcoal">{revPct}%</span>
        <span className="text-xs text-text-light">of &euro;{plan.revenue_target >= 1000 ? `${(plan.revenue_target / 1000).toFixed(0)}k` : plan.revenue_target} target</span>
      </div>
      <div className="w-full h-1.5 bg-sand rounded-full overflow-hidden mb-2">
        <div className="h-full bg-terracotta/50 rounded-full" style={{ width: `${Math.min(revPct, 100)}%` }} />
      </div>
      <div className="flex gap-3 text-xs text-text-light">
        <span>Pipeline: {pipelineCoverage}x</span>
        <span>{proposalsOut} proposals out</span>
        <span>{yearPct}% of year</span>
      </div>
    </Link>
  )
}
