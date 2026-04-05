import Link from 'next/link'
import type { Contact } from '@/lib/types'
import { AlertCircle } from 'lucide-react'

function daysOverdue(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function AttentionList({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) return null

  return (
    <div className="mb-6">
      <h2 className="font-dm-serif text-lg text-charcoal mb-3 flex items-center gap-2">
        <AlertCircle size={18} className="text-attention-red" />
        Needs Attention
      </h2>
      <div className="space-y-2">
        {contacts.slice(0, 5).map(contact => (
          <Link
            key={contact.id}
            href={`/contacts/${contact.id}`}
            className="flex items-center justify-between bg-cream border border-border rounded-card p-3 hover:border-terracotta-muted transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-charcoal truncate">
                {contact.first_name} {contact.last_name}
                {contact.company && <span className="text-text-light font-normal"> &middot; {contact.company}</span>}
              </p>
              <p className="text-xs text-text-light truncate mt-0.5">{contact.next_action}</p>
            </div>
            <span className="text-xs font-medium text-attention-red shrink-0 ml-3">
              {daysOverdue(contact.next_action_date!)}d overdue
            </span>
          </Link>
        ))}
        {contacts.length > 5 && (
          <Link href="/contacts" className="text-xs text-terracotta hover:underline">
            View all {contacts.length} overdue
          </Link>
        )}
      </div>
    </div>
  )
}
