'use client'

import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { YearPlan, OfferTarget } from '@/lib/types'
import { DELIVERY_TYPE_LABELS, REVENUE_TYPE_LABELS } from '@/lib/types'
import { Plus, X } from 'lucide-react'
import Link from 'next/link'

interface Props {
  plan: YearPlan
  onSave: (updates: Partial<YearPlan>) => Promise<void>
}

export function YearPlanTargets({ plan, onSave }: Props) {
  const { toast } = useToast()
  const offers = useLiveQuery(() => db.offers.toArray()) ?? []
  const activeOffers = offers.filter(o => o.is_active)

  const [form, setForm] = useState({
    revenue_target: plan.revenue_target,
    avg_deal_size: plan.avg_deal_size,
    target_new_clients: plan.target_new_clients,
    target_upsells: plan.target_upsells,
    pct_revenue_existing: plan.pct_revenue_existing,
    pct_revenue_new: plan.pct_revenue_new,
    offer_targets: plan.offer_targets ?? [],
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
      offer_targets: plan.offer_targets ?? [],
      notes: plan.notes ?? '',
    })
  }, [plan])

  function update(field: string, value: number | string) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'pct_revenue_existing') {
        next.pct_revenue_new = 100 - (value as number)
      } else if (field === 'pct_revenue_new') {
        next.pct_revenue_existing = 100 - (value as number)
      }
      return next
    })
  }

  function updateOfferTarget(index: number, field: keyof OfferTarget, value: string | number) {
    setForm(prev => {
      const targets = [...prev.offer_targets]
      targets[index] = { ...targets[index], [field]: value }
      return { ...prev, offer_targets: targets }
    })
  }

  function addOfferTarget(offerId: string) {
    const offer = activeOffers.find(o => o.id === offerId)
    if (!offer) return
    setForm(prev => ({
      ...prev,
      offer_targets: [...prev.offer_targets, {
        offer_id: offerId,
        target_count: 0,
        target_revenue: 0,
      }],
    }))
  }

  function removeOfferTarget(index: number) {
    setForm(prev => ({
      ...prev,
      offer_targets: prev.offer_targets.filter((_, i) => i !== index),
    }))
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

  // Offer targets sum
  const offerTargetRevenue = form.offer_targets.reduce((sum, t) => sum + (t.target_revenue || 0), 0)
  const offerTargetCount = form.offer_targets.reduce((sum, t) => sum + (t.target_count || 0), 0)

  // Offers not yet targeted
  const targetedOfferIds = new Set(form.offer_targets.map(t => t.offer_id))
  const availableOffers = activeOffers.filter(o => !targetedOfferIds.has(o.id))

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

      {/* Offer-based targets */}
      <div className="bg-cream border border-border rounded-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-dm-serif text-lg text-charcoal">Target by Offer</h3>
            <p className="text-xs text-text-light mt-0.5">Break down your revenue target by service type.</p>
          </div>
          {activeOffers.length === 0 && (
            <Link href="/offers" className="text-xs text-terracotta hover:text-[#a07860]">
              Set up offers first &rarr;
            </Link>
          )}
        </div>

        {form.offer_targets.length > 0 && (
          <div className="space-y-3 mb-4">
            {form.offer_targets.map((target, i) => {
              const offer = offers.find(o => o.id === target.offer_id)
              if (!offer) return null
              return (
                <div key={target.offer_id} className="flex items-center gap-3 bg-sand-light rounded-input p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-charcoal">{offer.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sand text-text-light">
                        {DELIVERY_TYPE_LABELS[offer.delivery_type]}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sand text-text-light">
                        {REVENUE_TYPE_LABELS[offer.revenue_type]}
                      </span>
                    </div>
                    <p className="text-xs text-text-light">
                      &euro;{offer.price_from.toLocaleString()}{offer.price_to ? ` – €${offer.price_to.toLocaleString()}` : ''}{offer.revenue_type === 'recurring' ? '/mo' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div>
                      <label className="block text-[10px] text-text-light mb-0.5">Count</label>
                      <input
                        type="number"
                        value={target.target_count || ''}
                        onChange={e => {
                          const count = Number(e.target.value)
                          setForm(prev => {
                            const targets = [...prev.offer_targets]
                            const price = offer.revenue_type === 'recurring'
                              ? offer.price_from * (offer.typical_duration_months || 12)
                              : offer.price_from
                            targets[i] = { ...targets[i], target_count: count, target_revenue: count > 0 ? count * price : 0 }
                            return { ...prev, offer_targets: targets }
                          })
                        }}
                        className="w-16 border border-border rounded-input px-2 py-1 text-sm bg-warm-white text-center"
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-text-light mb-0.5">Revenue</label>
                      <input
                        type="number"
                        value={target.target_revenue || ''}
                        onChange={e => updateOfferTarget(i, 'target_revenue', Number(e.target.value))}
                        className="w-24 border border-border rounded-input px-2 py-1 text-sm bg-warm-white text-right"
                      />
                    </div>
                    <button onClick={() => removeOfferTarget(i)} className="text-text-light hover:text-attention-red mt-4">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Totals row */}
            <div className="flex items-center justify-between px-3 pt-2 border-t border-border">
              <span className="text-sm font-medium text-charcoal">Total from offers</span>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-text-light">{offerTargetCount} deals</span>
                <span className="font-medium text-charcoal">&euro;{offerTargetRevenue.toLocaleString()}</span>
              </div>
            </div>
            {form.revenue_target > 0 && offerTargetRevenue > 0 && (
              <p className="text-xs text-text-light px-3">
                {Math.round(offerTargetRevenue / form.revenue_target * 100)}% of revenue target covered
                {offerTargetRevenue < form.revenue_target && (
                  <span className="text-caution-amber"> — &euro;{(form.revenue_target - offerTargetRevenue).toLocaleString()} unallocated</span>
                )}
              </p>
            )}
          </div>
        )}

        {availableOffers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {availableOffers.map(offer => (
              <button
                key={offer.id}
                onClick={() => addOfferTarget(offer.id)}
                className="flex items-center gap-1 text-xs text-terracotta hover:text-[#a07860] border border-terracotta/30 rounded-input px-2 py-1"
              >
                <Plus size={12} />
                {offer.name}
              </button>
            ))}
          </div>
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
