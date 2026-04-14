'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/page-header'
import { YearPlanTargets } from '@/components/year-plan/targets'
import { BackwardCalculator } from '@/components/year-plan/backward-calculator'
import { CascadingView } from '@/components/year-plan/cascading-view'
import { ActualsVsPlan } from '@/components/year-plan/actuals-vs-plan'
import { getYearPlan, saveYearPlan, createDefaultYearPlan, calculateBackward } from '@/lib/db/year-plan'
import type { YearPlan } from '@/lib/types'

export default function YearPlanPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [plan, setPlan] = useState<YearPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'targets' | 'funnel' | 'cascade' | 'actuals'>('targets')

  // Load actuals data for comparison
  const opportunities = useLiveQuery(() => db.opportunities.toArray()) ?? []
  const contacts = useLiveQuery(() => db.contacts.toArray()) ?? []
  const timelineEntries = useLiveQuery(() => db.timeline_entries.toArray()) ?? []

  useEffect(() => {
    async function load() {
      setLoading(true)
      let existing = await getYearPlan(selectedYear)
      if (!existing) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const defaults = createDefaultYearPlan(user.id, selectedYear)
          existing = await saveYearPlan(defaults)
        }
      }
      setPlan(existing ?? null)
      setLoading(false)
    }
    load()
  }, [selectedYear])

  const calc = useMemo(() => plan ? calculateBackward(plan) : null, [plan])

  async function handleSave(updates: Partial<YearPlan>) {
    if (!plan) return
    const updated = { ...plan, ...updates }
    const saved = await saveYearPlan(updated)
    setPlan(saved)
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Year Plan" subtitle="Revenue targets & activity planning" />
        <div className="text-text-light py-8">Loading plan...</div>
      </div>
    )
  }

  if (!plan || !calc) return null

  const tabs = [
    { id: 'targets' as const, label: 'Targets' },
    { id: 'funnel' as const, label: 'Funnel' },
    { id: 'cascade' as const, label: 'Cascade' },
    { id: 'actuals' as const, label: 'Actuals' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Year Plan" subtitle="Revenue targets & activity planning" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedYear(y => y - 1)}
            className="text-sm text-text-light hover:text-charcoal px-2 py-1"
          >
            &larr;
          </button>
          <span className="font-dm-serif text-xl text-charcoal">{selectedYear}</span>
          <button
            onClick={() => setSelectedYear(y => y + 1)}
            className="text-sm text-text-light hover:text-charcoal px-2 py-1"
          >
            &rarr;
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              activeTab === tab.id
                ? 'text-terracotta border-terracotta'
                : 'text-text-light border-transparent hover:text-charcoal'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'targets' && (
        <YearPlanTargets plan={plan} onSave={handleSave} />
      )}

      {activeTab === 'funnel' && (
        <BackwardCalculator plan={plan} calc={calc} onSave={handleSave} />
      )}

      {activeTab === 'cascade' && (
        <CascadingView plan={plan} calc={calc} onSave={handleSave} />
      )}

      {activeTab === 'actuals' && (
        <ActualsVsPlan
          plan={plan}
          calc={calc}
          opportunities={opportunities}
          contacts={contacts}
          timelineEntries={timelineEntries}
        />
      )}
    </div>
  )
}
