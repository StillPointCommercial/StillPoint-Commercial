'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import { ArrowLeft, Phone, Mail, Linkedin, Pencil, Trash2, AlertCircle, MessageCircle } from 'lucide-react'
import type { Contact } from '@/lib/types'
import { StatusBadge, IcpBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContactForm } from './contact-form'
import { useToast } from '@/components/ui/toast'
import { deleteContact } from '@/lib/db/contacts'

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date(new Date().toISOString().split('T')[0])
}

export function ContactHeader({ contact }: { contact: Contact }) {
  const router = useRouter()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const overdue = isOverdue(contact.next_action_date)

  // Count total interactions for this contact
  const interactionCount = useLiveQuery(
    () => db.timeline_entries.where('contact_id').equals(contact.id).count(),
    [contact.id]
  ) ?? 0

  async function handleDelete() {
    await deleteContact(contact.id)
    toast({ title: 'Contact deleted', variant: 'success' })
    router.push('/contacts')
  }

  return (
    <>
      <div className="mb-6">
        <button
          onClick={() => router.push('/contacts')}
          className="flex items-center gap-1 text-text-light hover:text-charcoal text-sm mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          Contacts
        </button>

        <div className="bg-cream border border-border rounded-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-dm-serif text-2xl text-charcoal">
                {contact.first_name} {contact.last_name}
              </h1>
              {(contact.company || contact.role) && (
                <p className="text-text-light mt-0.5">
                  {contact.role}{contact.role && contact.company ? ' at ' : ''}{contact.company}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>

          {showDeleteConfirm && (
            <div className="mt-3 p-3 rounded-xl border border-red-200 bg-red-50">
              <p className="text-sm text-charcoal mb-2">
                Are you sure? This will delete all related data.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="danger" onClick={handleDelete}>
                  Delete
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            <StatusBadge status={contact.relationship_status} />
            <IcpBadge icp={contact.icp_fit} />
            <span className="text-xs bg-sand px-2 py-0.5 rounded-badge text-muted-bronze flex items-center gap-1">
              <MessageCircle size={10} />
              {interactionCount} {interactionCount === 1 ? 'interaction' : 'interactions'}
            </span>
            {contact.tags.map(tag => (
              <span key={tag} className="text-xs bg-sand px-2 py-0.5 rounded-badge text-muted-bronze">
                {tag}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-terracotta hover:underline">
                <Phone size={14} /> {contact.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-terracotta hover:underline">
                <Mail size={14} /> {contact.email}
              </a>
            )}
            {contact.linkedin_url && (
              <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-terracotta hover:underline">
                <Linkedin size={14} /> LinkedIn
              </a>
            )}
          </div>

          {contact.next_action && (
            <div className={`mt-4 p-3 rounded-input border ${overdue ? 'border-attention-red/30 bg-attention-red/5' : 'border-border bg-sand-light'}`}>
              <p className={`text-sm font-medium ${overdue ? 'text-attention-red' : 'text-charcoal'}`}>
                {overdue && <AlertCircle size={14} className="inline mr-1" />}
                Next: {contact.next_action}
              </p>
              {contact.next_action_date && (
                <p className={`text-xs mt-0.5 ${overdue ? 'text-attention-red/70' : 'text-text-light'}`}>
                  {new Date(contact.next_action_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
              )}
            </div>
          )}

          {contact.general_notes && (
            <p className="text-sm text-text-light mt-4 whitespace-pre-wrap">{contact.general_notes}</p>
          )}
        </div>
      </div>

      <ContactForm open={editing} onClose={() => setEditing(false)} contact={contact} />
    </>
  )
}
