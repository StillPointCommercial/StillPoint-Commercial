interface ContactForDedup {
  id: string
  first_name: string
  last_name: string | null
  company: string | null
  email: string | null
  phone: string | null
}

export interface DedupGroup {
  contacts: ContactForDedup[]
  confidence: 'high' | 'medium'
}

export interface DedupResult {
  groups: DedupGroup[]
  totalContacts: number
  duplicateGroups: number
}

export async function findDuplicates(contacts: ContactForDedup[]): Promise<DedupResult> {
  const response = await fetch('/api/ai/dedup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contacts }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Failed to check duplicates')
  }

  return response.json()
}
