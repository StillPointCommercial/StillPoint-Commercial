'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { YearPlan } from '@/lib/types'
import type { BackwardCalc } from '@/lib/db/year-plan'

interface Props {
  plan: YearPlan
  calc: BackwardCalc
  onSave: (updates: Partial<YearPlan>) => Promise<void>
}

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function CascadingView({ plan, calc, onSave }: Props) {
  const { toast } = useToast()
  const [weights, setWeights] = useState<[number, number, number, number]>(plan.quarterly_weights)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setWeights(plan.quarterly_weights)
  }, [plan])

  function updateWeight(idx: number, val: number) {
    const next = [...weights] as [number, number, number, number]
    next[idx] = val
    setWeights(next)
  }

  async function handleSave() {
    setSaving(true)
    await onSave({ quarterly_weights: weights })
    setSaving(false)
    toast({ title: 'Quarterly weights saved', variant: 'success' })
  }

  if (plan.revenue_target === 0) {
    return (
      <div className="text-center py-16 text-text-light">
        <p className="text-lg mb-2">Set your revenue target first</p>
        <p className="text-sm">Go to the Targets tab to set your annual revenue goal.</p>
      </div>
    )
  }

  const totalWeight = weights.reduce((s, w) => s + w, 0)

  // Current quarter (0-indexed)
  const currentMonth = new Date().getMonth()
  const currentQuarter = Math.floor(currentMonth / 3)

  return (
    <div className="space-y-6">
      {/* Quarterly weight editor */}
      <div className="bg-cream border border-border rounded-card p-5">
        <h3 className="font-dm-serif text-lg text-charcoal mb-2">Quarterly Weights</h3>
        <p className="text-xs text-text-light mb-4">
          Adjust how revenue is distributed across quarters. Many consultancies close more in Q4. Must total 100%.
        </p>
        <div className="grid grid-cols-4 gap-3">
          {QUARTER_LABELS.map((q, i) => (
            <div key={q}>
              <label className="block text-xs text-text-light mb-1">{q}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={weights[i]}
                  onChange={e => updateWeight(i, Number(e.target.value))}
                  className="w-full border border-border rounded-input px-2 py-1.5 text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-terracotta/30"
                />
                <span className="text-xs text-text-light">%</span>
              </div>
            </div>
          ))}
        </div>
        {totalWeight !== 100 && (
          <p className="text-xs text-attention-red mt-2">Total is {totalWeight}% — should be 100%</p>
        )}
        <div className="flex justify-end mt-3">
          <Button size="sm" onClick={handleSave} disabled={saving || totalWeight !== 100}>
            {saving ? 'Saving...' : 'Save Weights'}
          </Button>
        </div>
      </div>

      {/* Quarterly targets table */}
      <div className="bg-cream border border-border rounded-card p-5">
        <h3 className="font-dm-serif text-lg text-charcoal mb-4">Quarterly Targets</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-light border-b border-border">
                <th className="pb-2 pr-4">Quarter</th>
                <th className="pb-2 pr-4 text-right">Revenue</th>
                <th className="pb-2 pr-4 text-right">Deals</th>
                <th className="pb-2 pr-4 text-right">Proposals</th>
                <th className="pb-2 pr-4 text-right">Discoveries</th>
                <th className="pb-2 text-right">Leads</th>
              </tr>
            </thead>
            <tbody>
              {calc.quarters.map((q, i) => (
                <tr key={i} className={`border-b border-border/50 ${i === currentQuarter ? 'bg-terracotta/5' : ''}`}>
                  <td className="py-2.5 pr-4 font-medium text-charcoal">
                    {QUARTER_LABELS[i]}
                    {i === currentQuarter && (
                      <span className="text-[10px] ml-1.5 text-terracotta bg-terracotta/10 px-1.5 py-0.5 rounded-badge">
                        Current
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-charcoal">&euro;{q.revenue.toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-right">{q.deals}</td>
                  <td className="py-2.5 pr-4 text-right">{q.proposals}</td>
                  <td className="py-2.5 pr-4 text-right">{q.discoveries}</td>
                  <td className="py-2.5 text-right">{q.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly breakdown for current quarter */}
      <div className="bg-cream border border-border rounded-card p-5">
        <h3 className="font-dm-serif text-lg text-charcoal mb-2">
          {QUARTER_LABELS[currentQuarter]} Monthly Breakdown
        </h3>
        <p className="text-xs text-text-light mb-4">Evenly distributed within the quarter.</p>

        {(() => {
          const q = calc.quarters[currentQuarter]
          const monthStart = currentQuarter * 3
          return (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map(offset => {
                const monthIdx = monthStart + offset
                const isCurrent = monthIdx === currentMonth
                return (
                  <div
                    key={monthIdx}
                    className={`rounded-input p-3 ${isCurrent ? 'bg-terracotta/10 border border-terracotta/20' : 'bg-sand-light'}`}
                  >
                    <p className="text-xs font-medium text-charcoal mb-2">
                      {MONTH_LABELS[monthIdx]}
                      {isCurrent && <span className="text-terracotta ml-1">(now)</span>}
                    </p>
                    <div className="space-y-1 text-xs text-text-light">
                      <div className="flex justify-between">
                        <span>Revenue</span>
                        <span className="text-charcoal">&euro;{Math.round(q.revenue / 3).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Leads</span>
                        <span className="text-charcoal">{Math.ceil(q.leads / 3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Meetings</span>
                        <span className="text-charcoal">{Math.ceil(q.discoveries / 3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Proposals</span>
                        <span className="text-charcoal">{Math.ceil(q.proposals / 3)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Weekly rhythm card */}
      <div className="bg-cream border border-border rounded-card p-5">
        <h3 className="font-dm-serif text-lg text-charcoal mb-3">Your Weekly Rhythm</h3>
        <p className="text-xs text-text-light mb-4">
          These are the minimum weekly activities to stay on pace for your annual target.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <RhythmCard label="Generate leads" value={calc.weeklyLeads} unit="/week" />
          <RhythmCard label="Qualify leads" value={calc.weeklyQualified} unit="/week" />
          <RhythmCard label="Discovery meetings" value={calc.weeklyMeetings} unit="/week" />
          <RhythmCard label="Send proposals" value={calc.weeklyProposals} unit="/week" />
        </div>
      </div>
    </div>
  )
}

function RhythmCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="bg-sand-light rounded-input p-3 text-center">
      <p className="text-2xl font-medium text-charcoal">
        {value < 1 ? value.toFixed(1) : Math.ceil(value)}
      </p>
      <p className="text-xs text-text-light mt-0.5">{label}</p>
      <p className="text-[10px] text-warm-gray">{unit}</p>
    </div>
  )
}
