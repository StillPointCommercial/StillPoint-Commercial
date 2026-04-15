'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { Opportunity, OpportunityStage, ConfidenceLevel } from '@/lib/types'
import { STAGE_LABELS, CONFIDENCE_LABELS } from '@/lib/types'
import { createOpportunity, updateOpportunity, deleteOpportunity } from '@/lib/db/opportunities'
import { useContacts } from '@/lib/hooks/use-contacts'
import { createContact } from '@/lib/db/contacts'
import { createClient } from '@/lib/supabase/client'

interface OpportunityFormProps {
  open: boolean
  onClose: () => void
  opportunity?: Opportunity
  defaultContactId?: string
}

const stageOptions = Object.entries(STAGE_LABELS).map(([value, label]) => ({ value, label }))
const confidenceOptions = Object.entries(CONFIDENCE_LABELS).map(([value, label]) => ({ value, label }))

export function OpportunityForm({ open, onClose, opportunity, defaultContactId }: OpportunityFormProps) {
  const isEdit = !!opportunity
  const contacts = useContacts()
  const { toast } = useToast()

  const [form, setForm] = useState({
    contact_id: opportunity?.contact_id ?? defaultContactId ?? '',
    company: opportunity?.company ?? '',
    title: opportunity?.title ?? '',
    stage: (opportunity?.stage ?? 'lead') as OpportunityStage,
    estimated_value: opportunity?.estimated_value?.toString() ?? '',
    confidence: (opportunity?.confidence ?? 'low') as ConfidenceLevel,
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

  // Reset form when the opportunity prop changes (e.g. opening edit for a different opp)
  useEffect(() => {
    setForm({
      contact_id: opportunity?.contact_id ?? defaultContactId ?? '',
      company: opportunity?.company ?? '',
      title: opportunity?.title ?? '',
      stage: (opportunity?.stage ?? 'lead') as OpportunityStage,
      estimated_value: opportunity?.estimated_value?.toString() ?? '',
      confidence: (opportunity?.confidence ?? 'low') as ConfidenceLevel,
      notes: opportunity?.notes ?? '',
      khalsa_pain_identified: opportunity?.khalsa_pain_identified ?? false,
      khalsa_decision_process_clear: opportunity?.khalsa_decision_process_clear ?? false,
      khalsa_resources_confirmed: opportunity?.khalsa_resources_confirmed ?? false,
      khalsa_champion_identified: opportunity?.khalsa_champion_identified ?? false,
      khalsa_yellow_lights: opportunity?.khalsa_yellow_lights ?? '',
    })
    setShowDeleteConfirm(false)
    setErrors({})
  }, [opportunity, defaultContactId])

  // Quick-add contact state
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickCompany, setQuickCompany] = useState('')

  async function handleQuickAddContact() {
    if (!quickName.trim()) return
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
  }

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

      // Parse and validate estimated_value
      let estimatedValue = parseFloat(form.estimated_value)
      if (isNaN(estimatedValue) || estimatedValue < 0) {
        estimatedValue = 0
      }

      const data = {
        user_id: user.id,
        contact_id: form.contact_id || null,
        company: form.company.trim() || null,
        title: form.title.trim(),
        stage: form.stage,
        estimated_value: estimatedValue,
        confidence: form.confidence,
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

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Opportunity' : 'New Opportunity'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Title *" value={form.title} onChange={e => update('title', e.target.value)} required placeholder="Advisory engagement, Strategic review..." />

        <div className="grid grid-cols-2 gap-3">
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

        <div className="grid grid-cols-3 gap-3">
          <Select label="Stage" value={form.stage} options={stageOptions} onChange={e => update('stage', e.target.value)} />
          <div>
            <Input label="Value (EUR)" type="number" value={form.estimated_value} onChange={e => update('estimated_value', e.target.value)} />
            {errors.estimated_value && <p className="text-red-500 text-sm mt-1">{errors.estimated_value}</p>}
          </div>
          <Select label="Confidence" value={form.confidence} options={confidenceOptions} onChange={e => update('confidence', e.target.value)} />
        </div>

        <Textarea label="Notes" value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} />

        <div className="border border-border rounded-card p-4">
          <p className="text-sm font-medium text-charcoal mb-3">Khalsa Qualification</p>
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
        </div>

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
