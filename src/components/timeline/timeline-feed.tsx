'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import type { TimelineEntry } from '@/lib/types'
import { ENTRY_TYPE_LABELS } from '@/lib/types'
import { FileText, Phone, Users, Mail, Mic, ChevronDown, ChevronUp } from 'lucide-react'

const typeIcons: Record<string, typeof FileText> = {
  note: FileText,
  call: Phone,
  meeting: Users,
  email: Mail,
  transcript: Mic,
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function TimelineCard({ entry }: { entry: TimelineEntry }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = typeIcons[entry.entry_type] || FileText
  const hasMore = (entry.content && entry.content.length > 200) || entry.ai_summary || entry.outcome

  return (
    <div className="bg-cream border border-border rounded-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-1.5 rounded-badge bg-sand">
          <Icon size={14} className="text-charcoal-light" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs text-text-light">{formatDate(entry.entry_date)}</span>
              <span className="text-xs text-warm-gray mx-1.5">&middot;</span>
              <span className="text-xs text-muted-bronze">{ENTRY_TYPE_LABELS[entry.entry_type]}</span>
            </div>
          </div>

          {entry.title && (
            <h4 className="font-medium text-sm text-charcoal mt-1">{entry.title}</h4>
          )}

          {entry.content && (
            <p className="text-sm text-text mt-1 whitespace-pre-wrap">
              {expanded ? entry.content : entry.content.slice(0, 200)}
              {!expanded && entry.content.length > 200 && '...'}
            </p>
          )}

          {expanded && entry.ai_summary && (
            <div className="mt-3 p-3 rounded-input bg-sand-light border border-sand">
              <p className="text-xs font-medium text-muted-bronze mb-1">AI Summary</p>
              <p className="text-sm text-text whitespace-pre-wrap">{entry.ai_summary}</p>
            </div>
          )}

          {expanded && entry.outcome && (
            <div className="mt-2">
              <p className="text-xs font-medium text-muted-bronze">Outcome</p>
              <p className="text-sm text-text">{entry.outcome}</p>
            </div>
          )}

          {expanded && entry.next_step && (
            <div className="mt-2">
              <p className="text-xs font-medium text-muted-bronze">Next step</p>
              <p className="text-sm text-text">
                {entry.next_step}
                {entry.next_step_date && (
                  <span className="text-text-light ml-1">({formatDate(entry.next_step_date)})</span>
                )}
              </p>
            </div>
          )}

          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-terracotta hover:underline mt-2"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function TimelineFeed({ contactId }: { contactId: string }) {
  const entries = useLiveQuery(
    () => db.timeline_entries
      .where('contact_id')
      .equals(contactId)
      .toArray()
      .then(arr => arr.sort((a, b) => b.entry_date.localeCompare(a.entry_date))),
    [contactId]
  )

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-8 text-text-light text-sm">
        No timeline entries yet. Add your first interaction.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map(entry => (
        <TimelineCard key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
