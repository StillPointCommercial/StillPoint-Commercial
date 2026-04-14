'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { YearPlan, ConversionAssumptions } from '@/lib/types'
import type { BackwardCalc } from '@/lib/db/year-plan'
import { ArrowDown } from 'lucide-react'

interface Props {
  plan: YearPlan
  calc: BackwardCalc
  onSave: (updates: Partial<YearPlan>) => Promise<void>
}

function ConversionEditor({ label, hint, conversions, onChange }: {
  label: string
  hint: string
  conversions: ConversionAssumptions
  onChange: (c: ConversionAssumptions) => void
}) {
  const fields: { key: keyof ConversionAssumptions; label: string }[] = [
    { key: 'lead_to_qualified', label: 'Lead → Qualified' },
    { key: 'qualified_to_discovery', label: 'Qualified → Discovery' },
    { key: 'discovery_to_proposal', label: 'Discovery → Proposal' },
    { key: 'proposal_to_won', label: 'Proposal → Won' },
  ]

  return (
    <div className="bg-cream border border-border rounded-card p-4">
      <h4 className="font-medium text-sm text-charcoal mb-1">{label}</h4>
      <p className="text-xs text-text-light mb-3">{hint}</p>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-xs text-text-light mb-1">{f.label}</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={100}
                value={conversions[f.key]}
                onChange={e => onChange({ ...conversions, [f.key]: Number(e.target.value) })}
                className="w-full border border-border rounded-input px-2 py-1.5 text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
              <span className="text-xs text-text-light">%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BackwardCalculator({ plan, calc, onSave }: Props) {
  const { toast } = useToast()
  const [cold, setCold] = useState(plan.conversions_cold)
  const [warm, setWarm] = useState(plan.conversions_warm)
  const [existing, setExisting] = useState(plan.conversions_existing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCold(plan.conversions_cold)
    setWarm(plan.conversions_warm)
    setExisting(plan.conversions_existing)
  }, [plan])

  async function handleSave() {
    setSaving(true)
    await onSave({ conversions_cold: cold, conversions_warm: warm, conversions_existing: existing })
    setSaving(false)
    toast({ title: 'Conversion rates saved', variant: 'success' })
  }

  if (plan.revenue_target === 0) {
    return (
      <div className="text-center py-16 text-text-light">
        <p className="text-lg mb-2">Set your revenue target first</p>
        <p className="text-sm">Go to the Targets tab to set your annual revenue goal.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Funnel visualization */}
      <div className="bg-cream border border-border rounded-card p-5">
        <h3 className="font-dm-serif text-lg text-charcoal mb-4">Your Sales Funnel</h3>
        <p className="text-xs text-text-light mb-4">
          Working backward from &euro;{plan.revenue_target.toLocaleString()} target. New business funnel shown below.
        </p>

        <div className="space-y-1">
          <FunnelStep
            label="Total Leads Needed"
            value={calc.totalLeadsNeeded}
            sublabel={`${Math.ceil(calc.totalLeadsNeeded / 12)}/month`}
          />
          <FunnelArrow />
          <FunnelStep
            label="Qualified Leads"
            value={calc.qualifiedLeadsNeeded}
            sublabel={`${Math.ceil(calc.qualifiedLeadsNeeded / 12)}/month`}
          />
          <FunnelArrow />
          <FunnelStep
            label="Discovery Meetings"
            value={calc.discoveriesNeeded}
            sublabel={`${Math.ceil(calc.discoveriesNeeded / 12)}/month`}
          />
          <FunnelArrow />
          <FunnelStep
            label="Proposals Sent"
            value={calc.proposalsNeeded}
            sublabel={`${Math.ceil(calc.proposalsNeeded / 12)}/month`}
          />
          <FunnelArrow />
          <FunnelStep
            label="Deals Won (New)"
            value={calc.dealsFromNew}
            sublabel={`€${calc.revenueFromNew.toLocaleString()}`}
            highlight
          />
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between text-sm">
            <span className="text-text-light">Existing client deals</span>
            <span className="font-medium text-charcoal">{calc.dealsFromExisting} deals &middot; &euro;{calc.revenueFromExisting.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-text-light">Total deals</span>
            <span className="font-medium text-charcoal">{calc.totalDeals} deals &middot; &euro;{plan.revenue_target.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Weekly rhythm */}
      <div className="bg-cream border border-border rounded-card p-5">
        <h3 className="font-dm-serif text-lg text-charcoal mb-3">Weekly Activity Target</h3>
        <p className="text-xs text-text-light mb-3">Based on 50 working weeks per year.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <WeeklyMetric label="New Leads" value={calc.weeklyLeads} />
          <WeeklyMetric label="Qualify" value={calc.weeklyQualified} />
          <WeeklyMetric label="Meetings" value={calc.weeklyMeetings} />
          <WeeklyMetric label="Proposals" value={calc.weeklyProposals} />
        </div>
      </div>

      {/* Conversion rate editors */}
      <h3 className="font-dm-serif text-lg text-charcoal">Conversion Assumptions</h3>
      <p className="text-xs text-text-light -mt-4">
        Defaults are industry averages for consultancy businesses. Adjust based on your experience.
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        <ConversionEditor
          label="Cold / Outreach"
          hint="Lowest conversion — cold leads, RFPs"
          conversions={cold}
          onChange={setCold}
        />
        <ConversionEditor
          label="Warm / Referral"
          hint="Referrals, networking, inbound"
          conversions={warm}
          onChange={setWarm}
        />
        <ConversionEditor
          label="Existing Clients"
          hint="Upsells, expansions, renewals"
          conversions={existing}
          onChange={setExisting}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Rates'}
        </Button>
      </div>
    </div>
  )
}

function FunnelStep({ label, value, sublabel, highlight }: {
  label: string; value: number; sublabel: string; highlight?: boolean
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-input ${
      highlight ? 'bg-terracotta/10 border border-terracotta/20' : 'bg-sand-light'
    }`}>
      <span className={`text-sm ${highlight ? 'font-medium text-charcoal' : 'text-text'}`}>{label}</span>
      <div className="text-right">
        <span className={`text-lg font-medium ${highlight ? 'text-terracotta' : 'text-charcoal'}`}>{value}</span>
        <span className="text-xs text-text-light ml-2">{sublabel}</span>
      </div>
    </div>
  )
}

function FunnelArrow() {
  return (
    <div className="flex justify-center py-0.5">
      <ArrowDown size={14} className="text-warm-gray" />
    </div>
  )
}

function WeeklyMetric({ label, value }: { label: string; value: number }) {
  const display = value < 1 ? `~${Math.round(value * 10) / 10}` : `~${Math.round(value * 10) / 10}`
  return (
    <div className="bg-sand-light rounded-input p-3 text-center">
      <p className="text-xl font-medium text-charcoal">{display}</p>
      <p className="text-xs text-text-light mt-0.5">{label}</p>
    </div>
  )
}
