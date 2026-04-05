import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

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

  const { transcript, contacts } = await request.json()

  if (!transcript || !contacts || !Array.isArray(contacts)) {
    return NextResponse.json({ error: 'Transcript and contacts array required' }, { status: 400 })
  }

  if (typeof transcript === 'string' && transcript.length > 50000) {
    return NextResponse.json(
      { error: 'Transcript too long (max 50,000 characters)' },
      { status: 400 }
    )
  }

  if (contacts.length > 500) {
    return NextResponse.json(
      { error: 'Too many contacts (max 500)' },
      { status: 400 }
    )
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const contactList = contacts.map((c: any) =>
      `- ${c.first_name} ${c.last_name || ''} (${c.company || 'no company'})`
    ).join('\n')

    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Given this transcript, which of the following contacts is most likely the person in this conversation? Return JSON: {contact_index: number, confidence: "high"|"medium"|"low", reason: string}. If no match, return {contact_index: -1, confidence: "low", reason: "..."}.

Contacts:
${contactList}

Transcript (first 1000 chars):
${transcript.slice(0, 1000)}`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const result = JSON.parse(text)

    return NextResponse.json({
      ...result,
      matched_contact: result.contact_index >= 0 ? contacts[result.contact_index] : null,
    })
  } catch (error: any) {
    console.error('AI match-contact error:', error?.message || error)
    return NextResponse.json(
      { error: 'Contact matching failed. Please try again.' },
      { status: 500 }
    )
  }
}
