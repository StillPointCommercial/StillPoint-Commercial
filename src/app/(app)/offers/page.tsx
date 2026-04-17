'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import { createOffer, updateOffer, deleteOffer } from '@/lib/db/offers'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Fab } from '@/components/ui/fab'
import type { Offer, DeliveryType, RevenueType } from '@/lib/types'
import { DELIVERY_TYPE_LABELS, REVENUE_TYPE_LABELS } from '@/lib/types'
import { Package, GripVertical, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'

const deliveryOptions = Object.entries(DELIVERY_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))
const revenueOptions = Object.entries(REVENUE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))

export default function OffersPage() {
  const offers = useLiveQuery(() => db.offers.orderBy('sort_order').toArray()) ?? []
  const opportunities = useLiveQuery(() => db.opportunities.toArray()) ?? []
  const [editing, setEditing] = useState<Offer | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const { toast } = useToast()

  function oppCountForOffer(offerId: string) {
    return opportunities.filter(o => o.offer_id === offerId).length
  }

  function revenueForOffer(offerId: string) {
    return opportunities
      .filter(o => o.offer_id === offerId && o.stage === 'active_client')
      .reduce((sum, o) => sum + (o.estimated_value || 0), 0)
  }

  async function toggleActive(offer: Offer) {
    await updateOffer(offer.id, { is_active: !offer.is_active })
    toast({ title: offer.is_active ? 'Offer deactivated' : 'Offer activated', variant: 'success' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-dm-serif text-2xl text-charcoal">Offers</h1>
          <p className="text-sm text-text-light mt-1">Your service catalog — what you sell and at what price.</p>
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-16">
          <Package size={48} className="mx-auto text-sand mb-4" />
          <p className="text-text-light mb-2">No offers yet.</p>
          <p className="text-sm text-text-light mb-4">
            Define your service offerings to track which products drive revenue.
          </p>
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            Add first offer
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className={`bg-cream border border-border rounded-card p-4 flex items-center gap-4 ${!offer.is_active ? 'opacity-50' : ''}`}
            >
              <GripVertical size={16} className="text-text-light flex-shrink-0 cursor-grab" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-charcoal">{offer.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sand text-text-light">
                    {DELIVERY_TYPE_LABELS[offer.delivery_type]}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sand text-text-light">
                    {REVENUE_TYPE_LABELS[offer.revenue_type]}
                  </span>
                </div>
                {offer.description && (
                  <p className="text-sm text-text-light mt-0.5 truncate">{offer.description}</p>
                )}
                <div className="flex gap-4 mt-1 text-xs text-text-light">
                  <span>
                    &euro;{offer.price_from.toLocaleString()}
                    {offer.price_to ? ` – €${offer.price_to.toLocaleString()}` : ''}
                    {offer.revenue_type === 'recurring' ? '/mo' : ''}
                  </span>
                  {offer.typical_duration_months && (
                    <span>{offer.typical_duration_months}mo typical</span>
                  )}
                  <span>{oppCountForOffer(offer.id)} opportunities</span>
                  {revenueForOffer(offer.id) > 0 && (
                    <span className="text-success-green">&euro;{revenueForOffer(offer.id).toLocaleString()} won</span>
                  )}
                </div>
              </div>
              <button onClick={() => toggleActive(offer)} className="text-text-light hover:text-charcoal" title={offer.is_active ? 'Deactivate' : 'Activate'}>
                {offer.is_active ? <ToggleRight size={20} className="text-terracotta" /> : <ToggleLeft size={20} />}
              </button>
              <button onClick={() => { setEditing(offer); setFormOpen(true) }} className="text-text-light hover:text-charcoal">
                <Pencil size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Fab onClick={() => { setEditing(null); setFormOpen(true) }} label="Add offer" />

      <OfferForm
        key={editing?.id ?? 'new'}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        offer={editing ?? undefined}
        nextSortOrder={offers.length}
      />
    </div>
  )
}

function OfferForm({ open, onClose, offer, nextSortOrder }: {
  open: boolean
  onClose: () => void
  offer?: Offer
  nextSortOrder: number
}) {
  const isEdit = !!offer
  const { toast } = useToast()

  const [form, setForm] = useState({
    name: offer?.name ?? '',
    description: offer?.description ?? '',
    price_from: offer?.price_from?.toString() ?? '',
    price_to: offer?.price_to?.toString() ?? '',
    delivery_type: (offer?.delivery_type ?? 'project') as DeliveryType,
    revenue_type: (offer?.revenue_type ?? 'one_time') as RevenueType,
    typical_duration_months: offer?.typical_duration_months?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const data = {
        user_id: user.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price_from: parseFloat(form.price_from) || 0,
        price_to: form.price_to ? parseFloat(form.price_to) || null : null,
        delivery_type: form.delivery_type,
        revenue_type: form.revenue_type,
        typical_duration_months: form.typical_duration_months ? parseInt(form.typical_duration_months) : null,
        is_active: offer?.is_active ?? true,
        sort_order: offer?.sort_order ?? nextSortOrder,
      }

      if (isEdit && offer) {
        await updateOffer(offer.id, data)
      } else {
        await createOffer(data)
      }

      toast({ title: 'Offer saved', variant: 'success' })
      onClose()
    } catch (err) {
      console.error('Failed to save offer:', err)
      toast({ title: 'Failed to save offer', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!offer) return
    await deleteOffer(offer.id)
    toast({ title: 'Offer deleted', variant: 'success' })
    setShowDeleteConfirm(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Offer' : 'New Offer'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Offer Name *" value={form.name} onChange={e => update('name', e.target.value)} required placeholder="Strategy Sprint, Quarterly Retainer..." />

        <Textarea label="Description" value={form.description} onChange={e => update('description', e.target.value)} rows={2} placeholder="What's included, who it's for..." />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Delivery Type" value={form.delivery_type} options={deliveryOptions} onChange={e => update('delivery_type', e.target.value)} />
          <Select label="Revenue Type" value={form.revenue_type} options={revenueOptions} onChange={e => update('revenue_type', e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label={form.revenue_type === 'recurring' ? 'Price/Month (EUR)' : 'Price (EUR)'}
            type="number"
            value={form.price_from}
            onChange={e => update('price_from', e.target.value)}
            placeholder="15000"
          />
          <Input
            label="Price Max (EUR)"
            type="number"
            value={form.price_to}
            onChange={e => update('price_to', e.target.value)}
            placeholder="Optional"
          />
          <Input
            label="Duration (months)"
            type="number"
            value={form.typical_duration_months}
            onChange={e => update('typical_duration_months', e.target.value)}
            placeholder="3"
          />
        </div>

        {form.revenue_type === 'recurring' && form.price_from && (
          <p className="text-xs text-text-light">
            Annual value: &euro;{(parseFloat(form.price_from) * 12).toLocaleString()}/yr
          </p>
        )}

        <div className="flex justify-between pt-2">
          <div>
            {isEdit && !showDeleteConfirm && (
              <Button type="button" variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>Delete</Button>
            )}
            {isEdit && showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Are you sure?</span>
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                <Button type="button" variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
