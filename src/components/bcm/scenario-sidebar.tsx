'use client'

import { useState } from 'react'
import { Check, Copy, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { cx } from '@/components/suite/ui'
import { fmtM } from '@/lib/bcm/format'
import type { ScenarioRow } from '@/lib/bcm/store'

export function ScenarioSidebar({
  scenarios,
  activeId,
  total2030,
  busy,
  onSelect,
  onRename,
  onSave,
  onNew,
  onDuplicate,
  onDelete,
}: {
  scenarios: ScenarioRow[]
  activeId: string | null
  total2030: number
  busy: boolean
  onSelect: (s: ScenarioRow) => void
  onRename: (id: string, name: string) => void
  onSave: (name: string) => void
  onNew: (name: string) => void
  onDuplicate: () => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')

  function startEdit(s: ScenarioRow) {
    setEditingId(s.id)
    setEditVal(s.name)
  }
  function commitEdit() {
    if (editingId && editVal.trim()) onRename(editingId, editVal.trim())
    setEditingId(null)
  }

  const active = scenarios.find((s) => s.id === activeId) ?? null

  return (
    <aside className="space-y-4">
      <div className="rounded-xl border border-suite-border bg-suite-bg">
        <div className="border-b border-suite-border px-4 py-3">
          <h3 className="text-sm font-semibold text-suite-ink">Scenarios</h3>
          <p className="mt-0.5 text-xs text-suite-ink-3">Saved per dataset</p>
        </div>
        <div className="max-h-[360px] overflow-auto p-2">
          {scenarios.length === 0 && (
            <p className="px-2 py-4 text-xs text-suite-ink-3">No scenarios yet.</p>
          )}
          <ul className="space-y-1">
            {scenarios.map((s) => {
              const isActive = s.id === activeId
              return (
                <li key={s.id}>
                  {editingId === s.id ? (
                    <div className="flex items-center gap-1 px-1">
                      <input
                        autoFocus
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit()
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="min-w-0 flex-1 rounded-md border border-suite-border px-2 py-1 text-xs text-suite-ink outline-none focus:border-suite-accent"
                      />
                      <button
                        onClick={commitEdit}
                        className="grid h-6 w-6 place-items-center rounded text-suite-accent hover:bg-suite-panel"
                        title="Save name"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="grid h-6 w-6 place-items-center rounded text-suite-ink-3 hover:bg-suite-panel"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={cx(
                        'group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors',
                        isActive ? 'bg-suite-accent-tint' : 'hover:bg-suite-subtle',
                      )}
                    >
                      <button
                        onClick={() => onSelect(s)}
                        className="min-w-0 flex-1 text-left"
                        title={s.name}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cx(
                              'truncate text-sm',
                              isActive ? 'font-semibold text-suite-accent-dark' : 'text-suite-ink',
                            )}
                          >
                            {s.name}
                          </span>
                          {s.is_baseline && (
                            <span className="shrink-0 rounded-full bg-suite-slate px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-white">
                              base
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => startEdit(s)}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded text-suite-ink-3 opacity-0 transition-opacity hover:bg-suite-panel hover:text-suite-ink group-hover:opacity-100"
                        title="Rename"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => onDelete(s.id)}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded text-suite-ink-3 opacity-0 transition-opacity hover:bg-suite-neg-bg hover:text-suite-neg group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="space-y-2 border-t border-suite-border p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-wide text-suite-ink-3">2030 total</span>
            <span className="text-sm font-semibold tabular-nums text-suite-accent">{fmtM(total2030)}</span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New scenario name"
            className="w-full rounded-md border border-suite-border px-2.5 py-1.5 text-xs text-suite-ink outline-none placeholder:text-suite-ink-3 focus:border-suite-accent"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={busy}
              onClick={() => {
                onSave(name.trim() || active?.name || 'Scenario')
                setName('')
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-suite-accent px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-suite-accent-dark disabled:opacity-50"
            >
              <Save size={13} /> Save
            </button>
            <button
              disabled={busy}
              onClick={() => {
                onNew(name.trim() || 'New scenario')
                setName('')
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-suite-border px-2.5 py-1.5 text-xs font-medium text-suite-ink transition-colors hover:bg-suite-subtle disabled:opacity-50"
            >
              <Plus size={13} /> New
            </button>
          </div>
          <button
            disabled={busy || !active}
            onClick={onDuplicate}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-suite-border px-2.5 py-1.5 text-xs font-medium text-suite-ink-2 transition-colors hover:bg-suite-subtle disabled:opacity-50"
          >
            <Copy size={13} /> Duplicate active
          </button>
        </div>
      </div>
    </aside>
  )
}
