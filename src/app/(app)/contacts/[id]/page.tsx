'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useContact } from '@/lib/hooks/use-contacts'
import { ContactHeader } from '@/components/contacts/contact-header'
import { TimelineFeed } from '@/components/timeline/timeline-feed'
import { TimelineEntryForm } from '@/components/timeline/timeline-entry-form'
import { LinkedOpportunities } from '@/components/contacts/linked-opportunities'
import { Fab } from '@/components/ui/fab'

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const contact = useContact(id)
  const [entryFormOpen, setEntryFormOpen] = useState(false)

  if (contact === undefined) {
    return <div className="text-text-light py-8">Loading contact...</div>
  }

  if (contact === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-text-light mb-4">Contact not found</p>
        <a href="/contacts" className="text-accent underline">Back to contacts</a>
      </div>
    )
  }

  return (
    <div>
      <ContactHeader contact={contact} />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-dm-serif text-lg text-charcoal">Timeline</h2>
      </div>

      <TimelineFeed contactId={id} />
      <LinkedOpportunities contactId={id} />

      <Fab onClick={() => setEntryFormOpen(true)} label="Add entry" />
      <TimelineEntryForm
        open={entryFormOpen}
        onClose={() => setEntryFormOpen(false)}
        contactId={id}
      />
    </div>
  )
}
