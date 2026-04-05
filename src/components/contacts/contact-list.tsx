'use client'

import { useState, useDeferredValue } from 'react'
import { useContacts } from '@/lib/hooks/use-contacts'
import { ContactCard } from './contact-card'
import { ContactFilters } from './contact-filters'
import { ContactForm } from './contact-form'
import { Fab } from '@/components/ui/fab'
import { Users } from 'lucide-react'
import type { RelationshipStatus, IcpFit } from '@/lib/types'

export function ContactList() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<RelationshipStatus | ''>('')
  const [icp, setIcp] = useState<IcpFit | ''>('')
  const [formOpen, setFormOpen] = useState(false)

  const deferredSearch = useDeferredValue(search)

  const contacts = useContacts({
    search: deferredSearch || undefined,
    status: status || undefined,
    icp: icp || undefined,
  })

  return (
    <>
      <ContactFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        icp={icp}
        onIcpChange={setIcp}
      />

      {contacts.length === 0 ? (
        <div className="text-center py-16">
          <Users size={48} className="mx-auto text-stone mb-4" />
          <p className="text-text-light">
            {search || status || icp
              ? 'No contacts match your filters'
              : 'No contacts yet. Add your first contact.'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {contacts.map(contact => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      )}

      <Fab onClick={() => setFormOpen(true)} label="Add contact" />
      <ContactForm open={formOpen} onClose={() => setFormOpen(false)} />
    </>
  )
}
