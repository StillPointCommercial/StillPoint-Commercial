'use client'

import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { Opportunity, OpportunityStage, ConfidenceLevel, RevenueType } from '@/lib/types'
import { STAGE_LABELS, CONFIDENCE_LABELS, REVENUE_TYPE_LABELS, WIN_REASON_OPTIONS, LOSS_REASON_OPTIONS } from '@/lib/types'
import { createOpportunity, updateOpportunity, deleteOpportunity } from '@/lib/db/opportunities'
import { useContacts } from '@/lib/hooks/use-contacts'
import { createContact } from '@/lib/db/contacts'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown } from 'lucide-react'

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="border border-border rounded-card overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-charcoal bg-sand-light hover:bg-sand transition-colors"
      >
        {title}
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="p-4 space-y-4">{children}</div>}
    </div>
  )
}

interface OpportunityFormProps {
  open: boolean
  onClose: () => void
  opportunity?: Opportunity
  defaultContactId?: string
}

const stageOptions = Object.entries(STAGE_LABELS).map(([value, label]) => ({ value, label }))
const confidenceOptions = Object.entries(CONFIDENCE_LABELS).map(([value, label]) => ({ value, label }))
const revenueTypeOptions = Object.entries(REVENUE_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const winReasonOptions = [{ value: '', label: 'Select...' }, ...WIN_REASON_OPTIONS.map(r => ({ value: r, label: r }))]
const lossReasonOptions = [{ value: '', label: 'Select...' }, ...LOSS_REASON_OPTIONS.map(r => ({ value: r, label: r }))]

export function OpportunityForm({ open, onClose, opportunity, defaultContactId }: OpportunityFormProps) {
  const isEdit = !!opportunity
  const contacts = useContacts()
  const offers = useLiveQuery(() => db.offers.toArray()) ?? []
  const activeOffers = offers.filter(o => o.is_active)
  const { toast } = useToast()

  const [form, setForm] = useState({
    contact_id: opportunity?.contact_id ?? defaultContactId ?? '',
    company: opportunity?.company ?? '',
    title: opportunity?.title ?? '',
    offer_id: opportunity?.offer_id ?? '',
    stage: (opportunity?.stage ?? 'lead') as OpportunityStage,
    estimated_value: opportunity?.estimated_value?.toString() ?? '',
    monthly_value: opportunity?.monthly_value?.toString() ?? '',
    revenue_type: (opportunity?.revenue_type ?? 'one_time') as RevenueType,
    confidence: (opportunity?.confidence ?? 'low') as ConfidenceLevel,
    expected_close_date: opportunity?.expected_close_date ?? '',
    decision_maker_id: opportunity?.decision_maker_id ?? '',
    next_step: opportunity?.next_step ?? '',
    next_step_date: opportunity?.next_step_date ?? '',
    proposal_sent_date: opportunity?.proposal_sent_date ?? '',
    proposal_value: opportunity?.proposal_value?.toString() ?? '',
    win_reason: opportunity?.win_reason ?? '',
    loss_reason: opportunity?.loss_reason ?? '',
    notes: opportunity?.notes ?? '',
    khalsa_pain_identified: opportunity?.khalsa_pain_identified ?? false,
    khalsa_decision_process_clear: opportunity?.khalsa_decision_process_clear ?? false,
    khalsa_resources_confirmed: opportunity?.khalsa_resources_confirmed ?? false,
    khalsa_champion_identified: opportunity?.khalsa_champion_identified ?? false,
    khalsa_yellow_lights: opportunity?.khalsa_yellow_lights ?? '',
  })

  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Quick-add contact state
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickCompany, setQuickCompany] = useState('')

  async function handleQuickAddContact() {
    if (!quickName.trim()) return
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const parts = quickName.trim().split(/\s+/)
      const firstName = parts[0]
      const lastName = parts.slice(1).join(' ') || null

      const newContact = await createContact({
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        company: quickCompany.trim() || null,
        company_id: null,
        role: null,
        phone: null,
        email: null,
        linkedin_url: null,
        relationship_status: 'dormant',
        icp_fit: 'not_assessed',
        tags: [],
        general_notes: null,
        last_contact_date: null,
        next_action: null,
        next_action_date: null,
        lead_source: 'other',
        referred_by: null,
      })

      setForm(prev => ({ ...prev, contact_id: newContact.id, company: quickCompany.trim() || prev.company }))
      setShowQuickAdd(false)
      setQuickName('')
      setQuickCompany('')
      toast({ title: `Contact "${firstName}" created`, variant: 'success' })
    } catch (err) {
      console.error('Failed to quick-add contact:', err)
      toast({ title: 'Failed to add contact', variant: 'error' })
    }
  }

  // Auto-fill from offer when selected
  useEffect(() => {
    if (form.offer_id) {
      const offer = activeOffers.find(o => o.id === form.offer_id)
      if (offer) {
        setForm(prev => ({
          ...prev,
          revenue_type: offer.revenue_type,
          // If no value set yet, pre-fill from offer price
          estimated_value: prev.estimated_value || offer.price_from.toString(),
          monthly_value: offer.revenue_type === 'recurring' && !prev.monthly_value
            ? offer.price_from.toString()
            : prev.monthly_value,
        }))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.offer_id])

  // Auto-fill company when contact is selected
  useEffect(() => {
    if (form.contact_id && !form.company) {
      const contact = contacts.find(c => c.id === form.contact_id)
      if (contact?.company) {
        setForm(prev => ({ ...prev, company: contact.company || '' }))
      }
    }
  }, [form.contact_id, contacts, form.company])

  function update(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (form.estimated_value.trim()) {
      const parsed = parseFloat(form.estimated_value)
      if (isNaN(parsed) || parsed < 0) {
        newErrors.estimated_value = 'Value must be a positive number'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    if (!validate()) return
    setSaving(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let estimatedValue = parseFloat(form.estimated_value)
      if (isNaN(estimatedValue) || estimatedValue < 0) estimatedValue = 0

      let monthlyValue: number | null = parseFloat(form.monthly_value)
      if (isNaN(monthlyValue) || monthlyValue < 0) monthlyValue = null

      const data = {
        user_id: user.id,
        contact_id: form.contact_id || null,
        company: form.company.trim() || null,
        company_id: null as string | null,
        title: form.title.trim(),
        offer_id: form.offer_id || null,
        stage: form.stage,
        estimated_value: estimatedValue,
        monthly_value: monthlyValue,
        revenue_type: form.revenue_type as RevenueType,
        confidence: form.confidence,
        expected_close_date: form.expected_close_date || null,
        decision_maker_id: form.decision_maker_id || null,
        next_step: form.next_step.trim() || null,
        next_step_date: form.next_step_date || null,
        proposal_sent_date: form.proposal_sent_date || null,
        proposal_value: form.proposal_value ? parseFloat(form.proposal_value) || null : null,
        win_reason: form.win_reason || null,
        loss_reason: form.loss_reason || null,
        notes: form.notes.trim() || null,
        khalsa_pain_identified: form.khalsa_pain_identified,
        khalsa_decision_process_clear: form.khalsa_decision_process_clear,
        khalsa_resources_confirmed: form.khalsa_resources_confirmed,
        khalsa_champion_identified: form.khalsa_champion_identified,
        khalsa_yellow_lights: form.khalsa_yellow_lights.trim() || null,
      }

      if (isEdit && opportunity) {
        await updateOpportunity(opportunity.id, data)
      } else {
        await createOpportunity(data)
      }

      toast({ title: 'Opportunity saved', variant: 'success' })
      onClose()
    } catch (err) {
      console.error('Failed to save opportunity:', err)
      toast({ title: 'Failed to save opportunity', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!opportunity) return
    await deleteOpportunity(opportunity.id)
    toast({ title: 'Opportunity deleted', variant: 'success' })
    setShowDeleteConfirm(false)
    onClose()
  }

  const contactOptions = [
    { value: '', label: 'Select contact...' },
    ...contacts.map(c => ({
      value: c.id,
      label: `${c.first_name} ${c.last_name || ''}${c.company ? ` (${c.company})` : ''}`,
    })),
  ]

  const offerOptions = [
    { value: '', label: 'No offer type' },
    ...activeOffers.map(o => ({
      value: o.id,
      label: `${o.name} (€${o.price_from.toLocaleString()})`,
    })),
  ]

  const showWinReason = form.stage === 'active_client'
  const showLossReason = form.stage === 'lost'

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Opportunity' : 'New Opportunity'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Title *" value={form.title} onChange={e => update('title', e.target.value)} required placeholder="Advisory engagement, Strategic review..." />

        {/* Contact + Company row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Select label="Contact" value={form.contact_id} options={contactOptions} onChange={e => update('contact_id', e.target.value)} />
            <button
              type="button"
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="text-xs text-terracotta hover:text-[#a07860] mt-1"
            >
              {showQuickAdd ? 'Cancel' : '+ Quick add contact'}
            </button>
          </div>
          <Input label="Company" value={form.company} onChange={e => update('company', e.target.value)} />
        </div>

        {showQuickAdd && (
          <div className="border border-terracotta/30 rounded-card p-3 bg-sand-light space-y-2">
            <p className="text-xs font-medium text-charcoal">Quick add contact</p>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Name" value={quickName} onChange={e => setQuickName(e.target.value)} placeholder="First Last" />
              <Input label="Company" value={quickCompany} onChange={e => setQuickCompany(e.target.value)} placeholder="Company name" />
            </div>
            <Button type="button" size="sm" onClick={handleQuickAddContact} disabled={!quickName.trim()}>
              Add contact
            </Button>
          </div>
        )}

        {/* Offer type */}
        {activeOffers.length > 0 && (
          <Select label="Offer Type" value={form.offer_id} options={offerOptions} onChange={e => update('offer_id', e.target.value)} />
        )}

        {/* Stage + Value + Confidence */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select label="Stage" value={form.stage} options={stageOptions} onChange={e => update('stage', e.target.value)} />
          <div>
            <Input label="Value (EUR)" type="number" value={form.estimated_value} onChange={e => update('estimated_value', e.target.value)} />
            {errors.estimated_value && <p className="text-red-500 text-sm mt-1">{errors.estimated_value}</p>}
          </div>
          <Select label="Confidence" value={form.confidence} options={confidenceOptions} onChange={e => update('confidence', e.target.value)} />
        </div>

        {/* Revenue type + Monthly value + Close date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select label="Revenue Type" value={form.revenue_type} options={revenueTypeOptions} onChange={e => update('revenue_type', e.target.value)} />
          {form.revenue_type === 'recurring' && (
            <Input label="Monthly (EUR)" type="number" value={form.monthly_value} onChange={e => update('monthly_value', e.target.value)} placeholder="e.g. 3000" />
          )}
          <Input label="Expected Close" type="date" value={form.expected_close_date} onChange={e => update('expected_close_date', e.target.value)} />
        </div>

        {/* Next step */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Next Step" value={form.next_step} onChange={e => update('next_step', e.target.value)} placeholder="Send proposal, Schedule call..." />
          <Input label="Step Date" type="date" value={form.next_step_date} onChange={e => update('next_step_date', e.target.value)} />
        </div>

        <Textarea label="Notes" value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} />

        {/* Proposal Tracking */}
        <CollapsibleSection title="Proposal & Close" defaultOpen={!!(form.proposal_sent_date || form.proposal_value || showWinReason || showLossReason)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Proposal Sent" type="date" value={form.proposal_sent_date} onChange={e => update('proposal_sent_date', e.target.value)} />
            <Input label="Proposal Value (EUR)" type="number" value={form.proposal_value} onChange={e => update('proposal_value', e.target.value)} placeholder="e.g. 25000" />
          </div>
          {showWinReason && (
            <Select label="Win Reason" value={form.win_reason} options={winReasonOptions} onChange={e => update('win_reason', e.target.value)} />
          )}
          {showLossReason && (
            <Select label="Loss Reason" value={form.loss_reason} options={lossReasonOptions} onChange={e => update('loss_reason', e.target.value)} />
          )}
        </CollapsibleSection>

        {/* Decision maker & Stakeholders */}
        <CollapsibleSection title="Stakeholders" defaultOpen={!!form.decision_maker_id}>
          {form.contact_id ? (
            <Select
              label="Decision Maker"
              value={form.decision_maker_id}
              options={[
                { value: '', label: 'Same as contact' },
                ...contacts.filter(c => c.id !== form.contact_id).map(c => ({
                  value: c.id,
                  label: `${c.first_name} ${c.last_name || ''}${c.company ? ` (${c.company})` : ''}`,
                })),
              ]}
              onChange={e => update('decision_maker_id', e.target.value)}
            />
          ) : (
            <p className="text-xs text-text-light">Select a contact above to set a decision maker.</p>
          )}
        </CollapsibleSection>

        {/* Khalsa Qualification */}
        <CollapsibleSection title="Khalsa Qualification" defaultOpen={form.khalsa_pain_identified || form.khalsa_decision_process_clear || form.khalsa_resources_confirmed || form.khalsa_champion_identified}>
          <div className="space-y-2">
            {([
              ['khalsa_pain_identified', 'Pain identified — Is there a real, diagnosed pain?'],
              ['khalsa_decision_process_clear', 'Decision process clear — Who decides and how?'],
              ['khalsa_resources_confirmed', 'Resources confirmed — Budget, time, people?'],
              ['khalsa_champion_identified', 'Champion identified — Internal advocate?'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={e => update(key, e.target.checked)}
                  className="w-4 h-4 rounded-sm border-border text-terracotta focus:ring-terracotta"
                />
                <span className="text-sm text-text">{label}</span>
              </label>
            ))}
          </div>
          <Textarea
            label="Yellow lights"
            value={form.khalsa_yellow_lights}
            onChange={e => update('khalsa_yellow_lights', e.target.value)}
            rows={2}
            placeholder="Any concerns or warning signs?"
            className="mt-3"
          />
        </CollapsibleSection>

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
            <Button type="submit" disabled={saving || !form.title.trim()}>
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
