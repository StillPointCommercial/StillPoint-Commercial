'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'

const GOING_COLD_DAYS = 14

export function useDashboardData() {
  return useLiveQuery(async () => {
    const today = new Date().toISOString().split('T')[0]
    const coldCutoff = new Date()
    coldCutoff.setDate(coldCutoff.getDate() - GOING_COLD_DAYS)
    const coldDate = coldCutoff.toISOString().split('T')[0]

    const contacts = await db.contacts.toArray()
    const opportunities = await db.opportunities.toArray()
    const recentEntries = await db.timeline_entries.toArray()

    // Active conversations: warming or active status
    const activeConversations = contacts.filter(
      c => c.relationship_status === 'warming' || c.relationship_status === 'active'
    ).length

    // Pipeline value: sum of all non-lost/paused opportunities
    const pipelineValue = opportunities
      .filter(o => o.stage !== 'lost' && o.stage !== 'paused')
      .reduce((sum, o) => sum + (o.estimated_value || 0), 0)

    // Overdue actions: contacts with next_action_date before today
    const overdueContacts = contacts
      .filter(c => c.next_action_date && c.next_action_date < today && c.next_action)
      .sort((a, b) => (a.next_action_date || '').localeCompare(b.next_action_date || ''))

    // Going cold: warming/active contacts not contacted in 14+ days
    const goingCold = contacts
      .filter(c =>
        (c.relationship_status === 'warming' || c.relationship_status === 'active') &&
        (!c.last_contact_date || c.last_contact_date < coldDate)
      )
      .sort((a, b) => (a.last_contact_date || '1970-01-01').localeCompare(b.last_contact_date || '1970-01-01'))

    // Recent activity: last 10 entries
    const recent = recentEntries
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10)

    return {
      activeConversations,
      pipelineValue,
      overdueCount: overdueContacts.length,
      overdueContacts,
      goingCold,
      recentActivity: recent,
      contacts, // for name lookups
    }
  })
}
