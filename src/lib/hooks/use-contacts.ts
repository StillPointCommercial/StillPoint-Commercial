'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import type { Contact, RelationshipStatus, IcpFit } from '@/lib/types'

interface UseContactsOptions {
  search?: string
  status?: RelationshipStatus
  icp?: IcpFit
  tag?: string
}

export function useContacts(options: UseContactsOptions = {}) {
  const { search, status, icp, tag } = options

  const contacts = useLiveQuery(async () => {
    let results = await db.contacts.toArray()

    if (status) {
      results = results.filter(c => c.relationship_status === status)
    }
    if (icp) {
      results = results.filter(c => c.icp_fit === icp)
    }
    if (tag) {
      results = results.filter(c => c.tags.includes(tag))
    }
    if (search) {
      const q = search.toLowerCase()
      results = results.filter(c =>
        c.first_name.toLowerCase().includes(q) ||
        (c.last_name?.toLowerCase().includes(q)) ||
        (c.company?.toLowerCase().includes(q)) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    // Sort: oldest last_contact_date first (surface neglected contacts)
    return results.sort((a, b) => {
      const aDate = a.last_contact_date || '1970-01-01'
      const bDate = b.last_contact_date || '1970-01-01'
      return aDate.localeCompare(bDate)
    })
  }, [search, status, icp, tag])

  return contacts ?? []
}

export function useContact(id: string) {
  return useLiveQuery(
    async () => (await db.contacts.get(id)) ?? null,
    [id]
  )
}
