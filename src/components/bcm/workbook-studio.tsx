'use client'

// Scenario workspace for the Business Case Model, backed by a live Google Sheet.
// Flow: import a sheet (READ only · a draft preview, nothing copied yet) -> tweak
// revenue inputs with LIVE local recompute (revenue, mix, funnel AND EBIT) -> "Save
// as new" mints a private Sheet copy and persists a named scenario -> reload/compare
// named scenarios instantly from their snapshots. Saved scenarios each own a Sheet
// copy; the source is never touched. On export Google recalculates the full P&L from
// our input cells; the live EBIT here is the app-side preview of that recompute.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Plus,
  Save,
  Trash2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Undo2,
  RotateCcw,
} from 'lucide-react'
import { Panel, Kpi, KpiStrip, Segmented, Slider, tbl, cx, pos } from '@/components/suite/ui'
import { fmtEur, fmtM, fmtNum, fmtPct, fmtSignedM } from '@/lib/bcm/format'
import {
  ADAPTA_MARKET,
  tierAvgValue,
  KERN_ICP_ORGS,
  KERN_ICP_MAX_ARR,
  SOM_TARGET_ACCOUNTS,
} from '@/lib/bcm/market'
import {
  PROSPECTS,
  CURRENT_CLIENTS,
  TIER_ARR,
  TIER_LABEL,
  isActiveProspect,
  marketCoverage,
} from '@/lib/bcm/prospects'
import { C, CAT, SEMANTIC, LinesChart, StackedAreaChart, StackedBarsChart, tipFmt, type SeriesDef, type Datum } from './charts'
import { SectionGrid, yearRows } from './helpers'
import {
  computeWorkbookRevenue,
  computeWorkbookMix,
  computeWorkbookByMotion,
  computeWorkbookCategoryRevenue,
  computeWorkbookFunnel,
  computeWorkbookCosts,
  computeWorkbookCogsByCategory,
  computeWorkbookStreamValue,
  deriveCostContext,
  personnelByEntity,
  fteByEntity,
  DEFAULT_FUNNEL,
  type StreamKey,
  type LogoStream,
  type CrossSellLine,
  type FunnelParams,
  type WorkbookFunnel,
  type WorkbookRevenue,
  type WorkbookInputs,
  type CostContext,
  type MargesMap,
  type EntityCosts,
  type RosterRole,
} from '@/lib/bcm/workbook'
import {
  parseDashboardBlock,
  parseMargins,
  parsePersonnelTotals,
  parsePersonnelRoster,
  parseIndirecte,
  parseScenarioPaths,
} from '@/lib/bcm/workbook-blocks'
import {
  listWorkbookScenarios,
  createWorkbookScenario,
  updateWorkbookScenario,
  deleteWorkbookScenario,
  type WorkbookScenarioRow,
} from '@/lib/bcm/workbook-store'

// --- API payload shapes (mirrors /api/bcm/workbook/{import,export}) ---

interface WorkbookBlocks {
  dashboard: string[][]
  personnelTotals: string[][]
  personnelRoster: string[][]
  indirecte: string[][]
  scenarioPaths: string[][]
  margins: string[][]
}

// Import now READS without copying: a fresh URL yields sourceId (copyId empty);
// re-reading a copy yields copyId. Either way it's a working draft until saved.
interface ImportOk {
  sourceId: string | null
  copyId: string | null
  copyUrl: string
  title: string
  mappingId: string
  inputs: WorkbookInputs
  blocks: WorkbookBlocks
}

interface ImportErr {
  error: 'no_google_token' | 'bad_url' | 'unrecognized_workbook'
  sheetTitles?: string[]
}

// The working context: where the model currently lives. `copyId` is null for an
// unsaved draft (only `sourceId` set) and gets filled once a scenario is saved.
// `baseline` is the recurring book per year, derived once when a draft/scenario is
// loaded (group revenue minus new revenue at that snapshot); it stays constant so the
// revenue chart can compare total revenue (baseline + live new) to the paths.
// `marges` (category -> purchase fraction) and `costCtx` (frozen baseline + fixed
// opex per entity) are derived at the SAME moment from the snapshot blocks + the
// inputs being loaded, so live EBIT recomputes from the current inputs.
interface Working {
  sourceId: string | null
  copyId: string | null
  copyUrl: string
  title: string
  mappingId: string
  blocks: WorkbookBlocks
  baseline: number[]
  marges: MargesMap
  costCtx: CostContext
}

type Phase = 'empty' | 'loading' | 'loaded' | 'error'

// Funnel back-calc: contracts are the known endpoint (sum of new logos per year);
// every earlier stage is grossed up by the editable conversion rate into it. The
// per-stage numbers come straight from computeWorkbookFunnel so the exported Funnel
// tab matches the "Funnel" view exactly.
function buildFunnelRows(inputs: WorkbookInputs, years: number[]): (string | number)[][] {
  const { stages } = computeWorkbookFunnel(inputs)
  return [
    ['Stage', ...years],
    ...stages.map((s) => [s.stage, ...s.perYear.map((v) => Math.round(v))] as (string | number)[]),
  ]
}

// Ensure app-side funnel params exist. Scenarios saved before the funnel field was
// introduced come back without it; default them so the funnel view + export work.
function withFunnel(inputs: WorkbookInputs): WorkbookInputs {
  return inputs.funnel ? inputs : { ...inputs, funnel: { ...DEFAULT_FUNNEL } }
}

// Seed inputs.roster from the workbook roster when absent so the editable entity
// allocation persists per scenario (older scenarios were saved before the roster field).
// The bruto/soc/months stay as imported; only the pct split is user-editable.
function withRoster(inputs: WorkbookInputs, blocks: WorkbookBlocks): WorkbookInputs {
  if (inputs.roster) return inputs
  const { roles } = parsePersonnelRoster(blocks.personnelRoster)
  return roles.length > 0 ? { ...inputs, roster: roles } : inputs
}

// Normalise a (possibly partial / legacy) blocks payload to the full shape, defaulting
// any missing tabs (older scenarios were saved before `margins` existed).
function asBlocks(raw: unknown): WorkbookBlocks {
  const b = (raw ?? {}) as Partial<WorkbookBlocks>
  return {
    dashboard: b.dashboard ?? [],
    personnelTotals: b.personnelTotals ?? [],
    personnelRoster: b.personnelRoster ?? [],
    indirecte: b.indirecte ?? [],
    scenarioPaths: b.scenarioPaths ?? [],
    margins: b.margins ?? [],
  }
}

// Recurring book = group revenue minus new revenue at the loaded snapshot (constant).
function deriveBaseline(blocks: WorkbookBlocks, inputs: WorkbookInputs): number[] {
  const dash = parseDashboardBlock(blocks.dashboard)
  const groep = dash.entities.find((e) => e.name === 'Groep')
  const baseNew = computeWorkbookRevenue(inputs).totalNew
  return (groep?.omzet ?? []).map((o, i) => o - (baseNew[i] ?? 0))
}

// Build the full working context from a snapshot + the inputs being loaded. `marges`
// and `costCtx` are computed here so live EBIT flows from the same snapshot point as
// `baseline` (import success handler and scenario-load handler both use this).
function buildWorking(
  base: Omit<Working, 'baseline' | 'marges' | 'costCtx'>,
  inputs: WorkbookInputs,
): Working {
  const marges = parseMargins(base.blocks.margins)
  // baseRoster = the roster exactly as imported (the reference allocation for live deltas),
  // independent of any edits already living in inputs.roster.
  const baseRoster = parsePersonnelRoster(base.blocks.personnelRoster).roles
  const costCtx = deriveCostContext(parseDashboardBlock(base.blocks.dashboard), inputs, marges, baseRoster)
  return { ...base, baseline: deriveBaseline(base.blocks, inputs), marges, costCtx }
}

// Immutable helpers so a single edit produces a fresh `inputs` (triggers recompute).
function patchLogo(inputs: WorkbookInputs, idx: number, patch: Partial<LogoStream>): WorkbookInputs {
  return { ...inputs, logos: inputs.logos.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }
}
function patchLogoCount(inputs: WorkbookInputs, idx: number, year: number, value: number): WorkbookInputs {
  return {
    ...inputs,
    logos: inputs.logos.map((s, i) =>
      i === idx ? { ...s, counts: s.counts.map((c, y) => (y === year ? value : c)) } : s,
    ),
  }
}
// Start month per stream/year (1..12); mirrors patchLogoCount but clamps to a valid month.
function patchLogoStart(inputs: WorkbookInputs, idx: number, year: number, value: number): WorkbookInputs {
  const month = Math.min(12, Math.max(1, Math.round(value)))
  return {
    ...inputs,
    logos: inputs.logos.map((s, i) =>
      i === idx ? { ...s, startMonths: s.startMonths.map((m, y) => (y === year ? month : m)) } : s,
    ),
  }
}
function patchCrossSell(inputs: WorkbookInputs, idx: number, year: number, value: number): WorkbookInputs {
  return {
    ...inputs,
    crossSell: inputs.crossSell.map((l, i) =>
      i === idx ? { ...l, values: l.values.map((v, y) => (y === year ? value : v)) } : l,
    ),
  }
}
// Mix weights live in inputs.mix (fractions per stream); a single cell edit yields a
// fresh inputs so the live recompute + dirty state behave like the logo/cross-sell edits.
function patchMix(
  inputs: WorkbookInputs,
  rowIdx: number,
  stream: 'google' | 'ms' | 'puls',
  value: number,
): WorkbookInputs {
  return {
    ...inputs,
    mix: inputs.mix.map((m, i) => (i === rowIdx ? { ...m, [stream]: value } : m)),
  }
}
// Funnel params are app-side; initialize from DEFAULT_FUNNEL for scenarios saved
// before this field existed, then patch the single key.
function patchFunnel(inputs: WorkbookInputs, key: keyof FunnelParams, value: number): WorkbookInputs {
  const base = inputs.funnel ?? { ...DEFAULT_FUNNEL }
  return { ...inputs, funnel: { ...base, [key]: value } }
}
// Re-allocate one role's entity split (a single % field). bruto/soc/months are fixed,
// only the pct moves, so a fresh inputs triggers the live cost recompute (zero-sum across
// entities, group total unchanged). value is a fraction (0..1).
function patchRosterPct(
  inputs: WorkbookInputs,
  idx: number,
  entity: 'meevynd' | 'naerby' | 'holding',
  value: number,
): WorkbookInputs {
  if (!inputs.roster) return inputs
  const v = Math.min(1, Math.max(0, value))
  return {
    ...inputs,
    roster: inputs.roster.map((r, i) => (i === idx ? { ...r, pct: { ...r.pct, [entity]: v } } : r)),
  }
}

const STREAM_COLORS: Record<StreamKey, string> = { google: CAT[0], microsoft: CAT[1], puls: CAT[5] }
const NAME_SUGGESTIONS = ['Laag', 'Midden', 'Hoog'] as const

// Mix matrix columns. Keys map to MixRow fields (note: Microsoft is `ms`, not `microsoft`).
const MIX_STREAMS: { key: 'google' | 'ms' | 'puls'; label: string }[] = [
  { key: 'google', label: 'Google' },
  { key: 'ms', label: 'MS' },
  { key: 'puls', label: 'Puls' },
]

// Primary area navigation of the loaded workspace (this is the page's only nav).
type WorkbookView = 'scenarios' | 'revenue' | 'funnel' | 'pnl' | 'people'
const VIEW_OPTIONS: { value: WorkbookView; label: string }[] = [
  { value: 'scenarios', label: 'Scenarios' },
  { value: 'revenue', label: 'Revenue & mix' },
  { value: 'funnel', label: 'Funnel' },
  { value: 'pnl', label: 'Costs & P&L' },
  { value: 'people', label: 'People & costs' },
]
function fmtUpdated(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

// Year-over-year growth as a compact signed percent: YoY = (cur / prior) minus 1. Returns
// null when there is no prior value or the prior is zero (so the cell stays blank). The sign
// is "+" for growth and the ASCII hyphen-minus "-" for decline (no en/em dash).
function yoyPct(cur: number | undefined, prior: number | undefined): string | null {
  if (cur === undefined || prior === undefined || !prior) return null
  const g = cur / prior - 1
  const sign = g >= 0 ? '+' : '-'
  return `${sign}${(Math.abs(g) * 100).toFixed(0)}%`
}

// A stacked value cell: the figure on top, a small muted YoY growth % beneath it.
function ValueWithYoY({ text, yoy, strong }: { text: string; yoy: string | null; strong?: boolean }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className={strong ? 'font-medium' : undefined}>{text}</span>
      {yoy && <span className="text-[10px] tabular-nums text-suite-ink-3">{yoy}</span>}
    </div>
  )
}

// Compact numeric cell editor reused for the yearly logo counts + cross-sell values.
function NumCell({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      step={step}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-full rounded-md border border-suite-border bg-suite-bg px-2 py-1 text-right text-sm tabular-nums text-suite-ink focus:border-suite-accent focus:outline-none"
    />
  )
}

// Reusable "show the big table" foldout. Keeps inherently-insightful content visible
// by default and hides large tables behind a single click, using the suite tokens.
function Foldout({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-suite-border bg-suite-bg">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-sm font-medium text-suite-ink transition-colors hover:bg-suite-subtle"
      >
        <span>{label}</span>
        <ChevronDown size={15} className={cx('shrink-0 text-suite-ink-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-suite-border p-5">{children}</div>}
    </div>
  )
}

// Deep-clone an inputs snapshot so rollback baselines never alias the live object.
const cloneInputs = (i: WorkbookInputs): WorkbookInputs => JSON.parse(JSON.stringify(i)) as WorkbookInputs

export function WorkbookStudio({ userId, orgId }: { userId: string | null; orgId: string | null }) {
  const [phase, setPhase] = useState<Phase>('empty')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sheetTitles, setSheetTitles] = useState<string[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [exportNote, setExportNote] = useState<string | null>(null)

  // Persisted scenarios + which one (if any) is loaded into the working context.
  const [scenarios, setScenarios] = useState<WorkbookScenarioRow[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingAs, setSavingAs] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const [working, setWorking] = useState<Working | null>(null)
  const [inputs, setInputs] = useState<WorkbookInputs | null>(null)
  // Rollback baselines: the pristine state from import/load, and the last persisted
  // state. Only `inputs` changes as you edit (the cost baseline lives in `working`),
  // so restoring an inputs snapshot is a complete rollback.
  const [importedInputs, setImportedInputs] = useState<WorkbookInputs | null>(null)
  const [savePoint, setSavePoint] = useState<WorkbookInputs | null>(null)

  // Active area. The compact header + KPI strip stay above this; only the active area
  // renders below the area nav.
  const [view, setView] = useState<WorkbookView>('scenarios')

  // Revenue & mix layout state: collapse the compact input sidebar so the visuals go
  // full-width, and a per-stream disclosure for the rarely-touched start-month row.
  const [revSidebarCollapsed, setRevSidebarCollapsed] = useState(false)
  const [revStartOpen, setRevStartOpen] = useState<Record<string, boolean>>({})
  // Per-stream detail + product-mix collapse so the Revenue sidebar defaults to a clean
  // list of stream names; the value/growth/count inputs appear only when unfolded.
  const [revStreamOpen, setRevStreamOpen] = useState<Record<string, boolean>>({})
  const [revMixOpen, setRevMixOpen] = useState(false)

  // Portal targets in the top SuiteHeader bar (scenario identity -> center, controls -> actions).
  const [headerCenterEl, setHeaderCenterEl] = useState<HTMLElement | null>(null)
  const [headerActionsEl, setHeaderActionsEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setHeaderCenterEl(document.getElementById('suite-header-center'))
    setHeaderActionsEl(document.getElementById('suite-header-actions'))
  }, [])

  // --- live recompute + read-only block parsing ---
  const revenue = useMemo(() => (inputs ? computeWorkbookRevenue(inputs) : null), [inputs])
  const mixCats = useMemo(() => (inputs ? computeWorkbookMix(inputs) : null), [inputs])
  const byMotion = useMemo(() => (inputs ? computeWorkbookByMotion(inputs) : null), [inputs])
  const catRevenue = useMemo(() => (inputs ? computeWorkbookCategoryRevenue(inputs) : null), [inputs])
  const funnel = useMemo(() => (inputs ? computeWorkbookFunnel(inputs) : null), [inputs])
  // LIVE P&L: baseline (frozen at load) + live new revenue/COGS from the current inputs.
  // Drives the KPI-strip EBIT and the Costs & P&L area, replacing the static snapshot.
  const costs = useMemo(
    () => (working && inputs ? computeWorkbookCosts(inputs, working.costCtx, working.marges) : null),
    [inputs, working],
  )
  const personnelTotals = useMemo(
    () => (working ? parsePersonnelTotals(working.blocks.personnelTotals) : null),
    [working],
  )
  const roster = useMemo(
    () => (working ? parsePersonnelRoster(working.blocks.personnelRoster) : null),
    [working],
  )
  // Overhead (indirecte kosten) per entity per year, read-only, from the workbook.
  const indirecte = useMemo(
    () => (working ? parseIndirecte(working.blocks.indirecte) : null),
    [working],
  )
  // FTE per entity per year from the LIVE (re-allocated) roster in inputs.
  const fteEnt = useMemo(
    () => (inputs?.roster ? fteByEntity(inputs.roster) : null),
    [inputs],
  )
  // LIVE personnel cost per entity per year (baseline + roster re-allocation deltas).
  const personnelEnt = useMemo(
    () => (inputs && working ? personnelByEntity(inputs, working.costCtx) : null),
    [inputs, working],
  )
  const scenario = useMemo(
    () => (working ? parseScenarioPaths(working.blocks.scenarioPaths) : null),
    [working],
  )

  // Has the live model diverged from the last save / from the import? Drives the
  // Roll back / Reset buttons and the "Modified" badge.
  const dirtySinceSave = useMemo(
    () => !!(inputs && savePoint) && JSON.stringify(inputs) !== JSON.stringify(savePoint),
    [inputs, savePoint],
  )
  const changedSinceImport = useMemo(
    () => !!(inputs && importedInputs) && JSON.stringify(inputs) !== JSON.stringify(importedInputs),
    [inputs, importedInputs],
  )

  // Load the saved scenario list once an account is known. Re-runs when the workspace
  // (orgId) changes so the owner sees that workspace's scenarios.
  const refreshScenarios = useCallback(async (): Promise<WorkbookScenarioRow[]> => {
    if (!userId) return []
    const rows = await listWorkbookScenarios(orgId, userId)
    setScenarios(rows)
    return rows
  }, [userId, orgId])

  // Reset to a clean draft + reload the list whenever the account or workspace changes.
  // The parent passes a new orgId when the owner switches workspace; the working context
  // (and any active scenario) from the previous workspace must not leak across.
  useEffect(() => {
    if (!userId) return
    setWorking(null)
    setInputs(null)
    setActiveId(null)
    setName('')
    setExportNote(null)
    setError(null)
    setPhase('empty')
    void refreshScenarios()
  }, [userId, orgId, refreshScenarios])

  function startNewImport() {
    setPhase('empty')
    setWorking(null)
    setInputs(null)
    setActiveId(null)
    setName('')
    setError(null)
    setSheetTitles(null)
    setExportNote(null)
    setUrl('')
    setView('scenarios')
  }

  // IMPORT a fresh URL -> an unsaved DRAFT (sourceId set, copyId null, activeId null).
  async function handleImport() {
    const trimmed = url.trim()
    if (!trimmed || importing) return
    setImporting(true)
    setPhase('loading')
    setError(null)
    setSheetTitles(null)
    setExportNote(null)
    try {
      const res = await fetch('/api/bcm/workbook/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const json = (await res.json()) as (ImportOk & ImportErr) | ImportOk | ImportErr
      if (!res.ok || 'error' in json) {
        const err = json as ImportErr
        if (err.error === 'no_google_token') {
          setError('Sign in with Google again to grant Drive access, then retry.')
        } else if (err.error === 'bad_url') {
          setError('That does not look like a Google Sheets link. Paste the full sheet URL.')
        } else if (err.error === 'unrecognized_workbook') {
          setError('This workbook does not match the expected Adapta layout.')
          setSheetTitles(err.sheetTitles ?? [])
        } else {
          setError(`Import failed: ${(err as { error?: string }).error ?? 'unknown error'}`)
        }
        setPhase('error')
        return
      }
      const ok = json as ImportOk
      const blocks = asBlocks(ok.blocks)
      const nextInputs = withRoster(withFunnel(ok.inputs), blocks)
      setWorking(
        buildWorking(
          {
            sourceId: ok.sourceId,
            copyId: ok.copyId,
            copyUrl: ok.copyUrl,
            title: ok.title,
            mappingId: ok.mappingId,
            blocks,
          },
          nextInputs,
        ),
      )
      setInputs(nextInputs)
      setImportedInputs(cloneInputs(nextInputs))
      setSavePoint(cloneInputs(nextInputs))
      setActiveId(null)
      setName('')
      setEditingName(false)
      setView('scenarios')
      setPhase('loaded')
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`)
      setPhase('error')
    } finally {
      setImporting(false)
    }
  }

  // LOAD a saved scenario: instant, no Google call. Rehydrate working + inputs from the
  // snapshot, recomputing baseline + marges + costCtx from its blocks at this same point.
  function handleLoad(row: WorkbookScenarioRow) {
    const blocks = asBlocks(row.blocks)
    const nextInputs = withRoster(withFunnel(row.inputs), blocks)
    setWorking(
      buildWorking(
        {
          sourceId: row.source_id,
          copyId: row.copy_id,
          copyUrl: row.copy_url ?? '',
          title: row.name,
          mappingId: row.mapping_id,
          blocks,
        },
        nextInputs,
      ),
    )
    setInputs(nextInputs)
    setImportedInputs(cloneInputs(nextInputs))
    setSavePoint(cloneInputs(nextInputs))
    setActiveId(row.id)
    setName(row.name)
    setEditingName(false)
    setSwitcherOpen(false)
    setError(null)
    setExportNote(null)
    setView('scenarios')
    setPhase('loaded')
  }

  // RENAME the active scenario inline (Enter / blur). No-op for an unsaved draft.
  async function commitRename() {
    setEditingName(false)
    const trimmed = name.trim()
    if (!activeId || !trimmed) return
    const current = scenarios.find((s) => s.id === activeId)
    if (current && current.name === trimmed) return
    try {
      await updateWorkbookScenario(activeId, { name: trimmed })
      await refreshScenarios()
      setWorking((w) => (w ? { ...w, title: trimmed } : w))
    } catch (err) {
      setError(`Rename failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  // SAVE AS NEW: mint a fresh copy from the source, then persist a named scenario.
  async function handleSaveAsNew() {
    if (!working || !inputs || !revenue || savingAs || !userId) return
    const trimmedName = name.trim() || working.title.trim() || 'Scenario'
    // Prefer copying from the source so every scenario gets its OWN copy; fall back to
    // the existing copyId only when no source is known.
    const sourceId = working.sourceId
    if (!sourceId && !working.copyId) {
      setError('Nothing to copy from. Re-import the sheet first.')
      return
    }
    setSavingAs(true)
    setError(null)
    setExportNote(null)
    try {
      const res = await fetch('/api/bcm/workbook/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: sourceId ?? undefined,
          copyId: sourceId ? undefined : working.copyId ?? undefined,
          name: trimmedName,
          mappingId: working.mappingId,
          inputs,
          funnelRows: buildFunnelRows(inputs, revenue.years),
        }),
      })
      const json = (await res.json()) as { copyId?: string; url?: string; error?: string }
      if (!res.ok || !json.copyId || !json.url) {
        setError(`Save failed: ${json.error ?? 'unknown error'}`)
        return
      }
      const created = await createWorkbookScenario(userId, orgId, {
        name: trimmedName,
        source_id: working.sourceId,
        copy_id: json.copyId,
        copy_url: json.url,
        mapping_id: working.mappingId,
        inputs,
        blocks: working.blocks,
      })
      await refreshScenarios()
      setWorking((w) => (w ? { ...w, copyId: json.copyId!, copyUrl: json.url!, title: trimmedName } : w))
      if (created) {
        setActiveId(created.id)
        setName(created.name)
      }
      setSavePoint(cloneInputs(inputs))
      setExportNote(json.url)
    } catch (err) {
      setError(`Save failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setSavingAs(false)
    }
  }

  // SAVE: update the active scenario's copy in place and persist its snapshot.
  async function handleSave() {
    if (!working || !inputs || !revenue || saving || !userId || !activeId || !working.copyId) return
    setSaving(true)
    setError(null)
    setExportNote(null)
    try {
      const res = await fetch('/api/bcm/workbook/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copyId: working.copyId,
          mappingId: working.mappingId,
          inputs,
          funnelRows: buildFunnelRows(inputs, revenue.years),
        }),
      })
      const json = (await res.json()) as { copyId?: string; url?: string; error?: string }
      if (!res.ok || !json.url) {
        setError(`Save failed: ${json.error ?? 'unknown error'}`)
        return
      }
      await updateWorkbookScenario(activeId, { inputs, blocks: working.blocks })
      await refreshScenarios()
      setSavePoint(cloneInputs(inputs))
      setExportNote(json.url)
    } catch (err) {
      setError(`Save failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  // DELETE a saved scenario; if it was the active one, drop back to a clean draft.
  async function handleDelete(id: string) {
    try {
      await deleteWorkbookScenario(id)
      const rows = await refreshScenarios()
      if (id === activeId) {
        setActiveId(null)
        setName('')
        if (rows.length === 0 && !working) setPhase('empty')
      }
    } catch (err) {
      setError(`Delete failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  // ROLL BACK to the last saved state (= the import baseline until the first save).
  function rollbackToSave() {
    if (!savePoint || !dirtySinceSave) return
    if (!window.confirm('Discard changes since your last save?')) return
    setInputs(cloneInputs(savePoint))
  }
  // RESET every input back to the originally imported values.
  function resetToImport() {
    if (!importedInputs || !changedSinceImport) return
    if (!window.confirm('Reset all inputs to the imported original? This discards your changes.')) return
    setInputs(cloneInputs(importedInputs))
  }

  // --- EMPTY / LOADING / ERROR: the import panel + (if any) the saved scenarios ---
  if (phase !== 'loaded' || !working || !inputs || !revenue) {
    return (
      <div className="space-y-6">
        <Panel
          title="Import a sheet or open a scenario"
          subtitle="Paste a shared Google Sheet to start a fresh draft, or open one of your saved scenarios below. Nothing is copied until you save."
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleImport()
              }}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              disabled={importing}
              className="min-w-0 flex-1 rounded-lg border border-suite-border bg-suite-bg px-3 py-2 text-sm text-suite-ink placeholder:text-suite-ink-3 focus:border-suite-accent focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handleImport}
              disabled={importing || !url.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-suite-slate px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-suite-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing && <RefreshCw size={14} className="animate-spin" />}
              {importing ? 'Reading…' : 'Import sheet'}
            </button>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{error}</p>
                {sheetTitles && sheetTitles.length > 0 && (
                  <p className="mt-1">
                    Tabs found in your sheet: {sheetTitles.join(', ')}. The Adapta “Prognose 2027-2030” layout is
                    expected.
                  </p>
                )}
              </div>
            </div>
          )}
        </Panel>

        {/* Saved scenarios are openable even before any import */}
        {(scenarios.length > 0 || !userId) && (
          <Panel title="Saved scenarios" subtitle="Open one to load it instantly · no Google call.">
            {!userId ? (
              <p className="text-xs text-suite-ink-3">Loading account…</p>
            ) : scenarios.length === 0 ? (
              <p className="text-xs text-suite-ink-3">No scenarios yet. Import a sheet, then save it as one.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {scenarios.map((s) => (
                  <div
                    key={s.id}
                    className="group inline-flex items-center gap-2 rounded-lg border border-suite-border bg-suite-bg px-2.5 py-1.5 text-xs text-suite-ink-2 transition-colors hover:bg-suite-subtle"
                  >
                    <button
                      onClick={() => handleLoad(s)}
                      className="inline-flex items-center gap-1.5 font-medium text-suite-ink"
                    >
                      <span className="max-w-[12rem] truncate">{s.name}</span>
                      {s.updated_at && (
                        <span className="text-[10px] font-normal text-suite-ink-3">{fmtUpdated(s.updated_at)}</span>
                      )}
                    </button>
                    {s.copy_url && (
                      <a
                        href={s.copy_url}
                        target="_blank"
                        rel="noreferrer"
                        title="Open sheet"
                        className="text-suite-ink-3 transition-colors hover:text-suite-accent"
                      >
                        <ExternalLink size={12} className="shrink-0" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(s.id)}
                      title="Delete scenario"
                      className="text-suite-ink-3 transition-colors hover:text-suite-neg"
                    >
                      <Trash2 size={12} className="shrink-0" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}
      </div>
    )
  }

  // --- LOADED: derive the live values for the KPI strip + areas ---
  const fte = roster?.fteByYear ?? [0, 0, 0, 0]
  const last = revenue.years.length - 1

  // Live total group revenue = recurring book (constant) + live new business.
  const liveTotal = revenue.years.map((_, i) => (working.baseline[i] ?? 0) + revenue.totalNew[i])
  const groupRev2030 = liveTotal[last]

  // Live EBIT + margin come from the recomputed cost model (not the static snapshot).
  const groepCosts = costs?.groep ?? null
  const ebit2030 = groepCosts?.ebit[last] ?? 0
  const ebitMargin2030 = groepCosts?.ebitMarginPct[last] ?? 0

  // Two distinct concepts on the full 2026-2030 axis:
  //  • Werkende model = the live model the user edits (liveTotal, years 2027-2030). It has
  //    NO 2026 value, so the model line starts at 2027 (recharts leaves a gap for null).
  //  • Doelpad plan = the fixed Laag/Midden/Hoog targets, length-5 for 2026-2030, straight
  //    from parseScenarioPaths.
  const PLAN_YEARS = [2026, 2027, 2028, 2029, 2030]
  // Model value per plan year: undefined for 2026, then liveTotal[0..3] for 2027-2030.
  const modelByPlanYear: (number | undefined)[] = PLAN_YEARS.map((y) =>
    y === 2026 ? undefined : liveTotal[y - 2027],
  )
  // Chart rows over the full 2026-2030 axis. The model uses key `total` (so the chart gives
  // it the bold 2.5px stroke); the key is OMITTED for 2026 so recharts leaves that point
  // empty and the model line starts at 2027. The three plan paths use the full length-5 arrays.
  const planChartRows: Datum[] = PLAN_YEARS.map((y, i) => {
    const m = modelByPlanYear[i]
    const row: Datum = { year: String(y) }
    if (m !== undefined) row.total = m
    if (scenario) {
      row.laag = scenario.laag[i] ?? 0
      row.midden = scenario.midden[i] ?? 0
      row.hoog = scenario.hoog[i] ?? 0
    }
    return row
  })

  // Model = solid + bold accent (key 'total' triggers the chart's 2.5px bold stroke); the
  // three Doelpaden are dashed + faint greys so the live model reads as the foreground line.
  const planSeries: SeriesDef[] = [
    { key: 'total', name: 'Werkende model (live)', color: C.accent },
    ...(scenario
      ? ([
          { key: 'laag', name: 'Plan laag', color: '#cbd5e1', dashed: true, faint: true },
          { key: 'midden', name: 'Plan midden', color: '#9aa6b2', dashed: true, faint: true },
          { key: 'hoog', name: 'Plan hoog', color: '#6b7787', dashed: true, faint: true },
        ] as SeriesDef[])
      : []),
  ]

  const revPerFte = revenue.years.map((_, i) => (fte[i] > 0 ? (liveTotal[i] ?? 0) / fte[i] : 0))

  // Scenario identity for the top-bar center slot (imported file name + editable scenario name + badge).
  const headerIdentity = (
    <div className="flex min-w-0 items-center gap-2 border-l border-suite-border pl-3">
      <span className="hidden max-w-[13rem] shrink-0 truncate text-xs text-suite-ink-3 xl:inline" title={working.title}>
        {working.title}
      </span>
      {activeId ? (
        editingName ? (
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setName(working.title)
                setEditingName(false)
              }
            }}
            className="min-w-0 max-w-[15rem] rounded-md border border-suite-accent bg-suite-bg px-2 py-0.5 text-sm font-semibold text-suite-ink focus:outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setName(working.title)
              setEditingName(true)
            }}
            title="Rename scenario"
            className="group inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-suite-ink"
          >
            <span className="max-w-[15rem] truncate">{working.title}</span>
            <Pencil size={12} className="shrink-0 text-suite-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )
      ) : (
        <>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this draft"
            className="min-w-0 max-w-[13rem] rounded-md border border-suite-border bg-suite-bg px-2 py-0.5 text-sm font-semibold text-suite-ink placeholder:font-normal placeholder:text-suite-ink-3 focus:border-suite-accent focus:outline-none"
          />
          <span className="hidden shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 sm:inline">
            Unsaved draft
          </span>
        </>
      )}
      {working.copyUrl && (
        <a
          href={working.copyUrl}
          target="_blank"
          rel="noreferrer"
          title="Open this scenario's Sheet copy"
          className="shrink-0 text-suite-accent hover:text-suite-ink"
        >
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  )

  // Scenario controls for the top-bar actions slot (icons always; text labels widen in on larger screens).
  const headerControls = (
    <div className="flex items-center gap-1.5">
      {activeId && dirtySinceSave && (
        <span className="hidden shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 lg:inline-flex">
          Modified
        </span>
      )}
      {activeId && (
        <button
          onClick={handleSave}
          disabled={saving || !working.copyId || !userId}
          title="Save"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-suite-border bg-suite-bg px-2.5 py-1.5 text-xs font-medium text-suite-ink transition-colors hover:bg-suite-subtle disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
          <span className="hidden lg:inline">{saving ? 'Saving…' : 'Save'}</span>
        </button>
      )}
      <button
        onClick={handleSaveAsNew}
        disabled={savingAs || !userId}
        title="Save as new"
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-suite-slate px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-suite-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {savingAs ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
        <span className="hidden lg:inline">{savingAs ? 'Saving…' : 'Save as new'}</span>
      </button>
      <button
        onClick={rollbackToSave}
        disabled={!dirtySinceSave}
        title="Roll back to your last save"
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-suite-border bg-suite-bg px-2.5 py-1.5 text-xs font-medium text-suite-ink transition-colors hover:bg-suite-subtle disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Undo2 size={13} />
        <span className="hidden xl:inline">Roll back</span>
      </button>
      <button
        onClick={resetToImport}
        disabled={!changedSinceImport}
        title="Reset to imported original"
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-suite-border bg-suite-bg px-2.5 py-1.5 text-xs font-medium text-suite-ink transition-colors hover:bg-suite-subtle disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw size={13} />
        <span className="hidden xl:inline">Reset to import</span>
      </button>
      <ScenarioSwitcher
        scenarios={scenarios}
        activeId={activeId}
        open={switcherOpen}
        setOpen={setSwitcherOpen}
        onLoad={handleLoad}
        onDelete={handleDelete}
        onNewImport={startNewImport}
      />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Scenario identity + controls are portalled up into the top SuiteHeader bar. */}
      {headerCenterEl && createPortal(headerIdentity, headerCenterEl)}
      {headerActionsEl && createPortal(headerControls, headerActionsEl)}

      {exportNote && (
        <a
          href={exportNote}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-suite-accent hover:underline"
        >
          Sheet updated · open it
          <ExternalLink size={12} className="shrink-0" />
        </a>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Live KPI strip · recomputes as inputs change (EBIT is live, not snapshot) */}
      <KpiStrip>
        <Kpi label="Group revenue 2030" value={fmtM(groupRev2030)} sub="recurring book + live new" accent />
        <Kpi label="New revenue 2030" value={fmtM(revenue.totalNew[last])} sub="live from your inputs" />
        <Kpi label="EBIT 2030" value={fmtM(ebit2030)} sub="Groep · live" />
        <Kpi label="EBIT margin" value={fmtPct(ebitMargin2030)} sub="EBIT / revenue" />
        <Kpi label="Total FTE 2030" value={fmtNum(fte[last], 1)} sub="roster proxy" />
      </KpiStrip>

      {/* ── Primary area navigation (the page has no top tabs) ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<WorkbookView> options={VIEW_OPTIONS} value={view} onChange={setView} />
      </div>

      {/* ── Scenarios: the live model vs the fixed Doelpad plan, then saved variants ── */}
      {view === 'scenarios' && (
        <section className="space-y-6">
          <section className="grid gap-6 lg:grid-cols-2">
            <Panel title="Werkende model vs Doelpad">
              <LinesChart data={planChartRows} xKey="year" series={planSeries} valueFmt="eur-m" />
            </Panel>

            {scenario ? (
              <Panel title="Model vs plan · by year">
                <div className="overflow-x-auto">
                  <table className={tbl.table}>
                    <thead>
                      <tr>
                        <th className={tbl.th}>Year</th>
                        <th className={tbl.thR}>Model</th>
                        <th className={tbl.thR}>Laag</th>
                        <th className={tbl.thR}>Midden</th>
                        <th className={tbl.thR}>Hoog</th>
                        <th className={tbl.thR}>Δ vs Midden</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PLAN_YEARS.map((y, i) => {
                        const model = modelByPlanYear[i]
                        const laag = scenario.laag[i] ?? 0
                        const midden = scenario.midden[i] ?? 0
                        const hoog = scenario.hoog[i] ?? 0
                        const delta = model === undefined ? null : model - midden
                        // YoY vs the prior plan year. Model has no 2026, so its first YoY is
                        // 2028 vs 2027; plans have 2026, so their YoY starts at 2027.
                        const prevModel = i > 0 ? modelByPlanYear[i - 1] : undefined
                        return (
                          <tr key={y} className={tbl.tr}>
                            <td className={tbl.td}>{y}</td>
                            <td className={tbl.tdR}>
                              {model === undefined ? (
                                '·'
                              ) : (
                                <ValueWithYoY text={fmtM(model)} yoy={yoyPct(model, prevModel)} strong />
                              )}
                            </td>
                            <td className={tbl.tdR}>
                              <ValueWithYoY text={fmtM(laag)} yoy={yoyPct(laag, i > 0 ? scenario.laag[i - 1] : undefined)} />
                            </td>
                            <td className={tbl.tdR}>
                              <ValueWithYoY text={fmtM(midden)} yoy={yoyPct(midden, i > 0 ? scenario.midden[i - 1] : undefined)} />
                            </td>
                            <td className={tbl.tdR}>
                              <ValueWithYoY text={fmtM(hoog)} yoy={yoyPct(hoog, i > 0 ? scenario.hoog[i - 1] : undefined)} />
                            </td>
                            <td className={cx(tbl.tdR, 'font-medium', delta != null && pos(delta))}>
                              {delta === null ? '·' : fmtSignedM(delta)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ) : (
              <Panel title="Model vs plan · by year">
                <p className="text-xs text-suite-ink-3">
                  No Laag / Midden / Hoog plan paths were found in this workbook’s dashboard.
                </p>
              </Panel>
            )}
          </section>

          <Panel title="Saved scenarios">
            <SavedScenarioComparison scenarios={scenarios} activeId={activeId} onLoad={handleLoad} />
          </Panel>
        </section>
      )}

      {/* Revenue & mix: two-pane workspace · compact INPUT sidebar (left) feeds the */}
      {/* ── large VISUALS pane (right); collapse the sidebar for a full-width graph view. ── */}
      {view === 'revenue' && mixCats && byMotion && catRevenue && costs && (
        <section className="space-y-6">
        {/* Revenue key metrics · CEO-relevant, from the live revenue / motion / cost model */}
        <RevenueKpiStrip revenue={revenue} byMotion={byMotion} logos={inputs.logos} costs={costs} />
        <div className="flex items-start gap-5">
          {/* LEFT: compact, dense control panel · collapses to a thin re-open strip */}
          {revSidebarCollapsed ? (
            <button
              onClick={() => setRevSidebarCollapsed(false)}
              title="Show inputs"
              className="flex shrink-0 items-center gap-1 self-stretch rounded-xl border border-suite-border bg-suite-bg px-1.5 py-3 text-[10px] font-medium uppercase tracking-wide text-suite-ink-3 transition-colors hover:bg-suite-subtle hover:text-suite-ink"
            >
              <ChevronRight size={14} className="shrink-0" />
              <span className="[writing-mode:vertical-rl]">Inputs</span>
            </button>
          ) : (
            <aside className="sticky top-20 max-h-[calc(100vh-6rem)] w-80 shrink-0 self-start overflow-y-auto overflow-x-hidden rounded-xl border border-suite-border bg-suite-bg">
              <div className="flex items-center justify-between gap-2 border-b border-suite-border px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-suite-ink-2">Inputs</span>
                <button
                  onClick={() => setRevSidebarCollapsed(true)}
                  title="Hide inputs · full-width charts"
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-suite-ink-3 transition-colors hover:bg-suite-subtle hover:text-suite-ink"
                >
                  Hide
                  <ChevronLeft size={13} className="shrink-0" />
                </button>
              </div>

              <div className="divide-y divide-suite-border">
                {/* Per-stream block: value fields + growth slider + counts + start months */}
                {inputs.logos.map((s, idx) => {
                  const landed = (s.counts ?? []).reduce((acc, c) => acc + (c || 0), 0)
                  const startOpen = revStartOpen[s.key] ?? false
                  const streamOpen = revStreamOpen[s.key] ?? false
                  return (
                    <div key={s.key} className="px-3 py-2.5">
                      <button
                        onClick={() => setRevStreamOpen((o) => ({ ...o, [s.key]: !streamOpen }))}
                        className="flex w-full items-center gap-1.5 text-left"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: STREAM_COLORS[s.key] }}
                        />
                        <span className="truncate text-xs font-semibold text-suite-ink">{s.label}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-suite-ink-3">{fmtNum(landed)} logos</span>
                        <ChevronDown
                          size={12}
                          className={cx('shrink-0 text-suite-ink-3 transition-transform', streamOpen && 'rotate-180')}
                        />
                      </button>

                      {streamOpen && (
                        <div className="mt-2">

                      {/* Entry / Max / Cap · three tight value fields (not sliders) */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <label className="block">
                          <span className="mb-0.5 block text-[9px] uppercase tracking-wide text-suite-ink-3">Entry</span>
                          <NumCell
                            value={s.instap}
                            step={10000}
                            onChange={(v) => setInputs((p) => (p ? patchLogo(p, idx, { instap: v }) : p))}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-0.5 block text-[9px] uppercase tracking-wide text-suite-ink-3">Max</span>
                          <NumCell
                            value={s.maxValue ?? 0}
                            step={50000}
                            onChange={(v) => setInputs((p) => (p ? patchLogo(p, idx, { maxValue: v }) : p))}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-0.5 block text-[9px] uppercase tracking-wide text-suite-ink-3">Cap %</span>
                          <NumCell
                            value={s.capPct ?? 100}
                            step={5}
                            onChange={(v) => setInputs((p) => (p ? patchLogo(p, idx, { capPct: v }) : p))}
                          />
                        </label>
                      </div>

                      {/* Growth · single compact slider */}
                      <Slider
                        label="Growth / yr"
                        value={Math.round(s.growth * 100)}
                        min={0}
                        max={40}
                        step={1}
                        onChange={(v) => setInputs((p) => (p ? patchLogo(p, idx, { growth: v / 100 }) : p))}
                        format={(n) => `${n}%`}
                      />

                      {/* Counts / yr · tight row of four */}
                      <p className="mb-1 mt-0.5 text-[9px] uppercase tracking-wide text-suite-ink-3">Counts / yr</p>
                      <div className="grid grid-cols-4 gap-1">
                        {revenue.years.map((y, yi) => (
                          <label key={y} className="block">
                            <span className="mb-0.5 block text-center text-[9px] text-suite-ink-3">{y}</span>
                            <NumCell
                              value={s.counts[yi] ?? 0}
                              onChange={(v) => setInputs((p) => (p ? patchLogoCount(p, idx, yi, v) : p))}
                            />
                          </label>
                        ))}
                      </div>

                      {/* Start months · hidden by default behind a minimal disclosure */}
                      <button
                        onClick={() => setRevStartOpen((o) => ({ ...o, [s.key]: !startOpen }))}
                        className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-suite-ink-3 transition-colors hover:text-suite-ink"
                      >
                        <ChevronDown
                          size={11}
                          className={cx('shrink-0 transition-transform', startOpen && 'rotate-180')}
                        />
                        start months
                      </button>
                      {startOpen && (
                        <div className="mt-1 grid grid-cols-4 gap-1">
                          {revenue.years.map((y, yi) => (
                            <label key={y} className="block">
                              <span className="mb-0.5 block text-center text-[9px] text-suite-ink-3">{y}</span>
                              <NumCell
                                value={s.startMonths[yi] ?? 1}
                                onChange={(v) => setInputs((p) => (p ? patchLogoStart(p, idx, yi, v) : p))}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Product mix · collapsed by default to keep the sidebar clean */}
                <div className="px-3 py-2.5">
                  <button
                    onClick={() => setRevMixOpen((o) => !o)}
                    className="flex w-full items-center gap-1.5"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-suite-ink-2">Product mix</span>
                    <ChevronDown
                      size={12}
                      className={cx('ml-auto shrink-0 text-suite-ink-3 transition-transform', revMixOpen && 'rotate-180')}
                    />
                  </button>
                  {revMixOpen && (
                  <div className="mt-2 space-y-2.5">
                    {MIX_STREAMS.map((stream) => {
                      const sumPct = Math.round(
                        inputs.mix.reduce((acc, row) => acc + (row[stream.key] ?? 0), 0) * 100,
                      )
                      return (
                        <div key={stream.key}>
                          <div className="flex items-baseline justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-suite-ink-3">
                              {stream.label}
                            </span>
                            <span
                              className={cx(
                                'text-[10px] tabular-nums',
                                sumPct === 100 ? 'text-suite-ink-3' : 'text-suite-neg',
                              )}
                            >
                              {sumPct}%
                            </span>
                          </div>
                          {inputs.mix.map((row, mi) => (
                            <Slider
                              key={`${stream.key}-${mixCats[mi]?.label ?? row.label ?? mi}`}
                              label={row.label}
                              value={Math.round((row[stream.key] ?? 0) * 100)}
                              min={0}
                              max={100}
                              step={5}
                              onChange={(v) => setInputs((p) => (p ? patchMix(p, mi, stream.key, v / 100) : p))}
                              format={(n) => `${n}%`}
                            />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                  )}
                </div>
              </div>
            </aside>
          )}

          {/* RIGHT: the visuals · the focus, large and full-width when collapsed */}
          <div className="min-w-0 flex-1 space-y-5">
            {/* 1 · Where the growth comes from: new logos vs cross-sell */}
            <Panel title="Where the growth comes from">
              <StackedBarsChart
                data={yearRows(byMotion.years, {
                  newLogos: byMotion.newLogos,
                  crossSell: byMotion.crossSell,
                })}
                xKey="year"
                bars={[
                  { key: 'newLogos', name: 'New logos', color: SEMANTIC.newBiz },
                  { key: 'crossSell', name: 'Cross-sell & expansion', color: SEMANTIC.expand },
                ]}
                valueFmt="eur-m"
                height={300}
              />
              {(() => {
                const total2030 = byMotion.total[last] ?? 0
                const newPct = total2030 > 0 ? (byMotion.newLogos[last] ?? 0) / total2030 : 0
                const crossPct = total2030 > 0 ? (byMotion.crossSell[last] ?? 0) / total2030 : 0
                return (
                  <p className="mt-4 border-t border-suite-border pt-3 text-sm text-suite-ink-2">
                    New revenue {byMotion.years[last]} ={' '}
                    <span className="font-semibold text-suite-ink">{fmtM(total2030)}</span> · {fmtPct(newPct, 0)} new
                    logos / {fmtPct(crossPct, 0)} cross-sell.
                  </p>
                )
              })()}
            </Panel>

            {/* 1b · How new accounts scale in value · per-stream cohort ramp (behind a foldout) */}
            <Foldout label="How new accounts scale in value">
              <StreamValueRamp inputs={inputs} years={revenue.years} />
            </Foldout>

            {/* 2 · What we're selling: category revenue over time + 2030 mix doughnut */}
            <Panel title="What we're selling">
              <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <StackedAreaChart
                  data={yearRows(
                    byMotion.years,
                    Object.fromEntries(catRevenue.map((c, i) => [`c${i}`, c.perYear])),
                  )}
                  xKey="year"
                  series={catRevenue.map((c, i) => ({ key: `c${i}`, name: c.label, color: CAT[i % CAT.length] }))}
                  valueFmt="eur-m"
                  height={300}
                />
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-suite-ink-3">{byMotion.years[last]} mix</p>
                  <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={mixCats.map((c) => ({ name: c.label, value: c.share }))}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius="58%"
                          outerRadius="88%"
                          paddingAngle={1}
                          stroke="#ffffff"
                          strokeWidth={1}
                          isAnimationActive={false}
                        >
                          {mixCats.map((_, i) => (
                            <Cell key={i} fill={CAT[i % CAT.length]} />
                          ))}
                        </Pie>
                        <Tooltip {...mixTooltipStyle} formatter={tipFmt((n) => fmtPct(n))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend with full names + shares (the donut's outside labels were clipping) */}
                  <ul className="mt-2 space-y-1">
                    {mixCats.map((c, i) => (
                      <li key={c.label} className="flex items-center gap-1.5 text-[11px] text-suite-ink-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CAT[i % CAT.length] }} />
                        <span className="truncate">{c.label}</span>
                        <span className="ml-auto shrink-0 tabular-nums text-suite-ink">{fmtPct(c.share)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Panel>

            {/* 3 · Expansion & cross-sell (Blok 2): tall contribution chart; values fold away */}
            {inputs.crossSell.length > 0 && (
              <Panel title="Expansion & cross-sell (Blok 2)">
                <div className="h-96">
                  <StackedBarsChart
                    data={revenue.years.map((y, yi) => {
                      const row: Datum = { year: String(y) }
                      inputs.crossSell.forEach((line, li) => {
                        row[`x${li}`] = line.values[yi] ?? 0
                      })
                      return row
                    })}
                    xKey="year"
                    bars={inputs.crossSell.map((line, li) => ({
                      key: `x${li}`,
                      name: line.label || `Line ${li + 1}`,
                      color: CAT[li % CAT.length],
                    }))}
                    valueFmt="eur-m"
                    height={384}
                  />
                </div>
                <div className="mt-4">
                  <Foldout label="Show values">
                    <div className="overflow-x-auto">
                      <table className={tbl.table}>
                        <thead>
                          <tr>
                            <th className={tbl.th}>Line</th>
                            {revenue.years.map((y) => (
                              <th key={y} className={tbl.thR}>
                                {y}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {inputs.crossSell.map((line: CrossSellLine, idx) => (
                            <tr key={`${line.label}-${idx}`} className={tbl.tr}>
                              <td className={tbl.td}>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: CAT[idx % CAT.length] }}
                                  />
                                  <div>
                                    <div className="font-medium text-suite-ink">{line.label || '·'}</div>
                                    <div className="text-[11px] text-suite-ink-3">
                                      {line.category} · {line.entity === 'naerby' ? 'Naerby' : 'Meevynd'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              {revenue.years.map((y, yi) => (
                                <td key={y} className="px-3 py-2">
                                  <NumCell
                                    value={line.values[yi] ?? 0}
                                    step={5000}
                                    onChange={(v) => setInputs((p) => (p ? patchCrossSell(p, idx, yi, v) : p))}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Foldout>
                </div>
              </Panel>
            )}
          </div>
        </div>
        </section>
      )}

      {/* ── Funnel: market sizing + kern-ICP penetration (tied to the model), then the ── */}
      {/* ── existing conversion funnel (sliders + required-activity table + coverage). ── */}
      {view === 'funnel' && funnel && (
        <section className="space-y-6">
          {/* Funnel key metrics · CEO-relevant, tied to the model's contracts + the funnel math */}
          <FunnelKpiStrip funnel={funnel} revenue={revenue} logos={inputs.logos} />

          {/* Market sizing + the key new insight: kern-ICP penetration from the model. */}
          <div className="grid gap-6 lg:grid-cols-2">
            <MarketSizingPanel />
            <KernIcpPenetrationPanel funnel={funnel} years={revenue.years} />
          </div>

          {/* Identified pipeline vs undiscovered white space (from the marktanalyse). */}
          <PipelineWhiteSpacePanel />

          {/* New accounts signed per year, one stacked series per logo stream. */}
          <NewAccountsPerYearPanel logos={inputs.logos} years={revenue.years} funnel={funnel} />

          {/* The existing conversion funnel · sliders feed the back-calculated activity table. */}
          <SectionGrid
            sliders={
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-wide text-suite-ink-3">Conversion rates</p>
                  <button
                    onClick={() => setInputs((p) => (p ? { ...p, funnel: { ...DEFAULT_FUNNEL } } : p))}
                    title="Reset conversion rates + lead capacity to the defaults (25/35/50/75/85 · 250)"
                    className="inline-flex items-center gap-1 rounded-md border border-suite-border bg-suite-bg px-1.5 py-1 text-[10px] font-medium text-suite-ink-3 transition-colors hover:bg-suite-subtle hover:text-suite-ink"
                  >
                    <RefreshCw size={11} className="shrink-0" />
                    Reset to default
                  </button>
                </div>
                <Slider
                  label="Lead → suspect"
                  value={inputs.funnel?.cSL ?? DEFAULT_FUNNEL.cSL}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => setInputs((p) => (p ? patchFunnel(p, 'cSL', v) : p))}
                  format={(n) => `${n}%`}
                />
                <Slider
                  label="Suspect → meeting"
                  value={inputs.funnel?.cLD ?? DEFAULT_FUNNEL.cLD}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => setInputs((p) => (p ? patchFunnel(p, 'cLD', v) : p))}
                  format={(n) => `${n}%`}
                />
                <Slider
                  label="Meeting → demo"
                  value={inputs.funnel?.cDD ?? DEFAULT_FUNNEL.cDD}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => setInputs((p) => (p ? patchFunnel(p, 'cDD', v) : p))}
                  format={(n) => `${n}%`}
                />
                <Slider
                  label="Demo → proposal"
                  value={inputs.funnel?.cDV ?? DEFAULT_FUNNEL.cDV}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => setInputs((p) => (p ? patchFunnel(p, 'cDV', v) : p))}
                  format={(n) => `${n}%`}
                />
                <Slider
                  label="Proposal → contract"
                  value={inputs.funnel?.cVC ?? DEFAULT_FUNNEL.cVC}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => setInputs((p) => (p ? patchFunnel(p, 'cVC', v) : p))}
                  format={(n) => `${n}%`}
                />
                <Slider
                  label="Leads we can generate / yr"
                  value={inputs.funnel?.leadCapacity ?? DEFAULT_FUNNEL.leadCapacity}
                  min={0}
                  max={500}
                  step={10}
                  onChange={(v) => setInputs((p) => (p ? patchFunnel(p, 'leadCapacity', v) : p))}
                  format={(n) => fmtNum(n)}
                />
              </div>
            }
          >
            <Panel title="Required activity">
              <div className="overflow-x-auto">
                <table className={tbl.table}>
                  <thead>
                    <tr>
                      <th className={tbl.th}>Stage</th>
                      {revenue.years.map((y) => (
                        <th key={y} className={tbl.thR}>
                          {y}
                        </th>
                      ))}
                      <th className={tbl.thR}>avg / mo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnel.stages.map((s) => (
                      <tr key={s.stage} className={s.stage === 'Leads' ? tbl.trHighlight : tbl.tr}>
                        <td className={cx(tbl.td, s.stage === 'Leads' && 'font-semibold')}>{s.stage}</td>
                        {revenue.years.map((y, yi) => (
                          <td key={y} className={cx(tbl.tdR, s.stage === 'Leads' && 'font-semibold')}>
                            {fmtNum(Math.round(s.perYear[yi] ?? 0))}
                          </td>
                        ))}
                        <td className={cx(tbl.tdR, s.stage === 'Leads' && 'font-semibold')}>
                          {fmtNum(Math.round(s.perMonth))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 space-y-1 border-t border-suite-border pt-3">
                <p className="text-xs text-suite-ink-2">
                  Total leads needed 2027-2030 = {fmtNum(Math.round(funnel.totalLeads))}
                </p>
                <p className={cx('text-sm font-semibold', pos(funnel.coverage - 1))}>
                  Lead-gen capacity covers {fmtPct(funnel.coverage)} of leads needed
                  {Math.max(...funnel.leadGapPerYear) > 0 &&
                    ` · short by ~${fmtNum(Math.round(Math.max(...funnel.leadGapPerYear)))} in the peak year.`}
                </p>
              </div>
            </Panel>
          </SectionGrid>
        </section>
      )}

      {/* ── Costs & P&L: group composition + KPIs, entity small-multiples, full P&L folds away ── */}
      {view === 'pnl' &&
        (costs ? (
          <CostsArea costs={costs} years={revenue.years} inputs={inputs} marges={working.marges} />
        ) : (
          <Panel title="Costs & P&L">
            <p className="text-xs text-suite-ink-3">
              No computed P&L found in this workbook. Import a sheet with the Adapta dashboard tab to see it here.
            </p>
          </Panel>
        ))}

      {/* ── People & costs: where the heads + overhead sit by entity, and re-allocate roles ── */}
      {view === 'people' && (
        <PeopleArea
          years={revenue.years}
          totalFte={fte}
          fteEnt={fteEnt}
          personnelEnt={personnelEnt}
          indirecte={indirecte}
          personnelTotals={personnelTotals}
          revPerFte={revPerFte}
          roster={inputs.roster ?? null}
          onPatchPct={(idx, entity, value) => setInputs((p) => (p ? patchRosterPct(p, idx, entity, value) : p))}
        />
      )}
    </div>
  )
}

// --- Revenue & mix helpers: a 5-metric KPI strip + the per-stream value-ramp foldout. ---

// Revenue key-metric strip · five CEO-relevant numbers from the live revenue / motion / cost
// model. New-logo vs cross-sell split is shown as "new% / cross%"; avg ARR per new account uses
// that year's NEW-logo revenue over the accounts signed that year.
function RevenueKpiStrip({
  revenue,
  byMotion,
  logos,
  costs,
}: {
  revenue: WorkbookRevenue
  byMotion: { newLogos: number[]; crossSell: number[]; total: number[] }
  logos: LogoStream[]
  costs: { groep: EntityCosts }
}) {
  const last = revenue.years.length - 1
  const newRev2030 = revenue.totalNew[last] ?? 0
  const total2030 = byMotion.total[last] ?? 0
  const newPct = total2030 > 0 ? (byMotion.newLogos[last] ?? 0) / total2030 : 0
  const crossPct = total2030 > 0 ? (byMotion.crossSell[last] ?? 0) / total2030 : 0
  const accounts2030 = logos.reduce((s, st) => s + (st.counts[last] ?? 0), 0)
  const newLogoRev2030 =
    (revenue.logoOmzet.google[last] ?? 0) + (revenue.logoOmzet.microsoft[last] ?? 0) + (revenue.logoOmzet.puls[last] ?? 0)
  const avgArr = accounts2030 > 0 ? newLogoRev2030 / accounts2030 : 0
  const grossMargin2030 = costs.groep.grossMarginPct[last] ?? 0
  return (
    <KpiStrip>
      <Kpi label={`New revenue ${revenue.years[last]}`} value={fmtM(newRev2030)} sub="live from your inputs" accent />
      <Kpi label={`New-logo vs cross-sell ${revenue.years[last]}`} value={`${fmtPct(newPct, 0)} / ${fmtPct(crossPct, 0)}`} sub="new logos / expansion" />
      <Kpi label={`New accounts added ${revenue.years[last]}`} value={fmtNum(Math.round(accounts2030))} sub="new logos that year" />
      <Kpi label={`Avg ARR per new account ${revenue.years[last]}`} value={fmtEur(avgArr)} sub="new-logo rev / accounts" />
      <Kpi label="Blended gross margin" value={fmtPct(grossMargin2030)} sub={`Groep ${revenue.years[last]}`} />
    </KpiStrip>
  )
}

// Per-stream cohort value ramp: NEW-logo revenue per stream (lines) plus each stream's average
// value per active account (running-cumulative accounts), from computeWorkbookStreamValue. Lets
// the user sanity-check where value lands with each stream's per-year growth ramp.
function StreamValueRamp({ inputs, years }: { inputs: WorkbookInputs; years: number[] }) {
  const streamValues = computeWorkbookStreamValue(inputs)
  const revData = yearRows(
    years,
    Object.fromEntries(streamValues.map((s) => [`rev_${s.key}`, s.revenue])),
  )
  const avgData = yearRows(
    years,
    Object.fromEntries(streamValues.map((s) => [`avg_${s.key}`, s.avgPerAccount])),
  )
  const revSeries: SeriesDef[] = streamValues.map((s) => ({
    key: `rev_${s.key}`,
    name: s.label,
    color: STREAM_COLORS[s.key] ?? CAT[0],
  }))
  const avgSeries: SeriesDef[] = streamValues.map((s) => ({
    key: `avg_${s.key}`,
    name: s.label,
    color: STREAM_COLORS[s.key] ?? CAT[0],
  }))
  return (
    <div className="space-y-5">
      <p className="text-xs text-suite-ink-3">
        Each new cohort ramps at its stream&apos;s growth rate (e.g. 15% / yr), capped at the per-logo max. Left: new-logo
        revenue per stream. Right: average value per active account (that year&apos;s revenue over accounts signed to date).
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-suite-ink-3">New-logo revenue by stream</p>
          <LinesChart data={revData} xKey="year" series={revSeries} valueFmt="eur-m" height={260} />
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-suite-ink-3">Avg value per active account</p>
          <LinesChart data={avgData} xKey="year" series={avgSeries} valueFmt="eur-m" height={260} />
        </div>
      </div>
    </div>
  )
}

// --- Funnel area: market sizing (TAM/SAM/SOM) + kern-ICP penetration. Static reference
// market data (from @/lib/bcm/market) framed against the LIVE model: cumulative new
// accounts won = the running sum of the Contracts stage of computeWorkbookFunnel. ---

// Compact TAM/SAM/SOM table from ADAPTA_MARKET. The note rides along as a row tooltip +
// a small caption so the table stays scannable.
function MarketSizingPanel() {
  return (
    <Panel
      title="Market sizing · TAM / SAM / SOM"
      subtitle="Kern-ICP = 220 accounts at ≈€1M ARR each; SOM = 11 new clients (5% over 3 yr)."
    >
      <div className="overflow-x-auto">
        <table className={tbl.table}>
          <thead>
            <tr>
              <th className={tbl.th}>Tier</th>
              <th className={tbl.thR}>ICP orgs</th>
              <th className={tbl.thR}>Avg ARR/org</th>
              <th className={tbl.thR}>Market €/yr</th>
              <th className={tbl.thR}>3-yr</th>
            </tr>
          </thead>
          <tbody>
            {ADAPTA_MARKET.map((t) => (
              <tr key={t.key} className={t.key === 'sam' ? tbl.trHighlight : tbl.tr} title={t.note}>
                <td className={cx(tbl.td, t.key === 'sam' && 'font-semibold')}>{t.label}</td>
                <td className={tbl.tdR}>{fmtNum(t.orgs)}</td>
                <td className={tbl.tdR}>{fmtEur(tierAvgValue(t))}</td>
                <td className={tbl.tdR}>{fmtM(t.perYear)}</td>
                <td className={tbl.tdR}>{fmtEur(t.threeYear)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

// THE key new insight, tied to the model (not the other graphs): cumulative new accounts
// won across 2027-2030 = the running sum of the Contracts stage of computeWorkbookFunnel,
// framed against the kern-ICP (220) and the SOM target (11 new clients).
function KernIcpPenetrationPanel({ funnel, years }: { funnel: WorkbookFunnel; years: number[] }) {
  const last = years.length - 1
  // New logos per year = the Contracts stage (that year's new accounts).
  const contracts = funnel.stages.find((s) => s.stage === 'Contracts')?.perYear ?? years.map(() => 0)
  // Running cumulative new accounts won across the years.
  const cumulative = contracts.reduce<number[]>((acc, v) => {
    acc.push((acc[acc.length - 1] ?? 0) + (v || 0))
    return acc
  }, [])
  const cumTotal = Math.round(cumulative[last] ?? 0)
  const pctOfKern = KERN_ICP_ORGS > 0 ? cumTotal / KERN_ICP_ORGS : 0
  const vsSomMultiple = SOM_TARGET_ACCOUNTS > 0 ? cumTotal / SOM_TARGET_ACCOUNTS : 0
  const chartData = years.map((y, i) => ({ year: String(y), cumulative: Math.round(cumulative[i] ?? 0) }))

  return (
    <Panel
      title="Kern-ICP penetration"
      subtitle="Cumulative new accounts won (running total of the funnel's Contracts) against the 220-account kern and the SOM target of 11."
    >
      <KpiStrip>
        <Kpi label={`New accounts by ${years[last]}`} value={fmtNum(cumTotal)} sub="cumulative" accent />
        <Kpi label="% of kern-ICP" value={fmtPct(pctOfKern)} sub={`of ${fmtNum(KERN_ICP_ORGS)} accounts`} />
        <Kpi
          label="vs SOM target"
          value={`${fmtNum(cumTotal)} vs ${fmtNum(SOM_TARGET_ACCOUNTS)}`}
          sub={`${fmtNum(vsSomMultiple, 1)}x the 5% / 3-yr target`}
        />
      </KpiStrip>

      <div className="mt-4" style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="year" tick={{ fill: C.ink3, fontSize: 11 }} tickLine={false} axisLine={{ stroke: C.grid }} />
            <YAxis tick={{ fill: C.ink3, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
            <Tooltip {...costTooltipStyle} formatter={tipFmt((v) => fmtNum(Math.round(v)))} cursor={{ fill: 'transparent' }} />
            <ReferenceLine
              y={SOM_TARGET_ACCOUNTS}
              stroke={C.warm}
              strokeDasharray="5 4"
              label={{ value: `SOM target ${SOM_TARGET_ACCOUNTS}`, position: 'insideTopRight', fill: C.warm, fontSize: 10 }}
            />
            <Bar dataKey="cumulative" name="Cumulative new accounts" fill={SEMANTIC.pos} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 border-t border-suite-border pt-3 text-[11px] text-suite-ink-3">
        The kern-ICP is {fmtNum(KERN_ICP_ORGS)} accounts; max ARR per kern-ICP account ≈ {fmtEur(KERN_ICP_MAX_ARR)}.
      </p>
    </Panel>
  )
}

// Funnel key-metric strip · five CEO-relevant numbers straight from the model's contracts
// (new logos per year) and the funnel math. Avg new-account value uses only NEW-logo revenue
// (all three streams) over that year's accounts, so it reads as "what a fresh logo is worth".
function FunnelKpiStrip({
  funnel,
  revenue,
  logos,
}: {
  funnel: WorkbookFunnel
  revenue: WorkbookRevenue
  logos: LogoStream[]
}) {
  const last = revenue.years.length - 1
  const contracts = funnel.stages.find((s) => s.stage === 'Contracts')?.perYear ?? revenue.years.map(() => 0)
  const leads = funnel.stages.find((s) => s.stage === 'Leads')?.perYear ?? revenue.years.map(() => 0)
  const totalAccounts = logos.reduce((s, st) => s + (st.counts ?? []).reduce((a, c) => a + (c || 0), 0), 0)
  const accounts2030 = contracts[last] ?? 0
  // NEW-logo revenue 2030 = all three streams' logo omzet that year (excludes cross-sell).
  const newLogoRev2030 =
    (revenue.logoOmzet.google[last] ?? 0) + (revenue.logoOmzet.microsoft[last] ?? 0) + (revenue.logoOmzet.puls[last] ?? 0)
  const avgNewAccount = accounts2030 > 0 ? newLogoRev2030 / accounts2030 : 0
  return (
    <KpiStrip>
      <Kpi label="New accounts 2027-2030" value={fmtNum(Math.round(totalAccounts))} sub="total new logos" accent />
      <Kpi label={`Contracts to sign ${revenue.years[last]}`} value={fmtNum(Math.round(accounts2030))} sub="new logos that year" />
      <Kpi label={`Leads / yr ${revenue.years[last]}`} value={fmtNum(Math.round(leads[last] ?? 0))} sub="top of funnel" />
      <Kpi label="Lead-gen coverage" value={fmtPct(funnel.coverage)} sub="capacity vs leads needed" />
      <Kpi label={`Avg new-account value ${revenue.years[last]}`} value={fmtEur(avgNewAccount)} sub="new-logo rev / accounts" />
    </KpiStrip>
  )
}

// New accounts signed per year, one stacked bar series per logo stream. Each stream's bar =
// that year's counts[y] (new accounts). Because contracts in computeWorkbookFunnel are the sum
// of every stream's counts, the stack total per year equals the funnel's "Contracten" row.
function NewAccountsPerYearPanel({
  logos,
  years,
  funnel,
}: {
  logos: LogoStream[]
  years: number[]
  funnel: WorkbookFunnel
}) {
  const last = years.length - 1
  const contracts = funnel.stages.find((s) => s.stage === 'Contracts')?.perYear ?? years.map(() => 0)
  const totalAccounts = logos.reduce((s, st) => s + (st.counts ?? []).reduce((a, c) => a + (c || 0), 0), 0)
  const data: Datum[] = years.map((y, yi) => {
    const row: Datum = { year: String(y) }
    logos.forEach((s) => {
      row[s.key] = s.counts[yi] ?? 0
    })
    return row
  })
  const bars = logos.map((s) => ({
    key: s.key,
    name: s.label,
    color: STREAM_COLORS[s.key] ?? CAT[0],
  }))
  return (
    <Panel
      title="New accounts per year"
      subtitle="New logos signed each year, split by stream. The stack total equals the funnel's Contracten row."
    >
      <StackedBarsChart data={data} xKey="year" bars={bars} valueFmt="num" height={300} />
      <p className="mt-4 border-t border-suite-border pt-3 text-sm text-suite-ink-2">
        Total new accounts {years[0]}-{years[last]} ={' '}
        <span className="font-semibold text-suite-ink">{fmtNum(Math.round(totalAccounts))}</span> · lines up with the{' '}
        {fmtNum(Math.round(contracts.reduce((a, c) => a + (c || 0), 0)))} contracts the funnel must produce.
      </p>
    </Panel>
  )
}

// Identified pipeline vs undiscovered white space, from the marktanalyse (prospects.ts).
// A small coverage summary + a tiny stacked bar of identified vs undiscovered of the 220 kern
// orgs, then two tables (new-business prospects, current-client cross-sell) behind foldouts.
function PipelineWhiteSpacePanel() {
  const cov = marketCoverage()
  // Prospects: active (High) first, then by modeled ARR desc.
  const prospectsSorted = [...PROSPECTS].sort((a, b) => {
    const aa = isActiveProspect(a) ? 1 : 0
    const bb = isActiveProspect(b) ? 1 : 0
    if (aa !== bb) return bb - aa
    return TIER_ARR[b.tier] - TIER_ARR[a.tier]
  })
  // Current clients: most open cross-sell slots first.
  const clientsSorted = [...CURRENT_CLIENTS].sort((a, b) => b.crossSellOpen - a.crossSellOpen)
  const coverageBar: Datum[] = [
    { label: 'Kern-ICP (220)', identified: cov.identified, undiscovered: cov.undiscovered },
  ]
  return (
    <Panel
      title="Identified pipeline & white space"
      subtitle="Market intel from the marktanalyse · ICP represented via value tier + sales priority; staff = total employees."
    >
      <Foldout label="Show identified pipeline & white space">
        <div className="space-y-5">
          {/* Coverage stats + a tiny identified-vs-undiscovered bar of the 220 kern orgs */}
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              <MiniStat label="Current clients" value={fmtNum(cov.clients)} />
              <MiniStat label="Active prospects" value={fmtNum(cov.prospectsActive)} sub={`of ${fmtNum(cov.prospectsTotal)} identified`} />
              <MiniStat label="Identified total" value={fmtNum(cov.identified)} sub={`of ${fmtNum(cov.kernOrgs)} kern orgs`} />
              <MiniStat label="Undiscovered white space" value={fmtNum(cov.undiscovered)} sub={`+ ${fmtM(cov.identifiedArr)} active pipeline ARR`} />
            </div>
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wide text-suite-ink-3">Coverage of the 220 kern orgs</p>
              <div style={{ width: '100%', height: 120 }}>
                <ResponsiveContainer>
                  <ComposedChart data={coverageBar} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
                    <XAxis type="number" tick={{ fill: C.ink3, fontSize: 11 }} tickLine={false} axisLine={{ stroke: C.grid }} />
                    <YAxis type="category" dataKey="label" tick={{ fill: C.ink3, fontSize: 11 }} tickLine={false} axisLine={false} width={96} />
                    <Tooltip {...costTooltipStyle} formatter={tipFmt((v) => fmtNum(Math.round(v)))} cursor={{ fill: 'transparent' }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                    <Bar dataKey="identified" name="Identified" stackId="k" fill={SEMANTIC.pos} radius={[2, 0, 0, 2]} isAnimationActive={false} />
                    <Bar dataKey="undiscovered" name="Undiscovered" stackId="k" fill={C.neutral} radius={[0, 2, 2, 0]} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* New-business prospects */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-suite-ink-2">New-business prospects</p>
            <div className="overflow-x-auto">
              <table className={tbl.table}>
                <thead>
                  <tr>
                    <th className={tbl.th}>Name</th>
                    <th className={tbl.th}>Tier</th>
                    <th className={tbl.thR}>Employees</th>
                    <th className={tbl.thR}>Modeled ARR</th>
                    <th className={tbl.th}>Priority</th>
                    <th className={tbl.th}>Current partner</th>
                  </tr>
                </thead>
                <tbody>
                  {prospectsSorted.map((p, i) => (
                    <tr key={`${p.name}-${i}`} className={isActiveProspect(p) ? tbl.trHighlight : tbl.tr} title={p.note}>
                      <td className={cx(tbl.td, isActiveProspect(p) && 'font-semibold')}>{p.name}</td>
                      <td className={tbl.td}>{TIER_LABEL[p.tier]}</td>
                      <td className={tbl.tdR}>{p.employees == null ? '·' : fmtNum(p.employees)}</td>
                      <td className={tbl.tdR}>{fmtM(TIER_ARR[p.tier])}</td>
                      <td className={tbl.td}>{p.priority}</td>
                      <td className={cx(tbl.td, 'max-w-[10rem] truncate text-suite-ink-2')} title={p.partner}>{p.partner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Current-client cross-sell openings */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-suite-ink-2">Current-client cross-sell</p>
            <div className="overflow-x-auto">
              <table className={tbl.table}>
                <thead>
                  <tr>
                    <th className={tbl.th}>Name</th>
                    <th className={tbl.thR}>Employees</th>
                    <th className={tbl.th}>Tier</th>
                    <th className={tbl.thR}>Cross-sell open</th>
                    <th className={tbl.th}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {clientsSorted.map((c, i) => (
                    <tr key={`${c.name}-${i}`} className={tbl.tr}>
                      <td className={cx(tbl.td, 'font-medium')}>{c.name}</td>
                      <td className={tbl.tdR}>{c.employees == null ? '·' : fmtNum(c.employees)}</td>
                      <td className={tbl.td}>{TIER_LABEL[c.tier]}</td>
                      <td className={tbl.tdR}>{fmtNum(c.crossSellOpen)} products</td>
                      <td className={cx(tbl.td, 'max-w-[16rem] truncate text-suite-ink-2')} title={c.note}>{c.note || '·'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Foldout>
    </Panel>
  )
}

// A tiny label/value/sub stat card reused inside the pipeline white-space foldout.
function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-suite-border bg-suite-bg px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-suite-ink-3">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-suite-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-suite-ink-3">{sub}</div>}
    </div>
  )
}

// --- People & costs area: visual-first. Where the heads + overhead sit by entity, how
// they grow, and an editable roster whose entity-allocation re-allocates personnel cost
// between entities (zero-sum at group level), flowing straight into the Costs & P&L EBIT.
const PEOPLE_ENTITIES: { key: 'meevynd' | 'naerby' | 'holding'; label: string; color: string }[] = [
  { key: 'meevynd', label: 'Meevynd', color: CAT[0] },
  { key: 'naerby', label: 'Naerby', color: CAT[1] },
  { key: 'holding', label: 'Holding', color: CAT[6] },
]

function PeopleArea({
  years,
  totalFte,
  fteEnt,
  personnelEnt,
  indirecte,
  personnelTotals,
  revPerFte,
  roster,
  onPatchPct,
}: {
  years: number[]
  totalFte: number[]
  fteEnt: { meevynd: number[]; naerby: number[]; holding: number[] } | null
  personnelEnt: { meevynd: number[]; naerby: number[]; holding: number[] } | null
  indirecte: { meevynd: number[]; naerby: number[]; holding: number[] } | null
  personnelTotals: { entities: { name: string; cost: number[] }[] } | null
  revPerFte: number[]
  roster: RosterRole[] | null
  onPatchPct: (idx: number, entity: 'meevynd' | 'naerby' | 'holding', value: number) => void
}) {
  const last = years.length - 1
  const entityBars = PEOPLE_ENTITIES.map((e) => ({ key: e.key, name: e.label, color: e.color }))
  // Cost charts (personnel + overhead) are COSTS · colour their per-entity series with the
  // red ramp (Meevynd / Naerby / Holding) instead of the categorical entity colours. FTE
  // (headcount, not a cost) keeps the categorical `entityBars`.
  const costEntityBars = PEOPLE_ENTITIES.map((e, i) => ({
    key: e.key,
    name: e.label,
    color: SEMANTIC.cost[i],
  }))

  // 5th KPI · personnel cost as % of revenue in the last year. 2030 personnel = live personnel
  // by entity summed; 2030 revenue reconstructed from revenue-per-FTE x total FTE (== group rev).
  const personnel2030 = personnelEnt
    ? (personnelEnt.meevynd[last] ?? 0) + (personnelEnt.naerby[last] ?? 0) + (personnelEnt.holding[last] ?? 0)
    : null
  const groupRev2030 = (revPerFte[last] ?? 0) * (totalFte[last] ?? 0)
  const personnelPctOfRev2030 = personnel2030 != null && groupRev2030 > 0 ? personnel2030 / groupRev2030 : null

  return (
    <section className="space-y-6">
      {/* 1) WHERE THE HEADS ARE · FTE by entity over the years + total-FTE KPIs */}
      <div>
        <h2 className="text-base font-semibold text-suite-ink">Where the heads are</h2>
      </div>

      <KpiStrip>
        {years.map((y, i) => (
          <Kpi key={y} label={`Total FTE ${y}`} value={fmtNum(totalFte[i], 1)} sub="roster proxy" accent={i === last} />
        ))}
        <Kpi
          label={`Personnel % of revenue ${years[last]}`}
          value={personnelPctOfRev2030 == null ? '·' : fmtPct(personnelPctOfRev2030)}
          sub="personnel cost / revenue"
        />
      </KpiStrip>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="FTE by entity">
          {fteEnt ? (
            <StackedBarsChart
              data={yearRows(years, { meevynd: fteEnt.meevynd, naerby: fteEnt.naerby, holding: fteEnt.holding })}
              xKey="year"
              bars={entityBars}
              valueFmt="num"
              height={300}
            />
          ) : (
            <p className="text-xs text-suite-ink-3">No roster found in this workbook.</p>
          )}
        </Panel>

        <Panel title="Revenue per FTE">
          <LinesChart
            data={yearRows(years, { rpf: revPerFte })}
            xKey="year"
            series={[{ key: 'rpf', name: 'Revenue / FTE', color: C.accentDark }]}
            valueFmt="eur-m"
            height={300}
          />
        </Panel>
      </div>

      {/* 2) WHERE THE COSTS SIT · personnel by entity + overhead by entity */}
      <div className="pt-1">
        <h2 className="text-base font-semibold text-suite-ink">Where the costs sit</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Personnel cost by entity">
          {personnelEnt ? (
            <>
              <StackedBarsChart
                data={yearRows(years, {
                  meevynd: personnelEnt.meevynd,
                  naerby: personnelEnt.naerby,
                  holding: personnelEnt.holding,
                })}
                xKey="year"
                bars={costEntityBars}
                valueFmt="eur-m"
                height={300}
              />
              <p className="mt-4 border-t border-suite-border pt-3 text-sm text-suite-ink-2">
                Total personnel {years[last]} ={' '}
                <span className="font-semibold text-suite-ink">
                  {fmtM(
                    (personnelEnt.meevynd[last] ?? 0) +
                      (personnelEnt.naerby[last] ?? 0) +
                      (personnelEnt.holding[last] ?? 0),
                  )}
                </span>
                .
              </p>
            </>
          ) : (
            <p className="text-xs text-suite-ink-3">No personnel baseline found in this workbook.</p>
          )}
        </Panel>

        <Panel title="Overhead by entity">
          {indirecte &&
          (indirecte.meevynd.some((v) => v) || indirecte.naerby.some((v) => v) || indirecte.holding.some((v) => v)) ? (
            <StackedBarsChart
              data={yearRows(years, {
                meevynd: indirecte.meevynd,
                naerby: indirecte.naerby,
                holding: indirecte.holding,
              })}
              xKey="year"
              bars={costEntityBars}
              valueFmt="eur-m"
              height={300}
            />
          ) : (
            <p className="text-xs text-suite-ink-3">No indirecte-kosten block found in this workbook.</p>
          )}
        </Panel>
      </div>

      {/* Loaded personnel cost per entity straight from the Personeel tab (reference). */}
      {personnelTotals && personnelTotals.entities.length > 0 && (
        <Foldout label="Show loaded personnel cost by entity (from the Personeel tab)">
          <div className="overflow-x-auto">
            <table className={tbl.table}>
              <thead>
                <tr>
                  <th className={tbl.th}>Entity</th>
                  {years.map((y) => (
                    <th key={y} className={tbl.thR}>
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personnelTotals.entities.map((e) => (
                  <tr key={e.name} className={tbl.tr}>
                    <td className={tbl.td}>{e.name}</td>
                    {years.map((y, i) => (
                      <td key={y} className={tbl.tdR}>
                        {fmtEur(e.cost[i] ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Foldout>
      )}

      {/* 3) THE ROSTER · editable entity allocation per role */}
      {roster && roster.length > 0 && (
        <Foldout label="Show roster">
          <RosterTable years={years} roster={roster} onPatchPct={onPatchPct} />
        </Foldout>
      )}
    </section>
  )
}

// Editable roster: one row per role with its active months and three % inputs (Meevynd /
// Naerby / Holding). Editing a % re-allocates that role's cost between entities (zero-sum
// at group level) and flows into the Costs & P&L EBIT. bruto/soc/months are fixed.
function RosterTable({
  years,
  roster,
  onPatchPct,
}: {
  years: number[]
  roster: RosterRole[]
  onPatchPct: (idx: number, entity: 'meevynd' | 'naerby' | 'holding', value: number) => void
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className={tbl.table}>
          <thead>
            <tr>
              <th className={tbl.th}>Role</th>
              <th className={tbl.thR}>Months active</th>
              {PEOPLE_ENTITIES.map((e) => (
                <th key={e.key} className={tbl.thR}>
                  {e.label} %
                </th>
              ))}
              <th className={tbl.thR}>Σ</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((role, idx) => {
              const sum = role.pct.meevynd + role.pct.naerby + role.pct.holding
              const sumPct = Math.round(sum * 100)
              return (
                <tr key={`${role.name}-${idx}`} className={tbl.tr}>
                  <td className={tbl.td}>
                    <div className="font-medium text-suite-ink">{role.name}</div>
                    <div className="text-[11px] text-suite-ink-3">
                      {fmtEur(role.bruto)}/mo · soc {fmtPct(role.soc, 0)}
                    </div>
                  </td>
                  <td className={cx(tbl.tdR, 'text-[11px] text-suite-ink-3')}>{role.months.join(' / ')}</td>
                  {PEOPLE_ENTITIES.map((e) => (
                    <td key={e.key} className="w-24 px-3 py-2">
                      <NumCell
                        value={Math.round((role.pct[e.key] ?? 0) * 100)}
                        step={5}
                        onChange={(v) => onPatchPct(idx, e.key, v / 100)}
                      />
                    </td>
                  ))}
                  <td className={cx(tbl.tdR, 'text-[11px] tabular-nums', sumPct === 100 ? 'text-suite-ink-3' : 'text-suite-neg')}>
                    {sumPct}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Compact scenario switcher: a dropdown listing saved scenarios to open, each with
// an open-sheet link + delete, plus "New import" to start over. ---
function ScenarioSwitcher({
  scenarios,
  activeId,
  open,
  setOpen,
  onLoad,
  onDelete,
  onNewImport,
}: {
  scenarios: WorkbookScenarioRow[]
  activeId: string | null
  open: boolean
  setOpen: (v: boolean) => void
  onLoad: (row: WorkbookScenarioRow) => void
  onDelete: (id: string) => void
  onNewImport: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, setOpen])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-suite-border bg-suite-bg px-3 py-1.5 text-xs font-medium text-suite-ink-2 transition-colors hover:bg-suite-subtle hover:text-suite-ink"
      >
        Scenarios
        <ChevronDown size={13} className={cx('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-72 overflow-hidden rounded-xl border border-suite-border bg-suite-bg shadow-lg">
          <div className="max-h-72 overflow-y-auto py-1">
            {scenarios.length === 0 ? (
              <p className="px-3 py-2 text-xs text-suite-ink-3">No saved scenarios yet.</p>
            ) : (
              scenarios.map((s) => {
                const isActive = s.id === activeId
                return (
                  <div
                    key={s.id}
                    className={cx(
                      'group flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-suite-subtle',
                      isActive && 'bg-suite-accent-tint',
                    )}
                  >
                    <button
                      onClick={() => onLoad(s)}
                      className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-left font-medium text-suite-ink"
                    >
                      {isActive && <Check size={12} className="shrink-0 text-suite-accent" />}
                      <span className="truncate">{s.name}</span>
                      {s.updated_at && (
                        <span className="shrink-0 text-[10px] font-normal text-suite-ink-3">
                          {fmtUpdated(s.updated_at)}
                        </span>
                      )}
                    </button>
                    {s.copy_url && (
                      <a
                        href={s.copy_url}
                        target="_blank"
                        rel="noreferrer"
                        title="Open sheet"
                        className="shrink-0 text-suite-ink-3 transition-colors hover:text-suite-accent"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    <button
                      onClick={() => onDelete(s.id)}
                      title="Delete scenario"
                      className="shrink-0 text-suite-ink-3 transition-colors hover:text-suite-neg"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
          <button
            onClick={() => {
              setOpen(false)
              onNewImport()
            }}
            className="flex w-full items-center gap-1.5 border-t border-suite-border px-3 py-2 text-xs font-medium text-suite-ink-2 transition-colors hover:bg-suite-subtle hover:text-suite-ink"
          >
            <RefreshCw size={12} className="shrink-0" />
            New import
          </button>
        </div>
      )}
    </div>
  )
}

// --- Saved-scenario comparison: each saved scenario's 2030 group revenue + 2030 EBIT,
// computed from its stored inputs + snapshot blocks. Guards for missing blocks. ---
function scenario2030(row: WorkbookScenarioRow): { rev: number | null; ebit: number | null } {
  const rev = computeWorkbookRevenue(withFunnel(row.inputs))
  const last = rev.totalNew.length - 1
  const blocks = asBlocks(row.blocks)
  const dash = parseDashboardBlock(blocks.dashboard)
  const groep = dash.entities.find((e) => e.name === 'Groep')
  // 2030 group revenue = recurring book at the snapshot + this scenario's new business.
  const baseline = (groep?.omzet ?? []).map((o, i) => o - (rev.totalNew[i] ?? 0))
  const groupRev = groep ? (baseline[last] ?? 0) + (rev.totalNew[last] ?? 0) : null
  let ebit: number | null = null
  if (dash.entities.length > 0) {
    const marges = parseMargins(blocks.margins)
    const ctx = deriveCostContext(dash, withFunnel(row.inputs), marges)
    ebit = computeWorkbookCosts(withFunnel(row.inputs), ctx, marges).groep.ebit[last] ?? null
  }
  return { rev: groupRev, ebit }
}

function SavedScenarioComparison({
  scenarios,
  activeId,
  onLoad,
}: {
  scenarios: WorkbookScenarioRow[]
  activeId: string | null
  onLoad: (row: WorkbookScenarioRow) => void
}) {
  if (scenarios.length === 0) {
    return (
      <p className="text-xs text-suite-ink-3">
        No saved scenarios yet. Tune the model, then “Save as new” to compare them here.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className={tbl.table}>
        <thead>
          <tr>
            <th className={tbl.th}>Scenario</th>
            <th className={tbl.thR}>2030 group revenue</th>
            <th className={tbl.thR}>2030 EBIT</th>
            <th className={tbl.th} />
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => {
            const { rev, ebit } = scenario2030(s)
            const isActive = s.id === activeId
            return (
              <tr key={s.id} className={isActive ? tbl.trHighlight : tbl.tr}>
                <td className={tbl.td}>
                  <button
                    onClick={() => onLoad(s)}
                    className="inline-flex items-center gap-1.5 font-medium text-suite-ink hover:text-suite-accent"
                  >
                    {isActive && <Check size={12} className="shrink-0 text-suite-accent" />}
                    <span className="truncate">{s.name}</span>
                  </button>
                </td>
                <td className={cx(tbl.tdR, 'font-medium')}>{rev == null ? '·' : fmtM(rev)}</td>
                <td className={cx(tbl.tdR, ebit != null && pos(ebit))}>{ebit == null ? '·' : fmtM(ebit)}</td>
                <td className={tbl.td}>
                  {s.copy_url && (
                    <a
                      href={s.copy_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-suite-ink-3 hover:text-suite-accent"
                    >
                      open sheet
                      <ExternalLink size={11} className="shrink-0" />
                    </a>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// --- Costs & P&L area: answer-first, CEO-legible, one screen. Top-to-bottom:
//   1) GROUP composition: one stacked bar/year where bar height = revenue, split into
//      COGS / Operating costs / EBIT (profit on top); a KPI row for the group 2030.
//   2) BY ENTITY: three small multiples telling where profit comes from: Meevynd (engine),
//      Naerby (invests then turns), Holding (shared cost center). EBIT mini-bars, 2030 figures.
//   3) DETAIL: the full per-entity P&L table (Segmented selector) behind a foldout.
// All values come from the LIVE `costs`, so the whole area recomputes with the inputs. ---

const COST_COLORS = {
  cogs: SEMANTIC.cost[0], // deep red · cost of goods
  opex: SEMANTIC.cost[1], // lighter red · operating costs
  ebit: SEMANTIC.profit, // green · profit on top
} as const

// The three consolidated operating entities and the one-line story for each.
const ENTITY_STORY: {
  key: 'meevynd' | 'naerby' | 'holding'
  label: string
  caption: string
}[] = [
  { key: 'meevynd', label: 'Meevynd · Tech BV', caption: 'The profit engine · positive, growing EBIT.' },
  { key: 'naerby', label: 'Naerby · Innovatie BV', caption: 'Invests first, then turns · EBIT crosses to positive.' },
  { key: 'holding', label: 'Holding · Business Support', caption: 'Shared cost center · no revenue, negative EBIT.' },
]

// Full P&L rows. Operating costs has no own field on EntityCosts (it is brutomarge minus ebit),
// so it is derived per-entity in the table; the rest map straight to a numeric array key.
type PnlRow =
  | { kind: 'field'; key: keyof Pick<EntityCosts, 'omzet' | 'cogs' | 'brutomarge' | 'ebit'>; label: string; strong?: boolean; signed?: boolean }
  | { kind: 'opex'; label: string }
  | { kind: 'pct'; key: keyof Pick<EntityCosts, 'ebitMarginPct'>; label: string }
const PNL_ROWS: PnlRow[] = [
  { kind: 'field', key: 'omzet', label: 'Omzet' },
  { kind: 'field', key: 'cogs', label: 'COGS' },
  { kind: 'field', key: 'brutomarge', label: 'Brutomarge' },
  { kind: 'opex', label: 'Operating costs' },
  { kind: 'field', key: 'ebit', label: 'EBIT', strong: true, signed: true },
  { kind: 'pct', key: 'ebitMarginPct', label: 'EBIT %' },
]

function CostsArea({
  costs,
  years,
  inputs,
  marges,
}: {
  costs: { meevynd: EntityCosts; naerby: EntityCosts; holding: EntityCosts; groep: EntityCosts }
  years: number[]
  inputs: WorkbookInputs
  marges: MargesMap
}) {
  const last = years.length - 1
  const g = costs.groep
  // Click-a-year drill-down: which model year the COGS-by-category + EBIT bridge describe.
  const [selectedYear, setSelectedYear] = useState<number>(years[last] ?? years[0])
  const selIdx = Math.max(0, years.indexOf(selectedYear))

  const groupRev2030 = g.omzet[last] ?? 0
  const groupEbit2030 = g.ebit[last] ?? 0
  const groupEbitMargin2030 = g.ebitMarginPct[last] ?? 0
  const groupGrossMargin2030 = g.grossMarginPct[last] ?? 0

  // Composition rows: bar height = revenue, split COGS + Operating costs + EBIT(≥0 in the
  // stack); the true EBIT (which can be negative) is overlaid as a line so a loss year
  // still reads correctly. opex = brutomarge minus ebit (the operating cost below gross margin).
  const compRows = years.map((y, i) => {
    const ebit = g.ebit[i] ?? 0
    const opex = (g.brutomarge[i] ?? 0) - ebit
    return {
      year: String(y),
      cogs: g.cogs[i] ?? 0,
      opex: Math.max(0, opex),
      ebit: Math.max(0, ebit),
      ebitLine: ebit,
    }
  })

  // Revenue vs cost: revenue line (omzet) vs total cost line (COGS + operating costs,
  // i.e. cogs + (brutomarge minus ebit)), with EBIT drawn as the green gap between them
  // so widening operating leverage reads as growing profit.
  const revCostRows = years.map((y, i) => {
    const ebit = g.ebit[i] ?? 0
    const opex = (g.brutomarge[i] ?? 0) - ebit
    const totalCost = (g.cogs[i] ?? 0) + opex
    return {
      year: String(y),
      revenue: g.omzet[i] ?? 0,
      totalCost,
      ebit,
    }
  })

  return (
    <section className="space-y-6">
      {/* 1) GROUP · where the revenue goes (the key view) */}
      <div>
        <h2 className="text-base font-semibold text-suite-ink">Where the group’s revenue goes</h2>
      </div>

      <KpiStrip>
        <Kpi label={`Group revenue ${years[last]}`} value={fmtM(groupRev2030)} accent />
        <Kpi
          label={`Group EBIT ${years[last]}`}
          value={fmtM(groupEbit2030)}
          sub={groupEbit2030 < 0 ? 'loss' : 'profit'}
        />
        <Kpi label="EBIT margin" value={fmtPct(groupEbitMargin2030)} sub="EBIT / revenue" />
        <Kpi label="Gross margin" value={fmtPct(groupGrossMargin2030)} sub="brutomarge / revenue" />
        <Kpi
          label={`Cumulative EBIT ${years[0]}-${years[last]}`}
          value={fmtM(g.ebit.reduce((s, v) => s + (v || 0), 0))}
          sub="sum of group EBIT"
        />
      </KpiStrip>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Revenue vs cost">
          <RevenueVsCostChart data={revCostRows} />
          <p className="mt-4 border-t border-suite-border pt-3 text-sm text-suite-ink-2">
            The green gap between revenue and total cost is EBIT ·{' '}
            <span className="font-semibold text-suite-ink">{fmtM(groupEbit2030)}</span> in {years[last]}.
          </p>
        </Panel>

        <Panel title="Group revenue → COGS · operating costs · EBIT">
          <CompositionChart data={compRows} />
        </Panel>
      </div>

      {/* 1b) DRILL A YEAR · pick a year to see its COGS-by-category + EBIT bridge */}
      <YearDrilldown
        costs={costs}
        years={years}
        inputs={inputs}
        marges={marges}
        selectedYear={selectedYear}
        selIdx={selIdx}
        onSelectYear={setSelectedYear}
      />

      {/* 2) BY ENTITY · where the profit comes from (small multiples) */}
      <div className="pt-1">
        <h2 className="text-base font-semibold text-suite-ink">Where the profit comes from</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {ENTITY_STORY.map((s) => (
          <EntityCard key={s.key} label={s.label} caption={s.caption} entity={costs[s.key]} years={years} />
        ))}
      </div>

      {/* 3) DETAIL · full per-entity P&L behind a foldout (reference, not the lead) */}
      <Foldout label="Show full P&L">
        <PnlTable costs={costs} years={years} />
      </Foldout>
    </section>
  )
}

// Click-a-year drill-down: a compact row of year buttons drives a breakdown for THAT year.
// (a) COGS by product category · from computeWorkbookCogsByCategory (same Marges margin math),
//     coloured with the SEMANTIC.cost red ramp. (b) EBIT bridge · Revenue minus COGS minus
//     operating costs = EBIT, pulled straight from the live group P&L (opex = brutomarge - ebit).
function YearDrilldown({
  costs,
  years,
  inputs,
  marges,
  selectedYear,
  selIdx,
  onSelectYear,
}: {
  costs: { meevynd: EntityCosts; naerby: EntityCosts; holding: EntityCosts; groep: EntityCosts }
  years: number[]
  inputs: WorkbookInputs
  marges: MargesMap
  selectedYear: number
  selIdx: number
  onSelectYear: (y: number) => void
}) {
  const g = costs.groep
  // COGS by category for the selected year (drop zero-COGS categories so the chart stays clean).
  const cogsByCat = computeWorkbookCogsByCategory(inputs, marges)
    .map((c) => ({ label: c.label, cogs: c.perYear[selIdx] ?? 0 }))
    .filter((c) => c.cogs > 0)
    .sort((a, b) => b.cogs - a.cogs)

  // EBIT bridge for the selected year, straight from the live group P&L.
  const revenue = g.omzet[selIdx] ?? 0
  const cogs = g.cogs[selIdx] ?? 0
  const ebit = g.ebit[selIdx] ?? 0
  const opex = (g.brutomarge[selIdx] ?? 0) - ebit
  const bridge = [
    { label: 'Revenue', value: revenue, tone: SEMANTIC.profit, sign: '' },
    { label: 'minus COGS', value: cogs, tone: SEMANTIC.cost[0], sign: '-' },
    { label: 'minus operating costs', value: opex, tone: SEMANTIC.cost[1], sign: '-' },
    { label: 'EBIT', value: ebit, tone: ebit >= 0 ? SEMANTIC.profit : SEMANTIC.neg, sign: '=' },
  ]
  const bridgeMax = Math.max(revenue, 1)

  return (
    <Panel
      title="Drill a year · COGS by category + EBIT bridge"
      subtitle="Pick a year to see where its cost and profit come from."
      right={
        <div className="inline-flex rounded-lg border border-suite-border bg-suite-subtle p-0.5">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => onSelectYear(y)}
              className={cx(
                'rounded-md px-3 py-1 text-xs font-medium tabular-nums transition-colors',
                y === selectedYear ? 'bg-suite-bg text-suite-ink shadow-sm' : 'text-suite-ink-3 hover:text-suite-ink',
              )}
            >
              {y}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* (a) COGS by product category · reds */}
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wide text-suite-ink-3">COGS by category · {selectedYear}</p>
          {cogsByCat.length > 0 ? (
            <div style={{ width: '100%', height: Math.max(140, cogsByCat.length * 34) }}>
              <ResponsiveContainer>
                <ComposedChart data={cogsByCat} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
                  <CartesianGrid stroke={C.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: C.ink3, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: C.grid }}
                    tickFormatter={(v: number) => fmtM(v, v >= 1e7 || v <= -1e7 ? 0 : 1)}
                  />
                  <YAxis type="category" dataKey="label" tick={{ fill: C.ink3, fontSize: 11 }} tickLine={false} axisLine={false} width={130} />
                  <Tooltip {...costTooltipStyle} formatter={tipFmt((v) => fmtEur(v))} cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="cogs" name="COGS" radius={[0, 2, 2, 0]} isAnimationActive={false}>
                    {cogsByCat.map((_, i) => (
                      <Cell key={i} fill={SEMANTIC.cost[i % SEMANTIC.cost.length]} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-suite-ink-3">No purchase-margin COGS in {selectedYear} (services carry 0% COGS).</p>
          )}
          <p className="mt-2 text-[11px] text-suite-ink-3">
            Total new-revenue COGS {selectedYear} = {fmtEur(cogsByCat.reduce((s, c) => s + c.cogs, 0))}.
          </p>
        </div>

        {/* (b) EBIT bridge · revenue -> minus COGS -> minus opex -> EBIT */}
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wide text-suite-ink-3">EBIT bridge · {selectedYear}</p>
          <div className="space-y-2">
            {bridge.map((b) => (
              <div key={b.label}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-suite-ink-2">{b.label}</span>
                  <span className="font-semibold tabular-nums text-suite-ink">
                    {b.sign === '-' ? '-' : ''}
                    {fmtEur(Math.abs(b.value))}
                  </span>
                </div>
                <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-suite-subtle">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, (Math.abs(b.value) / bridgeMax) * 100)}%`, backgroundColor: b.tone }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-suite-border pt-2 text-[11px] text-suite-ink-3">
            Revenue {fmtEur(revenue)} minus COGS {fmtEur(cogs)} minus operating costs {fmtEur(opex)} = EBIT{' '}
            <span className={cx('font-semibold', pos(ebit))}>{fmtEur(ebit)}</span>.
          </p>
        </div>
      </div>
    </Panel>
  )
}

// A compact small-multiple for one entity: name + one-line story, an EBIT-by-year mini bar
// (negative years coloured with pos()), and the 2030 revenue / EBIT / EBIT-margin figures.
function EntityCard({
  label,
  caption,
  entity,
  years,
}: {
  label: string
  caption: string
  entity: EntityCosts
  years: number[]
}) {
  const last = years.length - 1
  const rev2030 = entity.omzet[last] ?? 0
  const ebit2030 = entity.ebit[last] ?? 0
  const ebitMargin2030 = entity.ebitMarginPct[last] ?? 0
  // First year EBIT goes from negative to non-negative, the "turn" Naerby's story calls out.
  const turnYear = years.find((_, i) => (entity.ebit[i] ?? 0) >= 0 && i > 0 && (entity.ebit[i - 1] ?? 0) < 0)

  return (
    <div className="flex flex-col rounded-xl border border-suite-border bg-suite-bg p-4">
      <div className="text-sm font-semibold text-suite-ink">{label}</div>
      <p className="mt-0.5 text-[11px] leading-snug text-suite-ink-3">{caption}</p>

      <div className="mt-3">
        <EntityEbitMini ebit={years.map((_, i) => entity.ebit[i] ?? 0)} years={years} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-suite-border pt-3">
        <EntityFig label={`Rev ${years[last]}`} value={fmtM(rev2030)} />
        <EntityFig label={`EBIT ${years[last]}`} value={fmtM(ebit2030)} tone={pos(ebit2030)} />
        <EntityFig label="EBIT %" value={fmtPct(ebitMargin2030)} tone={pos(ebit2030)} />
      </div>

      {turnYear !== undefined && (
        <p className="mt-2 text-[11px] font-medium text-suite-accent">Turns positive in {turnYear}.</p>
      )}
    </div>
  )
}

function EntityFig({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-suite-ink-3">{label}</div>
      <div className={cx('mt-0.5 text-sm font-semibold tabular-nums', tone ?? 'text-suite-ink')}>{value}</div>
    </div>
  )
}

// EBIT-by-year mini bar chart. Positive bars green, negative bars red (semantic pos/neg),
// with a zero baseline so the sign reads at a glance.
function EntityEbitMini({ ebit, years }: { ebit: number[]; years: number[] }) {
  const data = years.map((y, i) => ({ year: String(y), ebit: ebit[i] ?? 0 }))
  return (
    <div style={{ width: '100%', height: 96 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="year" tick={{ fill: C.ink3, fontSize: 10 }} tickLine={false} axisLine={{ stroke: C.grid }} />
          <Tooltip {...costTooltipStyle} formatter={tipFmt((v) => fmtEur(v))} cursor={{ fill: 'transparent' }} />
          <Bar dataKey="ebit" name="EBIT" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.ebit >= 0 ? SEMANTIC.pos : SEMANTIC.neg} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// Full per-entity P&L table with a Segmented selector. Rows: Omzet / COGS / Brutomarge /
// Operating costs / EBIT / EBIT% × years. Reference detail behind the foldout.
function PnlTable({
  costs,
  years,
}: {
  costs: { meevynd: EntityCosts; naerby: EntityCosts; holding: EntityCosts; groep: EntityCosts }
  years: number[]
}) {
  const options = [
    { value: 'groep', label: 'Group' },
    { value: 'meevynd', label: 'Meevynd' },
    { value: 'naerby', label: 'Naerby' },
    { value: 'holding', label: 'Holding' },
  ] as const
  type EntityKey = (typeof options)[number]['value']
  const [sel, setSel] = useState<EntityKey>('groep')
  const entity = costs[sel]

  const cellValue = (row: PnlRow, i: number): { text: string; tone?: string } => {
    if (row.kind === 'opex') {
      const v = (entity.brutomarge[i] ?? 0) - (entity.ebit[i] ?? 0)
      return { text: fmtM(v) }
    }
    if (row.kind === 'pct') return { text: fmtPct(entity[row.key][i] ?? 0) }
    const v = entity[row.key][i] ?? 0
    return { text: fmtM(v), tone: row.signed ? pos(v) : undefined }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<EntityKey> options={options.map((o) => ({ value: o.value, label: o.label }))} value={sel} onChange={setSel} />
      </div>
      <div className="overflow-x-auto">
        <table className={tbl.table}>
          <thead>
            <tr>
              <th className={tbl.th}>Line</th>
              {years.map((y) => (
                <th key={y} className={tbl.thR}>
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PNL_ROWS.map((row) => {
              const strong = row.kind === 'field' && row.strong
              return (
                <tr key={row.label} className={strong ? tbl.trHighlight : tbl.tr}>
                  <td className={cx(tbl.td, strong && 'font-semibold')}>{row.label}</td>
                  {years.map((y, i) => {
                    const { text, tone } = cellValue(row, i)
                    return (
                      <td key={y} className={cx(tbl.tdR, strong && 'font-semibold', tone)}>
                        {text}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const costAxisTick = { fill: C.ink3, fontSize: 11 } as const
const costTooltipStyle = {
  contentStyle: { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 },
  labelStyle: { color: C.slate, fontWeight: 600 },
  // Show only the series under the pointer, not every stacked value at that x.
  shared: false,
} as const
// Tooltip styling for the product-mix doughnut (matches the cost charts).
const mixTooltipStyle = costTooltipStyle

// Revenue vs cost: a green revenue line over a red total-cost line, with EBIT rendered as a
// soft green area so the widening gap between the two lines reads as growing profit. Makes
// operating leverage obvious. revenue = omzet, totalCost = COGS + operating costs, ebit = gap.
function RevenueVsCostChart({
  data,
}: {
  data: { year: string; revenue: number; totalCost: number; ebit: number }[]
}) {
  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="year" tick={costAxisTick} tickLine={false} axisLine={{ stroke: C.grid }} />
          <YAxis
            tick={costAxisTick}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => fmtM(v, v >= 1e7 || v <= -1e7 ? 0 : 1)}
          />
          <Tooltip {...costTooltipStyle} formatter={tipFmt((v) => fmtEur(v))} cursor={{ fill: 'transparent' }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
          {/* EBIT as a soft green area so the revenue-over-cost gap reads as profit. */}
          <Area
            type="monotone"
            dataKey="ebit"
            name="EBIT (profit)"
            stroke="none"
            fill={SEMANTIC.profit}
            fillOpacity={0.18}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke={SEMANTIC.profit}
            strokeWidth={2.5}
            dot={{ r: 2 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="totalCost"
            name="Total cost"
            stroke={SEMANTIC.cost[0]}
            strokeWidth={2.5}
            dot={{ r: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// GROUP composition: stacked bars (COGS / operating costs / EBIT) summing to revenue, with
// the true EBIT overlaid as a line so a negative-EBIT year still reads through the stack.
function CompositionChart({
  data,
}: {
  data: { year: string; cogs: number; opex: number; ebit: number; ebitLine: number }[]
}) {
  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="year" tick={costAxisTick} tickLine={false} axisLine={{ stroke: C.grid }} />
          <YAxis
            tick={costAxisTick}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => fmtM(v, v >= 1e7 || v <= -1e7 ? 0 : 1)}
          />
          <Tooltip {...costTooltipStyle} formatter={tipFmt((v) => fmtEur(v))} cursor={{ fill: 'transparent' }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
          <Bar dataKey="cogs" name="COGS" stackId="rev" fill={COST_COLORS.cogs} isAnimationActive={false} />
          <Bar
            dataKey="opex"
            name="Operating costs"
            stackId="rev"
            fill={COST_COLORS.opex}
            isAnimationActive={false}
          />
          <Bar
            dataKey="ebit"
            name="EBIT"
            stackId="rev"
            fill={COST_COLORS.ebit}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="ebitLine"
            name="EBIT (actual)"
            stroke={SEMANTIC.profit}
            strokeWidth={2.5}
            dot={{ r: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
