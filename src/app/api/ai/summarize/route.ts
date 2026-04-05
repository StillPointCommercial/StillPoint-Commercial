import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

const SYSTEM_PROMPT = `You are a meeting analysis assistant for a strategic business advisor.
Analyze the provided transcript and extract structured information.

Return a JSON object with these fields:
- participants: string[] (names mentioned in the transcript)
- key_topics: string[] (main topics discussed, 3-5 items)
- summary: string (2-3 paragraph summary of the conversation)
- action_items: string[] (specific next steps or commitments made)
- suggested_next_step: string (the single most important follow-up action)
- sentiment: "positive" | "neutral" | "cautious" (overall tone of the conversation)

Return ONLY valid JSON, no markdown formatting.`

export async function POST(request: Request) {
  // Auth check
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

  const { transcript, contactName } = await request.json()

  if (!transcript || typeof transcript !== 'string') {
    return NextResponse.json({ error: 'Transcript text is required' }, { status: 400 })
  }

  if (transcript.length > 50000) {
    return NextResponse.json(
      { error: 'Transcript too long (max 50,000 characters)' },
      { status: 400 }
    )
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${contactName ? `This is a conversation with ${contactName}.\n\n` : ''}Transcript:\n\n${transcript}`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      // If Claude didn't return valid JSON, wrap the text
      parsed = {
        participants: [],
        key_topics: [],
        summary: text,
        action_items: [],
        suggested_next_step: '',
        sentiment: 'neutral',
      }
    }

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('AI summarize error:', error?.message || error)
    return NextResponse.json(
      { error: 'Summarization failed. Please try again.' },
      { status: 500 }
    )
  }
}
