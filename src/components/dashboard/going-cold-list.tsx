import Link from 'next/link'
import type { Contact } from '@/lib/types'
import { Thermometer } from 'lucide-react'

function daysSince(dateStr: string | null): string {
  if (!dateStr) return 'Never contacted'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  return `${days}d ago`
}

export function GoingColdList({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) return null

  return (
    <div className="mb-6">
      <h2 className="font-dm-serif text-lg text-charcoal mb-3 flex items-center gap-2">
        <Thermometer size={18} className="text-caution-amber" />
        Going Cold
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
            </div>
            <span className="text-xs text-caution-amber shrink-0 ml-3">
              {daysSince(contact.last_contact_date)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
