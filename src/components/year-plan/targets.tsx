'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { YearPlan } from '@/lib/types'

interface Props {
  plan: YearPlan
  onSave: (updates: Partial<YearPlan>) => Promise<void>
}

export function YearPlanTargets({ plan, onSave }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    revenue_target: plan.revenue_target,
    avg_deal_size: plan.avg_deal_size,
    target_new_clients: plan.target_new_clients,
    target_upsells: plan.target_upsells,
    pct_revenue_existing: plan.pct_revenue_existing,
    pct_revenue_new: plan.pct_revenue_new,
    notes: plan.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({
      revenue_target: plan.revenue_target,
      avg_deal_size: plan.avg_deal_size,
      target_new_clients: plan.target_new_clients,
      target_upsells: plan.target_upsells,
      pct_revenue_existing: plan.pct_revenue_existing,
      pct_revenue_new: plan.pct_revenue_new,
      notes: plan.notes ?? '',
    })
  }, [plan])

  function update(field: string, value: number | string) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Keep existing/new percentages in sync
      if (field === 'pct_revenue_existing') {
        next.pct_revenue_new = 100 - (value as number)
      } else if (field === 'pct_revenue_new') {
        next.pct_revenue_existing = 100 - (value as number)
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    await onSave({
      ...form,
      notes: form.notes || null,
    })
    setSaving(false)
    toast({ title: 'Year plan saved', variant: 'success' })
  }

  const estimatedDeals = form.avg_deal_size > 0 ? Math.ceil(form.revenue_target / form.avg_deal_size) : 0

  return (
    <div className="space-y-6">
      {/* Revenue target */}
      <div className="bg-cream border border-border rounded-card p-5">
        <h3 className="font-dm-serif text-lg text-charcoal mb-4">Revenue Target</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Annual Revenue Target (&euro;)</label>
            <input
              type="number"
              value={form.revenue_target || ''}
              onChange={e => update('revenue_target', Number(e.target.value))}
              className="w-full border border-border rounded-input px-3 py-2 text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              placeholder="500000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Average Deal Size (&euro;)</label>
            <input
              type="number"
              value={form.avg_deal_size || ''}
              onChange={e => update('avg_deal_size', Number(e.target.value))}
              className="w-full border border-border rounded-input px-3 py-2 text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              placeholder="25000"
            />
          </div>
        </div>
        {form.revenue_target > 0 && (
          <p className="text-sm text-text-light mt-3">
            &asymp; <strong className="text-charcoal">{estimatedDeals}</strong> deals needed at &euro;{form.avg_deal_size.toLocaleString()} avg
          </p>
        )}
      </div>

      {/* Client targets */}
      <div className="bg-cream border border-border rounded-card p-5">
        <h3 className="font-dm-serif text-lg text-charcoal mb-4">Client Targets</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">New Clients</label>
            <input
              type="number"
              value={form.target_new_clients || ''}
              onChange={e => update('target_new_clients', Number(e.target.value))}
              className="w-full border border-border rounded-input px-3 py-2 text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              placeholder="8"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Upsells / Expansions</label>
            <input
              type="number"
              value={form.target_upsells || ''}
              onChange={e => update('target_upsells', Number(e.target.value))}
              className="w-full border border-border rounded-input px-3 py-2 text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              placeholder="5"
            />
          </div>
        </div>
      </div>

      {/* Revenue split */}
      <div className="bg-cream border border-border rounded-card p-5">
        <h3 className="font-dm-serif text-lg text-charcoal mb-4">Revenue Split</h3>
        <p className="text-xs text-text-light mb-3">
          Healthy consultancies get 60-80% from existing clients. This drives your funnel math.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">From Existing Clients (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.pct_revenue_existing}
              onChange={e => update('pct_revenue_existing', Number(e.target.value))}
              className="w-full border border-border rounded-input px-3 py-2 text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-terracotta/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">From New Business (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.pct_revenue_new}
              onChange={e => update('pct_revenue_new', Number(e.target.value))}
              className="w-full border border-border rounded-input px-3 py-2 text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-terracotta/30"
            />
          </div>
        </div>
        {form.revenue_target > 0 && (
          <div className="flex gap-4 mt-3 text-sm">
            <span className="text-text-light">
              Existing: <strong className="text-charcoal">&euro;{Math.round(form.revenue_target * form.pct_revenue_existing / 100).toLocaleString()}</strong>
            </span>
            <span className="text-text-light">
              New: <strong className="text-charcoal">&euro;{Math.round(form.revenue_target * form.pct_revenue_new / 100).toLocaleString()}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-cream border border-border rounded-card p-5">
        <h3 className="font-dm-serif text-lg text-charcoal mb-3">Notes</h3>
        <textarea
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          rows={3}
          className="w-full border border-border rounded-input px-3 py-2 text-sm bg-warm-white focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          placeholder="Strategic priorities, verticals to target, key assumptions..."
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Targets'}
        </Button>
      </div>
    </div>
  )
}
