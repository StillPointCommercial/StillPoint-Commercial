'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Upload, Table2, FileSpreadsheet } from 'lucide-react'
import { Panel, Kpi, KpiStrip, Segmented, Chip, cx } from '@/components/suite/ui'
import { fmtEur, fmtM, fmtNum, fmtPct } from '@/lib/bcm/format'
import { compute } from '@/lib/bcm/model'
import { presetByKey, PRESETS, GROWTH_KEYS } from '@/lib/bcm/presets'
import { createClient } from '@/lib/supabase/client'
import {
  ensureSeed,
  listScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  createDataset,
  type DatasetRow,
  type ScenarioRow,
} from '@/lib/bcm/store'
import { parseForecastWorkbook } from '@/lib/bcm/import'
import type { Dataset, Params } from '@/lib/bcm/types'
import { ScenarioSidebar } from '@/components/bcm/scenario-sidebar'
import { SectionLogos } from '@/components/bcm/section-logos'
import { SectionMix } from '@/components/bcm/section-mix'
import { SectionFunnel } from '@/components/bcm/section-funnel'
import { SectionOutcome } from '@/components/bcm/section-outcome'
import { ScenarioOverview } from '@/components/bcm/scenario-overview'

type Screen = 'model' | 'overview'

const PRESET_CHIPS: { key: string; label: string }[] = [
  { key: 'plan', label: 'Prognose 1' },
  { key: 'laag', label: 'Laag' },
  { key: 'mid', label: 'Midden' },
  { key: 'hoog', label: 'Hoog' },
]

export default function BusinessCaseModelPage() {
  const [screen, setScreen] = useState<Screen>('model')
  const [userId, setUserId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([])
  const [dataset, setDataset] = useState<DatasetRow | null>(null)
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [params, setParams] = useState<Params | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [sheetUrl, setSheetUrl] = useState('')
  const [exportNote, setExportNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // --- load a workspace (the owner can switch between client orgs) ---
  const loadForOrg = useCallback(async (uid: string, targetOrgId: string | null) => {
    setLoading(true)
    const { dataset: ds, scenarios: scen } = await ensureSeed(uid, targetOrgId)
    setDataset(ds)
    setScenarios(scen)
    const active = scen.find((s) => s.is_baseline) ?? scen[0] ?? null
    setActiveId(active?.id ?? null)
    setParams(active?.params ?? null)
    setLoading(false)
  }, [])

  // --- mount: identify the user, list orgs (owner), load the initial workspace ---
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setLoading(false)
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, role')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      const owner = profile?.role === 'owner'
      let initialOrg = (profile?.org_id as string | null) ?? null
      if (owner) {
        const { data: orgRows } = await supabase.from('orgs').select('id, name').order('name')
        if (cancelled) return
        const list = (orgRows ?? []) as { id: string; name: string }[]
        setOrgs(list)
        initialOrg = list[0]?.id ?? null // default the owner into the first client org
      }
      setUserId(user.id)
      setIsOwner(owner)
      setOrgId(initialOrg)
      await loadForOrg(user.id, initialOrg)
    })()
    return () => {
      cancelled = true
    }
  }, [loadForOrg])

  const computed = useMemo(
    () => (dataset && params ? compute(dataset.data, params) : null),
    [dataset, params],
  )

  const set = useCallback(<K extends keyof Params>(k: K, v: Params[K]) => {
    setParams((p) => (p ? { ...p, [k]: v } : p))
  }, [])

  function applyPreset(key: string) {
    const preset = presetByKey(key)
    if (preset) setParams(preset.params)
  }

  async function reloadScenarios(datasetId: string) {
    const scen = await listScenarios(datasetId)
    setScenarios(scen)
    return scen
  }

  async function switchOrg(targetOrgId: string | null) {
    if (!userId) return
    setOrgId(targetOrgId)
    setWarnings([])
    setExportNote(null)
    setActiveId(null)
    await loadForOrg(userId, targetOrgId)
  }

  // --- scenario CRUD ---
  const handleSelect = useCallback((s: ScenarioRow) => {
    setActiveId(s.id)
    setParams(s.params)
  }, [])

  async function handleRename(id: string, name: string) {
    await updateScenario(id, { name })
    if (dataset) await reloadScenarios(dataset.id)
  }

  async function handleSave(name: string) {
    if (!dataset || !params) return
    setBusy(true)
    try {
      if (activeId) {
        await updateScenario(activeId, { name, params })
        await reloadScenarios(dataset.id)
      } else if (userId) {
        const row = await createScenario(userId, dataset.id, name, params)
        const scen = await reloadScenarios(dataset.id)
        const created = row ?? scen[scen.length - 1]
        if (created) setActiveId(created.id)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleNew(name: string) {
    if (!dataset || !userId || !params) return
    setBusy(true)
    try {
      const row = await createScenario(userId, dataset.id, name, params)
      const scen = await reloadScenarios(dataset.id)
      const created = row ?? scen.find((s) => s.name === name) ?? scen[scen.length - 1]
      if (created) {
        setActiveId(created.id)
        setParams(created.params)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDuplicate() {
    if (!dataset || !userId || !params) return
    const active = scenarios.find((s) => s.id === activeId)
    const name = `${active?.name ?? 'Scenario'} copy`
    setBusy(true)
    try {
      const row = await createScenario(userId, dataset.id, name, params)
      const scen = await reloadScenarios(dataset.id)
      const created = row ?? scen[scen.length - 1]
      if (created) {
        setActiveId(created.id)
        setParams(created.params)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (!dataset) return
    setBusy(true)
    try {
      await deleteScenario(id)
      const scen = await reloadScenarios(dataset.id)
      if (id === activeId) {
        const next = scen.find((s) => s.is_baseline) ?? scen[0] ?? null
        setActiveId(next?.id ?? null)
        if (next) setParams(next.params)
      }
    } finally {
      setBusy(false)
    }
  }

  // --- shared: persist an imported dataset, seed its presets, make it active ---
  async function adoptDataset(
    parsed: Dataset,
    name: string,
    sourceFilename: string | null,
    w: string[],
  ) {
    if (!userId) return
    const row = await createDataset(userId, orgId, name, parsed, sourceFilename)
    setWarnings(w)
    if (row) {
      setDataset(row)
      // A fresh dataset has no scenarios yet — seed the four presets for it.
      let list = await listScenarios(row.id)
      if (list.length === 0) {
        await Promise.all(
          PRESETS.map((p) => createScenario(userId, row.id, p.label, p.params)),
        )
        list = await listScenarios(row.id)
      }
      setScenarios(list)
      const active = list[0] ?? null
      if (active) {
        setActiveId(active.id)
        setParams(active.params)
      }
    }
  }

  // --- Excel import (secondary fallback) ---
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !userId) return
    setBusy(true)
    setWarnings([])
    setExportNote(null)
    try {
      const { dataset: parsed, warnings: w } = await parseForecastWorkbook(file)
      const name = file.name.replace(/\.[^.]+$/, '')
      await adoptDataset(parsed, name, file.name, w)
    } catch (err) {
      setWarnings([`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`])
    } finally {
      setBusy(false)
    }
  }

  // --- Google Sheets import (primary) ---
  async function handleSheetImport() {
    if (!userId || !sheetUrl.trim()) return
    setBusy(true)
    setWarnings([])
    setExportNote(null)
    try {
      const res = await fetch('/api/bcm/import-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetUrl.trim() }),
      })
      const json = (await res.json()) as {
        dataset?: Dataset
        warnings?: string[]
        name?: string
        error?: string
      }
      if (json.error === 'no_google_token') {
        setWarnings(['Sign in with Google to use Sheets import/export.'])
        return
      }
      if (json.error === 'bad_url') {
        setWarnings(['That does not look like a Google Sheets link. Paste the full sheet URL.'])
        return
      }
      if (!res.ok || !json.dataset) {
        setWarnings([`Sheets import failed: ${json.error ?? 'unknown error'}`])
        return
      }
      await adoptDataset(json.dataset, json.name || 'Imported sheet', sheetUrl.trim(), json.warnings ?? [])
      setSheetUrl('')
    } catch (err) {
      setWarnings([`Sheets import failed: ${err instanceof Error ? err.message : 'unknown error'}`])
    } finally {
      setBusy(false)
    }
  }

  // --- Google Sheets export (primary) ---
  async function handleSheetExport() {
    if (!dataset || !params) return
    setBusy(true)
    setExportNote(null)
    try {
      const res = await fetch('/api/bcm/export-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: dataset.name,
          datasetData: dataset.data,
          params,
          growth: GROWTH_KEYS.map((k) => presetByKey(k)!.params),
        }),
      })
      const json = (await res.json()) as { url?: string; error?: string }
      if (json.error === 'no_google_token') {
        setWarnings(['Sign in with Google to use Sheets import/export.'])
        return
      }
      if (!res.ok || !json.url) {
        setWarnings([`Sheets export failed: ${json.error ?? 'unknown error'}`])
        return
      }
      window.open(json.url, '_blank', 'noopener,noreferrer')
      setExportNote('Opened in Google Sheets')
    } catch (err) {
      setWarnings([`Sheets export failed: ${err instanceof Error ? err.message : 'unknown error'}`])
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-[1600px] px-6 py-10">
        <p className="text-sm text-suite-ink-3">Loading model…</p>
      </main>
    )
  }

  if (!dataset || !params || !computed) {
    return (
      <main className="mx-auto max-w-[1600px] px-6 py-10">
        <Panel title="Business Case Model">
          <p className="text-sm text-suite-ink-2">
            Sign in to load your model. Import an Excel forecast or use the sample data to begin.
          </p>
        </Panel>
      </main>
    )
  }

  const c = computed

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-6">
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented<Screen>
          value={screen}
          onChange={setScreen}
          options={[
            { value: 'model', label: 'Business case model' },
            { value: 'overview', label: 'Scenario overview' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3 text-xs text-suite-ink-3">
          {isOwner && (
            <label className="flex items-center gap-1.5">
              <span>Workspace:</span>
              <select
                value={orgId ?? ''}
                onChange={(e) => switchOrg(e.target.value || null)}
                disabled={busy}
                className="rounded-md border border-suite-border bg-suite-bg px-2 py-1 text-xs text-suite-ink focus:border-suite-accent focus:outline-none disabled:opacity-50"
              >
                <option value="">My workspace</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex items-center gap-2">
            <span>Dataset:</span>
            <Chip tone="neutral">{dataset.name}</Chip>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Imported with {warnings.length} note{warnings.length === 1 ? '' : 's'}:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {screen === 'overview' ? (
        <ScenarioOverview />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <ScenarioSidebar
            scenarios={scenarios}
            activeId={activeId}
            total2030={c.totalRevenue[4]}
            busy={busy}
            onSelect={handleSelect}
            onRename={handleRename}
            onSave={handleSave}
            onNew={handleNew}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />

          <div className="min-w-0 space-y-8">
            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-suite-ink-3">Presets:</span>
              {PRESET_CHIPS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className={cx(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    params.tier === presetByKey(p.key)?.params.tier && p.key !== 'plan'
                      ? 'border-suite-accent bg-suite-accent-tint text-suite-accent-dark'
                      : 'border-suite-border text-suite-ink-2 hover:bg-suite-subtle',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Google Sheets I/O (primary) + Excel fallback */}
            <Panel
              title="Google Sheets"
              subtitle="Import a forecast from a Sheet, or export this model to a new Google Sheet."
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSheetImport()
                    }}
                    placeholder="Paste a Google Sheets link…"
                    className="min-w-0 flex-1 rounded-md border border-suite-border bg-suite-bg px-3 py-1.5 text-xs text-suite-ink placeholder:text-suite-ink-3 focus:border-suite-accent focus:outline-none"
                  />
                  <button
                    onClick={handleSheetImport}
                    disabled={busy || !sheetUrl.trim()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-suite-accent bg-suite-accent-tint px-3 py-1.5 text-xs font-medium text-suite-accent-dark transition-colors hover:brightness-95 disabled:opacity-50"
                  >
                    <Table2 size={14} /> Import from Google Sheets
                  </button>
                  <button
                    onClick={handleSheetExport}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-suite-accent bg-suite-accent-tint px-3 py-1.5 text-xs font-medium text-suite-accent-dark transition-colors hover:brightness-95 disabled:opacity-50"
                  >
                    <FileSpreadsheet size={14} /> Export to Google Sheets
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {exportNote && (
                    <span className="text-xs font-medium text-suite-pos">{exportNote}</span>
                  )}
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-suite-ink-3 underline-offset-2 transition-colors hover:text-suite-ink hover:underline disabled:opacity-50"
                  >
                    <Upload size={13} /> Import Excel instead
                  </button>
                </div>
              </div>
            </Panel>

            {/* Ten-KPI strip */}
            <KpiStrip>
              <Kpi label="Total revenue 2030" value={fmtM(c.totalRevenue[4])} sub="base + new" accent />
              <Kpi label="New revenue 2030" value={fmtM(c.newTotal[4])} sub="cumulative ARR" />
              <Kpi label="Blended margin" value={fmtPct(c.blendedMargin)} sub="weighted by mix" />
              <Kpi label="Avg value / new logo" value={fmtEur(c.avgValuePerLogo)} sub="ARR at maturity" />
              <Kpi label="Leads / mo 2030" value={fmtNum(Math.round(c.leadsPerMonth2030))} sub="to hit intake" />
              <Kpi label="Google logos 2030" value={fmtNum(Math.round(c.cumLogosG[4]))} />
              <Kpi label="Microsoft logos 2030" value={fmtNum(Math.round(c.cumLogosMS[4]))} />
              <Kpi label="Total new logos 2030" value={fmtNum(Math.round(c.totalNewLogos2030))} sub="Google + Microsoft" />
              <Kpi label="Market penetration 2030" value={fmtPct(c.marketPenetration)} sub="of core market" />
              <Kpi label="Whitespace 2030" value={fmtNum(Math.round(c.whitespace[4]))} sub="accounts open" />
            </KpiStrip>

            {/* Sections */}
            <SectionLogos params={params} set={set} c={c} dataset={dataset.data} />
            <SectionMix params={params} set={set} c={c} dataset={dataset.data} />
            <SectionFunnel params={params} set={set} c={c} />
            <SectionOutcome params={params} set={set} c={c} dataset={dataset.data} />
          </div>
        </div>
      )}
    </main>
  )
}
