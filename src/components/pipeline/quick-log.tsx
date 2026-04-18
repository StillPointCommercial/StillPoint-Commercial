'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { Opportunity, EntryType } from '@/lib/types'
import { ENTRY_TYPE_LABELS } from '@/lib/types'
import { createTimelineEntry } from '@/lib/db/timeline'
import { createClient } from '@/lib/supabase/client'

const entryTypeOptions = Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => ({ value, label }))

interface QuickLogProps {
  open: boolean
  onClose: () => void
  opportunity: Opportunity
}

export function QuickLog({ open, onClose, opportunity }: QuickLogProps) {
  const { toast } = useToast()
  const [entryType, setEntryType] = useState<EntryType>('note')
  const [content, setContent] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [nextStepDate, setNextStepDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !opportunity.contact_id) return

      await createTimelineEntry({
        user_id: user.id,
        contact_id: opportunity.contact_id,
        entry_type: entryType,
        title: `[${opportunity.title}] ${ENTRY_TYPE_LABELS[entryType]}`,
        content: content.trim(),
        ai_summary: null,
        outcome: null,
        next_step: nextStep.trim() || null,
        next_step_date: nextStepDate || null,
        entry_date: new Date().toISOString().split('T')[0],
      })

      toast({ title: 'Entry logged', variant: 'success' })
      setContent('')
      setNextStep('')
      setNextStepDate('')
      onClose()
    } catch (err) {
      console.error('Failed to log entry:', err)
      toast({ title: 'Failed to log entry', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Quick Log — ${opportunity.title}`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Select
          label="Type"
          value={entryType}
          options={entryTypeOptions}
          onChange={e => setEntryType(e.target.value as EntryType)}
        />
        <Textarea
          label="What happened? *"
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={3}
          placeholder="Briefly describe the interaction..."
          required
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Next Step"
            value={nextStep}
            onChange={e => setNextStep(e.target.value)}
            placeholder="Follow up on..."
          />
          <Input
            label="Step Date"
            type="date"
            value={nextStepDate}
            onChange={e => setNextStepDate(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !content.trim()}>
            {saving ? 'Saving...' : 'Log Entry'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
