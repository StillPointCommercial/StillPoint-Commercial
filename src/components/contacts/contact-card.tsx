'use client'

import Link from 'next/link'
import type { Contact } from '@/lib/types'
import { STATUS_LABELS, ICP_LABELS } from '@/lib/types'
import { StatusBadge, IcpBadge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date(new Date().toISOString().split('T')[0])
}

export function ContactCard({ contact }: { contact: Contact }) {
  const overdue = isOverdue(contact.next_action_date)
  const lastContactDays = daysAgo(contact.last_contact_date)

  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="block bg-cream border border-border rounded-card p-4 hover:border-terracotta-muted transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-charcoal truncate">
            {contact.first_name} {contact.last_name}
          </h3>
          {contact.company && (
            <p className="text-text-light text-sm truncate">{contact.company}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={contact.relationship_status} />
          {contact.icp_fit !== 'not_assessed' && (
            <IcpBadge icp={contact.icp_fit} />
          )}
        </div>
      </div>

      {contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {contact.tags.map(tag => (
            <span key={tag} className="text-xs bg-sand px-1.5 py-0.5 rounded-badge text-muted-bronze">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 text-xs text-text-light">
        <span>
          {lastContactDays !== null
            ? lastContactDays === 0
              ? 'Contacted today'
              : `${lastContactDays}d ago`
            : 'No contact logged'
          }
        </span>

        {contact.next_action && (
          <span className={`flex items-center gap-1 ${overdue ? 'text-attention-red font-medium' : ''}`}>
            {overdue && <AlertCircle size={12} />}
            {contact.next_action}
          </span>
        )}
      </div>
    </Link>
  )
}
