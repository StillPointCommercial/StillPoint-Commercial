'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { Contact, RelationshipStatus, IcpFit, LeadSource } from '@/lib/types'
import { STATUS_LABELS, ICP_LABELS, LEAD_SOURCE_LABELS } from '@/lib/types'
import { createContact, updateContact } from '@/lib/db/contacts'
import { createClient } from '@/lib/supabase/client'

interface ContactFormProps {
  open: boolean
  onClose: () => void
  contact?: Contact
  onSaved?: (contact: Contact) => void
}

const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
const icpOptions = Object.entries(ICP_LABELS).map(([value, label]) => ({ value, label }))
const leadSourceOptions = Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => ({ value, label }))

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ContactForm({ open, onClose, contact, onSaved }: ContactFormProps) {
  const isEdit = !!contact
  const { toast } = useToast()

  const [form, setForm] = useState({
    first_name: contact?.first_name ?? '',
    last_name: contact?.last_name ?? '',
    company: contact?.company ?? '',
    role: contact?.role ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
    linkedin_url: contact?.linkedin_url ?? '',
    relationship_status: (contact?.relationship_status ?? 'dormant') as RelationshipStatus,
    icp_fit: (contact?.icp_fit ?? 'not_assessed') as IcpFit,
    lead_source: (contact?.lead_source ?? 'other') as LeadSource,
    tags: contact?.tags?.join(', ') ?? '',
    general_notes: contact?.general_notes ?? '',
    next_action: contact?.next_action ?? '',
    next_action_date: contact?.next_action_date ?? '',
  })

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    // Clear error on change
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

    if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim())) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (form.linkedin_url.trim() && !/^https?:\/\//.test(form.linkedin_url.trim())) {
      newErrors.linkedin_url = 'URL must start with https:// or http://'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim()) return
    if (!validate()) return

    setSaving(true)

    const tags = form.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    try {
      // Get current user ID
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const data = {
        user_id: user.id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        company: form.company.trim() || null,
        role: form.role.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        relationship_status: form.relationship_status,
        icp_fit: form.icp_fit,
        lead_source: form.lead_source,
        referred_by: contact?.referred_by ?? null,
        tags,
        general_notes: form.general_notes.trim() || null,
        last_contact_date: contact?.last_contact_date ?? null,
        next_action: form.next_action.trim() || null,
        next_action_date: form.next_action_date || null,
      }

      if (isEdit && contact) {
        await updateContact(contact.id, data)
        onSaved?.({ ...contact, ...data } as Contact)
      } else {
        const created = await createContact(data)
        onSaved?.(created)
      }

      toast({ title: 'Contact saved', variant: 'success' })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Contact' : 'New Contact'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input label="First name *" value={form.first_name} onChange={e => update('first_name', e.target.value)} required />
          </div>
          <Input label="Last name" value={form.last_name} onChange={e => update('last_name', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Company" value={form.company} onChange={e => update('company', e.target.value)} />
          <Input label="Role" value={form.role} onChange={e => update('role', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Phone" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} />
          <div>
            <Input label="Email" type="email" value={form.email} onChange={e => update('email', e.target.value)} />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>
        </div>

        <div>
          <Input label="LinkedIn URL" value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} />
          {errors.linkedin_url && <p className="text-red-500 text-sm mt-1">{errors.linkedin_url}</p>}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Select label="Status" value={form.relationship_status} options={statusOptions} onChange={e => update('relationship_status', e.target.value)} />
          <Select label="ICP Fit" value={form.icp_fit} options={icpOptions} onChange={e => update('icp_fit', e.target.value)} />
          <Select label="Lead Source" value={form.lead_source} options={leadSourceOptions} onChange={e => update('lead_source', e.target.value)} />
        </div>

        <Input label="Tags" value={form.tags} onChange={e => update('tags', e.target.value)} placeholder="healthcare, founder, referral (comma-separated)" />

        <Textarea label="Notes" value={form.general_notes} onChange={e => update('general_notes', e.target.value)} rows={3} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Next action" value={form.next_action} onChange={e => update('next_action', e.target.value)} placeholder="Follow up on proposal" />
          <Input label="Action date" type="date" value={form.next_action_date} onChange={e => update('next_action_date', e.target.value)} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !form.first_name.trim()}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
