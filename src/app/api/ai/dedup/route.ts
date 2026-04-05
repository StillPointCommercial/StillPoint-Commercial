import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

interface ContactForDedup {
  id: string
  first_name: string
  last_name: string | null
  company: string | null
  email: string | null
  phone: string | null
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
    }
  }
  return matrix[b.length][a.length]
}

function findAlgorithmicDuplicates(contacts: ContactForDedup[]) {
  const groups: { contacts: ContactForDedup[]; confidence: 'high' | 'medium' }[] = []
  const seen = new Set<string>()

  for (let i = 0; i < contacts.length; i++) {
    if (seen.has(contacts[i].id)) continue

    const group: ContactForDedup[] = [contacts[i]]

    for (let j = i + 1; j < contacts.length; j++) {
      if (seen.has(contacts[j].id)) continue

      // Exact email match
      const emailI = contacts[i].email
      const emailJ = contacts[j].email
      if (emailI && emailJ && emailI.toLowerCase() === emailJ.toLowerCase()) {
        group.push(contacts[j])
        seen.add(contacts[j].id)
        continue
      }

      // Exact phone match
      const phoneI = contacts[i].phone
      const phoneJ = contacts[j].phone
      if (phoneI && phoneJ) {
        const p1 = phoneI.replace(/\D/g, '')
        const p2 = phoneJ.replace(/\D/g, '')
        if (p1 === p2 && p1.length > 5) {
          group.push(contacts[j])
          seen.add(contacts[j].id)
          continue
        }
      }

      // Name similarity (Levenshtein)
      const name1 = `${contacts[i].first_name} ${contacts[i].last_name || ''}`.toLowerCase().trim()
      const name2 = `${contacts[j].first_name} ${contacts[j].last_name || ''}`.toLowerCase().trim()
      const dist = levenshtein(name1, name2)
      const maxLen = Math.max(name1.length, name2.length)

      if (dist <= 2 && maxLen > 3) {
        // Similar names + same company = likely duplicate
        const compI = contacts[i].company
        const compJ = contacts[j].company
        if (compI && compJ && compI.toLowerCase() === compJ.toLowerCase()) {
          group.push(contacts[j])
          seen.add(contacts[j].id)
        }
      }
    }

    if (group.length > 1) {
      seen.add(contacts[i].id)
      groups.push({ contacts: group, confidence: 'high' })
    }
  }

  return groups
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit check
  const { allowed, remaining } = checkRateLimit(user.id)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429 }
    )
  }

  const { contacts } = await request.json() as { contacts: ContactForDedup[] }

  if (!contacts || !Array.isArray(contacts)) {
    return NextResponse.json({ error: 'Contacts array required' }, { status: 400 })
  }

  if (contacts.length > 500) {
    return NextResponse.json(
      { error: 'Too many contacts (max 500)' },
      { status: 400 }
    )
  }

  // First pass: algorithmic
  const algorithmicGroups = findAlgorithmicDuplicates(contacts)

  // Find ambiguous pairs for AI review (similar names, different companies)
  const ambiguousPairs: { a: ContactForDedup; b: ContactForDedup }[] = []
  const algorithmicIds = new Set(algorithmicGroups.flatMap(g => g.contacts.map(c => c.id)))

  for (let i = 0; i < contacts.length && ambiguousPairs.length < 10; i++) {
    if (algorithmicIds.has(contacts[i].id)) continue
    for (let j = i + 1; j < contacts.length && ambiguousPairs.length < 10; j++) {
      if (algorithmicIds.has(contacts[j].id)) continue

      const name1 = `${contacts[i].first_name} ${contacts[i].last_name || ''}`.toLowerCase().trim()
      const name2 = `${contacts[j].first_name} ${contacts[j].last_name || ''}`.toLowerCase().trim()
      const dist = levenshtein(name1, name2)
      const maxLen = Math.max(name1.length, name2.length)

      if (dist <= 3 && maxLen > 3 && dist / maxLen < 0.4) {
        ambiguousPairs.push({ a: contacts[i], b: contacts[j] })
      }
    }
  }

  // Second pass: AI for ambiguous cases
  let aiGroups: typeof algorithmicGroups = []
  if (ambiguousPairs.length > 0) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const message = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Review these contact pairs and determine if they are likely the same person. Return a JSON array of objects with {pair_index: number, is_duplicate: boolean, reason: string}.\n\n${
            ambiguousPairs.map((p, i) =>
              `Pair ${i}: "${p.a.first_name} ${p.a.last_name}" at "${p.a.company || 'unknown'}" vs "${p.b.first_name} ${p.b.last_name}" at "${p.b.company || 'unknown'}"`
            ).join('\n')
          }`,
        }],
      })

      const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
      const results = JSON.parse(text)

      for (const result of results) {
        if (result.is_duplicate && ambiguousPairs[result.pair_index]) {
          const pair = ambiguousPairs[result.pair_index]
          aiGroups.push({
            contacts: [pair.a, pair.b],
            confidence: 'medium',
          })
        }
      }
    } catch (error: any) {
      console.error('AI dedup error:', error?.message || error)
    }
  }

  return NextResponse.json({
    groups: [...algorithmicGroups, ...aiGroups],
    totalContacts: contacts.length,
    duplicateGroups: algorithmicGroups.length + aiGroups.length,
  })
}
