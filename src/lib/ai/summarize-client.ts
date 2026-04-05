export interface TranscriptSummary {
  participants: string[]
  key_topics: string[]
  summary: string
  action_items: string[]
  suggested_next_step: string
  sentiment: 'positive' | 'neutral' | 'cautious'
}

export async function summarizeTranscript(
  transcript: string,
  contactName?: string
): Promise<TranscriptSummary> {
  const response = await fetch('/api/ai/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, contactName }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Failed to summarize')
  }

  return response.json()
}
