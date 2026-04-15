'use client'

import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import type { Opportunity, OpportunityStage, Contact } from '@/lib/types'
import { STAGE_LABELS, ACTIVE_STAGES } from '@/lib/types'
import { OpportunityCard } from './opportunity-card'
import { OpportunityForm } from './opportunity-form'
import { updateOpportunity } from '@/lib/db/opportunities'
import { Fab } from '@/components/ui/fab'
import { Select } from '@/components/ui/select'

export function KanbanBoard() {
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [draggedOpp, setDraggedOpp] = useState<Opportunity | null>(null)

  const opportunities = useLiveQuery(() => db.opportunities.toArray()) ?? []
  const contacts = useLiveQuery(() => db.contacts.toArray()) ?? []
  const contactMap = new Map(contacts.map((c: Contact) => [c.id, c]))

  // Build interaction count per contact for display on opportunity cards
  const interactionCounts = useLiveQuery(async () => {
    const entries = await db.timeline_entries.toArray()
    const counts = new Map<string, number>()
    for (const e of entries) {
      counts.set(e.contact_id, (counts.get(e.contact_id) || 0) + 1)
    }
    return counts
  }) ?? new Map<string, number>()

  function handleDragStart(e: React.DragEvent, opp: Opportunity) {
    // Prevent dragging won deals back into the pipeline
    if (opp.stage === 'active_client') {
      e.preventDefault()
      return
    }
    setDraggedOpp(opp)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e: React.DragEvent, stage: OpportunityStage) {
    e.preventDefault()
    if (draggedOpp && draggedOpp.stage !== stage) {
      await updateOpportunity(draggedOpp.id, { stage })
    }
    setDraggedOpp(null)
  }

  const stageValue = useCallback((stage: OpportunityStage) => {
    return opportunities
      .filter((o: Opportunity) => o.stage === stage)
      .reduce((sum: number, o: Opportunity) => sum + (o.estimated_value || 0), 0)
  }, [opportunities])

  if (opportunities.length === 0) {
    return (
      <>
        <div className="text-center py-16">
          <p className="text-text-light mb-2">No opportunities yet.</p>
          <p className="text-sm text-text-light mb-4">
            Create one from a{' '}
            <a href="/contacts" className="text-terracotta underline hover:text-[#a07860]">
              contact page
            </a>
            , or use the button below.
          </p>
        </div>
        <Fab onClick={() => { setEditingOpp(null); setFormOpen(true) }} label="Add opportunity" />
        <OpportunityForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingOpp(null) }}
          opportunity={editingOpp ?? undefined}
        />
      </>
    )
  }

  return (
    <>
      {/* Desktop: horizontal kanban */}
      <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
        {ACTIVE_STAGES.map(stage => {
          const stageOpps = opportunities.filter((o: Opportunity) => o.stage === stage)
          const value = stageValue(stage)

          return (
            <div
              key={stage}
              className="flex-shrink-0 w-64"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
            >
              <div className="mb-3">
                <h3 className="font-medium text-sm text-charcoal">{STAGE_LABELS[stage]}</h3>
                <p className="text-xs text-text-light">
                  {stageOpps.length} {stageOpps.length === 1 ? 'opp' : 'opps'}
                  {value > 0 && ` · \u20AC${value.toLocaleString()}`}
                </p>
              </div>
              <div className={`space-y-2 min-h-[100px] rounded-card p-2 transition-colors ${
                draggedOpp ? 'bg-sand-light border-2 border-dashed border-sand' : ''
              }`}>
                {stageOpps.map((opp: Opportunity) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    contact={opp.contact_id ? contactMap.get(opp.contact_id) : undefined}
                    onEdit={(o) => { setEditingOpp(o); setFormOpen(true) }}
                    onDragStart={handleDragStart}
                    interactionCount={opp.contact_id ? interactionCounts.get(opp.contact_id) ?? 0 : undefined}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile: grouped list with stage selector */}
      <div className="md:hidden space-y-4">
        {ACTIVE_STAGES.map(stage => {
          const stageOpps = opportunities.filter((o: Opportunity) => o.stage === stage)
          if (stageOpps.length === 0) return null

          return (
            <div key={stage}>
              <h3 className="font-medium text-sm text-charcoal mb-2">
                {STAGE_LABELS[stage]} ({stageOpps.length})
              </h3>
              <div className="space-y-2">
                {stageOpps.map((opp: Opportunity) => (
                  <div key={opp.id} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <OpportunityCard
                        opportunity={opp}
                        contact={opp.contact_id ? contactMap.get(opp.contact_id) : undefined}
                        onEdit={(o) => { setEditingOpp(o); setFormOpen(true) }}
                        interactionCount={opp.contact_id ? interactionCounts.get(opp.contact_id) ?? 0 : undefined}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Paused/Lost section */}
      {opportunities.filter((o: Opportunity) => o.stage === 'paused' || o.stage === 'lost').length > 0 && (
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="font-dm-serif text-lg text-charcoal-light mb-3">Paused & Lost</h3>
          <div className="space-y-2">
            {opportunities
              .filter((o: Opportunity) => o.stage === 'paused' || o.stage === 'lost')
              .map((opp: Opportunity) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  contact={opp.contact_id ? contactMap.get(opp.contact_id) : undefined}
                  onEdit={(o) => { setEditingOpp(o); setFormOpen(true) }}
                  interactionCount={opp.contact_id ? interactionCounts.get(opp.contact_id) ?? 0 : undefined}
                />
              ))
            }
          </div>
        </div>
      )}

      <Fab onClick={() => { setEditingOpp(null); setFormOpen(true) }} label="Add opportunity" />
      <OpportunityForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingOpp(null) }}
        opportunity={editingOpp ?? undefined}
      />
    </>
  )
}
