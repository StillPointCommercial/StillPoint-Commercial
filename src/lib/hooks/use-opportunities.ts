'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import type { OpportunityStage } from '@/lib/types'

export function useOpportunities(stage?: OpportunityStage) {
  return useLiveQuery(async () => {
    if (stage) {
      return db.opportunities.where('stage').equals(stage).toArray()
    }
    return db.opportunities.toArray()
  }, [stage]) ?? []
}

export function useOpportunitiesForContact(contactId: string) {
  return useLiveQuery(
    () => db.opportunities.where('contact_id').equals(contactId).toArray(),
    [contactId]
  ) ?? []
}
