'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import type { Contact, TimelineEntry } from '@/lib/types'

const GOING_COLD_DAYS = 14

/** Contact enriched with its interaction count */
export type ContactWithStats = Contact & { interactionCount: number }

/** A planned action derived from contacts or timeline next-steps */
export interface PlannedAction {
  contactId: string
  contactName: string
  company?: string
  action: string
  date: string // YYYY-MM-DD
  source: 'contact' | 'timeline' // where the action came from
}

export function useDashboardData() {
  return useLiveQuery(async () => {
    const today = new Date().toISOString().split('T')[0]
    const coldCutoff = new Date()
    coldCutoff.setDate(coldCutoff.getDate() - GOING_COLD_DAYS)
    const coldDate = coldCutoff.toISOString().split('T')[0]

    // End of week (Sunday)
    const weekEnd = new Date()
    weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()))
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    const contacts = await db.contacts.toArray()
    const opportunities = await db.opportunities.toArray()
    const allEntries = await db.timeline_entries.toArray()

    // Build interaction count per contact
    const interactionCountByContact = new Map<string, number>()
    for (const entry of allEntries) {
      interactionCountByContact.set(
        entry.contact_id,
        (interactionCountByContact.get(entry.contact_id) || 0) + 1
      )
    }

    // Active conversations: warming or active status
    const activeConversations = contacts.filter(
      c => c.relationship_status === 'warming' || c.relationship_status === 'active'
    ).length

    // Pipeline value: sum of in-progress opportunities (exclude won/lost/paused)
    const pipelineValue = opportunities
      .filter(o => o.stage !== 'lost' && o.stage !== 'paused' && o.stage !== 'active_client')
      .reduce((sum, o) => sum + (o.estimated_value || 0), 0)

    // Secured value: sum of active_client (won deals)
    const securedValue = opportunities
      .filter(o => o.stage === 'active_client')
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
    const recent = allEntries
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10)

    // ---- Planned Actions (forward-looking) ----
    const plannedActions: PlannedAction[] = []
    const contactMap = new Map(contacts.map(c => [c.id, c]))

    // 1. From contact next_action fields (today and future)
    for (const c of contacts) {
      if (c.next_action && c.next_action_date && c.next_action_date >= today) {
        plannedActions.push({
          contactId: c.id,
          contactName: `${c.first_name} ${c.last_name || ''}`.trim(),
          company: c.company || undefined,
          action: c.next_action,
          date: c.next_action_date,
          source: 'contact',
        })
      }
    }

    // 2. From timeline entry next_step fields (future)
    for (const entry of allEntries) {
      if (entry.next_step && entry.next_step_date && entry.next_step_date >= today) {
        const contact = contactMap.get(entry.contact_id)
        if (contact) {
          // Avoid duplicating if contact already has same action on same date
          const isDup = plannedActions.some(
            a => a.contactId === entry.contact_id && a.date === entry.next_step_date && a.action === entry.next_step
          )
          if (!isDup) {
            plannedActions.push({
              contactId: entry.contact_id,
              contactName: `${contact.first_name} ${contact.last_name || ''}`.trim(),
              company: contact.company || undefined,
              action: entry.next_step,
              date: entry.next_step_date,
              source: 'timeline',
            })
          }
        }
      }
    }

    // Sort by date ascending
    plannedActions.sort((a, b) => a.date.localeCompare(b.date))

    // Split into today and this week
    const todayActions = plannedActions.filter(a => a.date === today)
    const weekActions = plannedActions.filter(a => a.date > today && a.date <= weekEndStr)
    const laterActions = plannedActions.filter(a => a.date > weekEndStr)

    return {
      activeConversations,
      pipelineValue,
      securedValue,
      overdueCount: overdueContacts.length,
      overdueContacts,
      goingCold,
      recentActivity: recent,
      contacts,
      interactionCountByContact,
      plannedActions: { today: todayActions, week: weekActions, later: laterActions },
    }
  })
}
