'use client'

import { useState } from 'react'
import {
  Check,
  Copy,
  FileSpreadsheet,
  Pencil,
  Plus,
  Save,
  Table2,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { cx } from '@/components/suite/ui'
import { fmtM } from '@/lib/bcm/format'
import type { ScenarioRow } from '@/lib/bcm/store'

/**
 * Foldout body for the Business Case Model: an actions toolbar (Save / New /
 * Duplicate / Import / Export), the new-scenario name input, and the scenario
 * list. Rendered inside the absolutely-positioned card the top-bar button
 * toggles. All handlers are owned by the page.
 */
export function ScenarioFoldout({
  scenarios,
  activeId,
  total2030,
  busy,
  sheetUrl,
  setSheetUrl,
  exportNote,
  onSelect,
  onRename,
  onSave,
  onNew,
  onDuplicate,
  onDelete,
  onImport,
  onExport,
  onImportExcel,
}: {
  scenarios: ScenarioRow[]
  activeId: string | null
  total2030: number
  busy: boolean
  sheetUrl: string
  setSheetUrl: (v: string) => void
  exportNote: string | null
  onSelect: (s: ScenarioRow) => void
  onRename: (id: string, name: string) => void
  onSave: (name: string) => void
  onNew: (name: string) => void
  onDuplicate: () => void
  onDelete: (id: string) => void
  onImport: () => void
  onExport: () => void
  onImportExcel: () => void
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
    <div className="flex flex-col">
      {/* a) Actions toolbar */}
      <div className="border-b border-suite-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-suite-ink">Scenarios</h3>
          <span className="text-xs font-semibold tabular-nums text-suite-accent" title="Active scenario · 2030 total">
            {fmtM(total2030)}
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <button
            disabled={busy}
            onClick={() => {
              onSave(name.trim() || active?.name || 'Scenario')
              setName('')
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-suite-accent px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-suite-accent-dark disabled:opacity-50"
          >
            <Save size={13} /> Save
          </button>
          <button
            disabled={busy}
            onClick={() => {
              onNew(name.trim() || 'New scenario')
              setName('')
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-suite-border px-2.5 py-1.5 text-xs font-medium text-suite-ink transition-colors hover:bg-suite-subtle disabled:opacity-50"
            title="Create a new scenario from the current values"
          >
            <Plus size={13} /> New
          </button>
          <button
            disabled={busy || !active}
            onClick={onDuplicate}
            className="inline-flex items-center gap-1.5 rounded-md border border-suite-border px-2.5 py-1.5 text-xs font-medium text-suite-ink-2 transition-colors hover:bg-suite-subtle disabled:opacity-50"
            title="Duplicate the active scenario"
          >
            <Copy size={13} /> Duplicate
          </button>
          <button
            disabled={busy || !sheetUrl.trim()}
            onClick={onImport}
            className="inline-flex items-center gap-1.5 rounded-md border border-suite-accent bg-suite-accent-tint px-2.5 py-1.5 text-xs font-medium text-suite-accent-dark transition-colors hover:brightness-95 disabled:opacity-50"
            title="Import a forecast from the pasted Google Sheets link"
          >
            <Table2 size={13} /> Import
          </button>
          <button
            disabled={busy}
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-md border border-suite-accent bg-suite-accent-tint px-2.5 py-1.5 text-xs font-medium text-suite-accent-dark transition-colors hover:brightness-95 disabled:opacity-50"
            title="Export this model to a new Google Sheet"
          >
            <FileSpreadsheet size={13} /> Export
          </button>
        </div>

        {/* Sheets import URL + export feedback + Excel fallback */}
        <div className="mt-2.5 space-y-2">
          <input
            type="url"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onImport()
            }}
            placeholder="Paste a Google Sheets link to import…"
            className="w-full rounded-md border border-suite-border bg-suite-bg px-2.5 py-1.5 text-xs text-suite-ink placeholder:text-suite-ink-3 focus:border-suite-accent focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {exportNote ? (
              <span className="text-xs font-medium text-suite-pos">{exportNote}</span>
            ) : (
              <span />
            )}
            <button
              onClick={onImportExcel}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-suite-ink-3 underline-offset-2 transition-colors hover:text-suite-ink hover:underline disabled:opacity-50"
            >
              <Upload size={12} /> Import Excel instead
            </button>
          </div>
        </div>
      </div>

      {/* b) New scenario name */}
      <div className="border-b border-suite-border px-4 py-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New scenario name"
          className="w-full rounded-md border border-suite-border px-2.5 py-1.5 text-xs text-suite-ink outline-none placeholder:text-suite-ink-3 focus:border-suite-accent"
        />
        <p className="mt-1.5 text-[11px] text-suite-ink-3">Used by Save and New.</p>
      </div>

      {/* c) Scenario list */}
      <div className="max-h-[44vh] overflow-auto p-2">
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
    </div>
  )
}
