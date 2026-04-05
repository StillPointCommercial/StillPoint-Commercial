'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { EntryType } from '@/lib/types'
import { ENTRY_TYPE_LABELS } from '@/lib/types'
import { createTimelineEntry } from '@/lib/db/timeline'
import { updateContact } from '@/lib/db/contacts'
import { createClient } from '@/lib/supabase/client'
import { summarizeTranscript } from '@/lib/ai/summarize-client'
import { Sparkles } from 'lucide-react'

interface TimelineEntryFormProps {
  open: boolean
  onClose: () => void
  contactId: string
}

const entryTypeOptions = Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => ({ value, label }))

export function TimelineEntryForm({ open, onClose, contactId }: TimelineEntryFormProps) {
  const today = new Date().toISOString().split('T')[0]
  const { toast } = useToast()

  const [form, setForm] = useState({
    entry_type: 'note' as EntryType,
    title: '',
    content: '',
    outcome: '',
    next_step: '',
    next_step_date: '',
    entry_date: today,
  })

  const [saving, setSaving] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [aiSummary, setAiSummary] = useState('')

  async function handleSummarize() {
    if (!form.content.trim()) return
    setSummarizing(true)
    try {
      const result = await summarizeTranscript(form.content)
      setAiSummary(result.summary)
      if (result.suggested_next_step && !form.next_step) {
        update('next_step', result.suggested_next_step)
      }
      if (result.action_items.length > 0 && !form.outcome) {
        update('outcome', result.action_items.join('; '))
      }
    } catch (e) {
      console.error('Summarize failed:', e)
      toast({ title: 'Summarization failed', variant: 'error' })
    } finally {
      setSummarizing(false)
    }
  }

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function reset() {
    setForm({
      entry_type: 'note',
      title: '',
      content: '',
      outcome: '',
      next_step: '',
      next_step_date: '',
      entry_date: today,
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await createTimelineEntry({
        user_id: user.id,
        contact_id: contactId,
        entry_type: form.entry_type,
        title: form.title.trim() || null,
        content: form.content.trim() || null,
        ai_summary: aiSummary || null,
        outcome: form.outcome.trim() || null,
        next_step: form.next_step.trim() || null,
        next_step_date: form.next_step_date || null,
        entry_date: form.entry_date,
      })

      // Update contact's next action if a next step was provided
      if (form.next_step.trim()) {
        await updateContact(contactId, {
          next_action: form.next_step.trim(),
          next_action_date: form.next_step_date || null,
        })
      }

      toast({ title: 'Entry saved', variant: 'success' })
      reset()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Timeline Entry">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Type"
            value={form.entry_type}
            options={entryTypeOptions}
            onChange={e => update('entry_type', e.target.value)}
          />
          <Input
            label="Date"
            type="date"
            value={form.entry_date}
            onChange={e => update('entry_date', e.target.value)}
          />
        </div>

        <Input
          label="Title"
          value={form.title}
          onChange={e => update('title', e.target.value)}
          placeholder="Intro call, Coffee catch-up..."
        />

        <Textarea
          label={form.entry_type === 'transcript' ? 'Transcript / Notes' : 'Content'}
          value={form.content}
          onChange={e => update('content', e.target.value)}
          rows={form.entry_type === 'transcript' ? 8 : 4}
          placeholder={form.entry_type === 'transcript' ? 'Paste transcript text here...' : 'What happened?'}
        />

        {form.entry_type === 'transcript' && form.content.trim().length > 50 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSummarize}
            disabled={summarizing}
          >
            <Sparkles size={14} />
            {summarizing ? 'Summarizing...' : 'Summarize with AI'}
          </Button>
        )}

        {aiSummary && (
          <div className="p-3 rounded-input bg-sand-light border border-sand">
            <p className="text-xs font-medium text-muted-bronze mb-1">AI Summary</p>
            <p className="text-sm text-text whitespace-pre-wrap">{aiSummary}</p>
          </div>
        )}

        <Input
          label="Outcome"
          value={form.outcome}
          onChange={e => update('outcome', e.target.value)}
          placeholder="What was the result?"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Next step"
            value={form.next_step}
            onChange={e => update('next_step', e.target.value)}
            placeholder="Send proposal, Schedule follow-up..."
          />
          <Input
            label="When"
            type="date"
            value={form.next_step_date}
            onChange={e => update('next_step_date', e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Entry'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
