import type { TimelineEntry, Contact } from '@/lib/types'
import { ENTRY_TYPE_LABELS } from '@/lib/types'
import { Clock } from 'lucide-react'
import Link from 'next/link'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface RecentActivityProps {
  entries: TimelineEntry[]
  contacts: Contact[]
}

export function RecentActivity({ entries, contacts }: RecentActivityProps) {
  if (entries.length === 0) return null

  const contactMap = new Map(contacts.map(c => [c.id, c]))

  return (
    <div className="mb-6">
      <h2 className="font-dm-serif text-lg text-charcoal mb-3 flex items-center gap-2">
        <Clock size={18} className="text-charcoal-light" />
        Recent Activity
      </h2>
      <div className="space-y-2">
        {entries.map(entry => {
          const contact = contactMap.get(entry.contact_id)
          return (
            <Link
              key={entry.id}
              href={`/contacts/${entry.contact_id}`}
              className="flex items-center justify-between bg-cream border border-border rounded-card p-3 hover:border-terracotta-muted transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-charcoal truncate">
                  <span className="font-medium">
                    {contact ? `${contact.first_name} ${contact.last_name || ''}` : 'Unknown'}
                  </span>
                  {entry.title && <span className="text-text-light"> &mdash; {entry.title}</span>}
                </p>
                <p className="text-xs text-text-light mt-0.5">{ENTRY_TYPE_LABELS[entry.entry_type]}</p>
              </div>
              <span className="text-xs text-warm-gray shrink-0 ml-3">
                {timeAgo(entry.created_at)}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
