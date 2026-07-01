// Faithful reproduction of the Adapta "Groeimotor" revenue engine, plus a parser
// (sheet ranges -> inputs) and a serializer (inputs -> input cells) for the
// copy -> tweak -> export round-trip. Validated against the workbook's own
// subtotals in workbook.test.ts, so the app's live numbers match the document.

import type { DashboardBlock, RosterRole } from './workbook-blocks'

export type { RosterRole } from './workbook-blocks'

export const SHEET_YEARS = [2027, 2028, 2029, 2030] as const
export type Entity = 'meevynd' | 'naerby'
export type StreamKey = 'google' | 'microsoft' | 'puls'

/** Personnel cost entities (loon + overhead are allocated across all three BVs). */
export type CostEntity = 'meevynd' | 'naerby' | 'holding'

/** Cumulative loonindexatie factor per SHEET_YEAR (2027 = 1, then +4% compounding). */
export const PERSONNEL_INDEX = [1, 1.04, 1.082, 1.125] as const

export interface LogoStream {
  key: StreamKey
  label: string
  instap: number // entry value: a new logo's year-1 ARR
  growth: number // growth %/yr as a fraction (0.15)
  counts: number[] // new logos per SHEET_YEARS
  startMonths: number[] // start month per SHEET_YEARS (1..12)
  maxValue?: number // app-side ceiling: max total ARR a logo can reach (e.g. kern-ICP max 1M)
  capPct?: number // plateau as % of maxValue (100 = up to the full max); absent = uncapped
}

export interface MixRow {
  label: string
  google: number
  ms: number
  puls: number
}

export interface CrossSellLine {
  label: string
  category: string
  entity: Entity
  values: number[] // per SHEET_YEARS
}

/** App-side funnel/conversion assumptions, NOT in the sheet. Defaulted on import,
 *  editable, persisted per scenario, and written to the Funnel tab on export. */
export interface FunnelParams {
  cSL: number // lead -> suspect %
  cLD: number // suspect -> meeting %
  cDD: number // meeting -> demo %
  cDV: number // demo -> proposal %
  cVC: number // proposal -> contract %
  leadCapacity: number // qualified leads we can generate, per year
}

export const DEFAULT_FUNNEL: FunnelParams = { cSL: 25, cLD: 35, cDD: 50, cDV: 75, cVC: 85, leadCapacity: 250 }

export interface WorkbookInputs {
  logos: LogoStream[]
  mix: MixRow[]
  crossSell: CrossSellLine[]
  funnel?: FunnelParams // app-side, not from the sheet
  /** Personnel roster, matched by index to the imported baseRoster. bruto/soc/months are
   *  fixed; only the per-role entity allocation (pct) is editable. Absent = no re-allocation. */
  roster?: RosterRole[]
}

export interface WorkbookRevenue {
  years: number[]
  logoOmzet: Record<StreamKey, number[]>
  meevyndNew: number[]
  naerbyNew: number[]
  totalNew: number[]
}

const N = SHEET_YEARS.length
const zeros = (): number[] => new Array(N).fill(0)
function addInto(acc: number[], add: number[]): void {
  for (let i = 0; i < N; i++) acc[i] += add[i] || 0
}

/**
 * Revenue from one logo stream per calendar year: that year's NEW logos x entry
 * price, grown by the calendar-year index and prorated by start month.
 * Matches Groeimotor L7:O9 exactly (e.g. 2x300000x1x(13-1)/12 = 600000).
 */
export function streamOmzet(s: LogoStream): number[] {
  // app-side realism ceiling on a logo's annual value; absent maxValue = uncapped (matches the sheet).
  const ceiling = s.maxValue != null ? ((s.capPct ?? 100) / 100) * s.maxValue : Infinity
  return SHEET_YEARS.map((_, y) => {
    const perLogo = Math.min(s.instap * Math.pow(1 + s.growth, y), ceiling)
    return (s.counts[y] || 0) * perLogo * ((13 - (s.startMonths[y] || 1)) / 12)
  })
}

export function computeWorkbookRevenue(inp: WorkbookInputs): WorkbookRevenue {
  const logoOmzet: Record<StreamKey, number[]> = { google: zeros(), microsoft: zeros(), puls: zeros() }
  for (const s of inp.logos) logoOmzet[s.key] = streamOmzet(s)

  // The mix matrix sums to 100% per stream, so a stream's total revenue is just its
  // logo omzet (distributed across categories downstream). Entity totals add the
  // Blok-2 cross-sell lines assigned to that entity.
  const meevyndNew = zeros()
  const naerbyNew = zeros()
  addInto(meevyndNew, logoOmzet.google)
  addInto(meevyndNew, logoOmzet.microsoft)
  addInto(naerbyNew, logoOmzet.puls)
  for (const line of inp.crossSell) addInto(line.entity === 'naerby' ? naerbyNew : meevyndNew, line.values)

  const totalNew = SHEET_YEARS.map((_, i) => meevyndNew[i] + naerbyNew[i])
  return { years: [...SHEET_YEARS], logoOmzet, meevyndNew, naerbyNew, totalNew }
}

/**
 * Annual loaded cost of one roster role per SHEET_YEAR: bruto monthly salary × months
 * active × (1 + social charges), grown by the cumulative loonindexatie factor. A
 * full-year role costs bruto × 12 × (1 + soc) × INDEX[y]. Faithful to the Personeel tab.
 */
export function roleCost(role: RosterRole): number[] {
  return SHEET_YEARS.map((_, y) => PERSONNEL_INDEX[y] * role.bruto * (role.months[y] || 0) * (1 + role.soc))
}

/** FTE per entity per year = Σ_role (months[y]/12) × that role's entity allocation share. */
export function fteByEntity(roster: RosterRole[]): { meevynd: number[]; naerby: number[]; holding: number[] } {
  const out = { meevynd: zeros(), naerby: zeros(), holding: zeros() }
  for (const role of roster) {
    for (let y = 0; y < N; y++) {
      const f = Math.min(12, role.months[y] || 0) / 12
      out.meevynd[y] += f * (role.pct.meevynd || 0)
      out.naerby[y] += f * (role.pct.naerby || 0)
      out.holding[y] += f * (role.pct.holding || 0)
    }
  }
  return out
}

// --- parse / serialize for the Google Sheets round-trip ---

function num(x: unknown): number {
  if (typeof x === 'number') return x
  const n = parseFloat(String(x ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

const STREAMS: { key: StreamKey; label: string }[] = [
  { key: 'google', label: "Nieuwe Google-logo's (Meevynd)" },
  { key: 'microsoft', label: "Nieuwe Microsoft-logo's (Meevynd)" },
  { key: 'puls', label: 'Nieuwe Puls-opdrachtgevers (Naerby)' },
]
const MIX_LABELS = ['Uren implementatie', 'Beheer', 'Licenties Google', 'Puls (Hello + DWV)', 'Licenties overige']

/** Blok-2 lines feed Naerby when their category is a Naerby category; otherwise Meevynd. */
function entityForCategory(category: string): Entity {
  const c = category.trim()
  return c === 'Puls (Hello + DWV)' || c === 'Overige' ? 'naerby' : 'meevynd'
}

export interface WorkbookRanges {
  logos: string[][] // mapping.revenueInputs.logos  (B7:K9)
  mix: string[][] // productMix                     (B13:D17)
  crossSell: string[][] // crossSell values         (C21:F29)
  crossSellLabels: string[][] // omschrijving + cat (A21:B29)
}

export function parseWorkbookInputs(r: WorkbookRanges): WorkbookInputs {
  const logos: LogoStream[] = STREAMS.map((s, ri) => {
    const row = r.logos[ri] ?? []
    return {
      key: s.key,
      label: s.label,
      instap: num(row[0]),
      growth: num(row[1]),
      counts: [num(row[2]), num(row[3]), num(row[4]), num(row[5])],
      startMonths: [num(row[6]) || 1, num(row[7]) || 1, num(row[8]) || 1, num(row[9]) || 1],
      maxValue: 1_000_000,
      capPct: 100,
    }
  })
  const mix: MixRow[] = MIX_LABELS.map((label, ri) => {
    const row = r.mix[ri] ?? []
    return { label, google: num(row[0]), ms: num(row[1]), puls: num(row[2]) }
  })
  const crossSell: CrossSellLine[] = (r.crossSell ?? []).map((row, ri) => {
    const labelRow = r.crossSellLabels[ri] ?? []
    const category = String(labelRow[1] ?? '')
    return {
      label: String(labelRow[0] ?? ''),
      category,
      entity: entityForCategory(category),
      values: [num(row[0]), num(row[1]), num(row[2]), num(row[3])],
    }
  })
  return { logos, mix, crossSell, funnel: { ...DEFAULT_FUNNEL } }
}

export interface RangeWrite {
  range: string
  values: (string | number)[][]
}

/** Produce the input-cell writes for the copy. Formulas elsewhere are never touched. */
export function serializeWorkbookInputs(
  inp: WorkbookInputs,
  ranges: { logos: string; productMix: string; crossSell: string },
): RangeWrite[] {
  const logoRows = inp.logos.map((s) => [s.instap, s.growth, ...s.counts, ...s.startMonths])
  const mixRows = inp.mix.map((m) => [m.google, m.ms, m.puls])
  const crossRows = inp.crossSell.map((l) => [...l.values])
  return [
    { range: ranges.logos, values: logoRows },
    { range: ranges.productMix, values: mixRows },
    { range: ranges.crossSell, values: crossRows },
  ]
}

// --- app-side derived views: product-mix split + sales funnel (linked to the model) ---

const sumArr = (a: number[]): number => a.reduce((s, x) => s + x, 0)

export interface MixCategory {
  label: string
  perYear: number[]
  share: number // share of the final year's new-logo revenue
}

/** Split new-logo revenue across the mix categories: per category, sum over streams of
 *  that stream's logo omzet x its mix weight. Mirrors the sheet's "Omzet per categorie". */
export function computeWorkbookMix(inp: WorkbookInputs): MixCategory[] {
  const omz: Record<StreamKey, number[]> = { google: zeros(), microsoft: zeros(), puls: zeros() }
  for (const s of inp.logos) omz[s.key] = streamOmzet(s)
  const cats = inp.mix.map((row) => ({
    label: row.label,
    perYear: SHEET_YEARS.map((_, y) => omz.google[y] * row.google + omz.microsoft[y] * row.ms + omz.puls[y] * row.puls),
    share: 0,
  }))
  const lastTotal = sumArr(cats.map((c) => c.perYear[N - 1]))
  for (const c of cats) c.share = lastTotal > 0 ? c.perYear[N - 1] / lastTotal : 0
  return cats
}

export interface MotionSplit {
  years: number[]
  newLogos: number[]
  crossSell: number[]
  total: number[]
}

/** New revenue split by motion: new-logo revenue (all streams) vs Blok-2 cross-sell. */
export function computeWorkbookByMotion(inp: WorkbookInputs): MotionSplit {
  const rev = computeWorkbookRevenue(inp)
  const newLogos = SHEET_YEARS.map(
    (_, y) => rev.logoOmzet.google[y] + rev.logoOmzet.microsoft[y] + rev.logoOmzet.puls[y],
  )
  const crossSell = SHEET_YEARS.map((_, y) => inp.crossSell.reduce((s, l) => s + (l.values[y] || 0), 0))
  const total = SHEET_YEARS.map((_, y) => newLogos[y] + crossSell[y])
  return { years: [...SHEET_YEARS], newLogos, crossSell, total }
}

export interface CategoryRevenue {
  label: string
  perYear: number[]
}

/** Full new-revenue split by product category: logo revenue distributed by the mix
 *  PLUS each cross-sell line added to its own category. Mirrors "Omzet per categorie";
 *  sums to totalNew. */
export function computeWorkbookCategoryRevenue(inp: WorkbookInputs): CategoryRevenue[] {
  const byCat = new Map<string, number[]>()
  const add = (label: string, vals: number[]): void => {
    const cur = byCat.get(label) ?? zeros()
    for (let y = 0; y < N; y++) cur[y] += vals[y] || 0
    byCat.set(label, cur)
  }
  for (const c of computeWorkbookMix(inp)) add(c.label, c.perYear)
  for (const line of inp.crossSell) add(line.category || 'Overige', line.values)
  return [...byCat.entries()].map(([label, perYear]) => ({ label, perYear }))
}

export interface FunnelStage {
  stage: string
  perYear: number[]
  perMonth: number
}

export interface WorkbookFunnel {
  stages: FunnelStage[]
  totalLeads: number
  leadCapacityPerYear: number[]
  leadGapPerYear: number[]
  coverage: number
}

/** Back-calculate the sales funnel from the contracts the model needs (new logos per
 *  year) and the app-side conversion rates. Tweak logo counts and every stage updates. */
export function computeWorkbookFunnel(inp: WorkbookInputs): WorkbookFunnel {
  const f = inp.funnel ?? DEFAULT_FUNNEL
  const pct = (n: number) => (n > 0 ? n / 100 : 1)
  const contracts = SHEET_YEARS.map((_, y) => inp.logos.reduce((s, st) => s + (st.counts[y] || 0), 0))
  const proposals = contracts.map((v) => v / pct(f.cVC))
  const demos = proposals.map((v) => v / pct(f.cDV))
  const meetings = demos.map((v) => v / pct(f.cDD))
  const suspects = meetings.map((v) => v / pct(f.cLD))
  const leads = suspects.map((v) => v / pct(f.cSL))
  const months = N * 12
  const perMonth = (a: number[]) => sumArr(a) / months
  const stages: FunnelStage[] = [
    { stage: 'Leads', perYear: leads, perMonth: perMonth(leads) },
    { stage: 'Suspects', perYear: suspects, perMonth: perMonth(suspects) },
    { stage: 'Meetings', perYear: meetings, perMonth: perMonth(meetings) },
    { stage: "Demo's", perYear: demos, perMonth: perMonth(demos) },
    { stage: 'Proposals', perYear: proposals, perMonth: perMonth(proposals) },
    { stage: 'Contracts', perYear: contracts, perMonth: perMonth(contracts) },
  ]
  const totalLeads = sumArr(leads)
  const leadCapacityPerYear = SHEET_YEARS.map(() => f.leadCapacity)
  const leadGapPerYear = leads.map((v) => Math.max(0, v - f.leadCapacity))
  const coverage = totalLeads > 0 ? (f.leadCapacity * N) / totalLeads : 0
  return { stages, totalLeads, leadCapacityPerYear, leadGapPerYear, coverage }
}

// --- LIVE cost / EBIT model (faithful to the sheet's Marges + Dashboard) ---
//
// COGS for the NEW revenue is rebuilt from the sheet's own purchase-% (Marges): each
// category line's COGS = its revenue x its purchase fraction (services are 0%). The
// pre-existing ("baseline") business and the FIXED opex (personnel + overhead +
// depreciation) are frozen from the import snapshot, so EBIT recomputes live as the
// revenue/mix inputs change while operating leverage holds. At import the live model
// reproduces the Dashboard EBIT exactly (see workbook.test.ts).

/** Category -> purchase fraction (share of that category's revenue that is COGS). */
export type MargesMap = Record<string, number>

interface EntityCostBase {
  baselineOmzet: number[]
  baselineCogs: number[]
  fixedOpex: number[]
  /** fixedOpex minus the snapshot personnel for this entity (overhead + depreciation + ...);
   *  live personnel is re-added on top so re-allocations move cost between entities. */
  nonPersonnelOpex: number[]
}

export interface CostContext {
  meevynd: EntityCostBase
  naerby: EntityCostBase
  holding: EntityCostBase
  groep: EntityCostBase
  /** Authoritative baseline personnel per entity per year, straight from the Dashboard. */
  basePersonnel: { meevynd: number[]; naerby: number[]; holding: number[] }
  /** The roster exactly as imported, the reference allocation for computing live deltas. */
  baseRoster: RosterRole[]
}

export interface EntityCosts {
  name: string
  omzet: number[]
  cogs: number[]
  brutomarge: number[]
  ebit: number[]
  grossMarginPct: number[]
  ebitMarginPct: number[]
}

export interface WorkbookCosts {
  meevynd: EntityCosts
  naerby: EntityCosts
  holding: EntityCosts
  groep: EntityCosts
}

const subArr = (a: number[], b: number[]): number[] => SHEET_YEARS.map((_, i) => (a[i] || 0) - (b[i] || 0))
const sumYears = (a: number[], b: number[]): number[] => SHEET_YEARS.map((_, i) => (a[i] || 0) + (b[i] || 0))

/**
 * COGS of the NEW revenue, split by entity, rebuilt from the Marges purchase-%.
 * Per category line: revenue x purchase fraction (categories not in `marges` are 0%).
 * Mix rows feed Meevynd (google + microsoft weights) or Naerby (puls weight); cross-sell
 * lines feed whichever entity they are assigned to.
 */
export function newCogsByEntity(inp: WorkbookInputs, marges: MargesMap): { meevynd: number[]; naerby: number[] } {
  const omz: Record<StreamKey, number[]> = { google: zeros(), microsoft: zeros(), puls: zeros() }
  for (const s of inp.logos) omz[s.key] = streamOmzet(s)

  const meevynd = zeros()
  const naerby = zeros()
  for (let y = 0; y < N; y++) {
    for (const row of inp.mix) {
      const m = marges[row.label] ?? 0
      meevynd[y] += (omz.google[y] * row.google + omz.microsoft[y] * row.ms) * m
      naerby[y] += omz.puls[y] * row.puls * m
    }
    for (const line of inp.crossSell) {
      const m = marges[line.category] ?? 0
      const add = (line.values[y] || 0) * m
      if (line.entity === 'naerby') naerby[y] += add
      else meevynd[y] += add
    }
  }
  return { meevynd, naerby }
}

export interface CogsCategory {
  label: string
  perYear: number[]
}

/**
 * COGS of the NEW revenue split by product CATEGORY, rebuilt from the same Marges
 * purchase-% used by newCogsByEntity (per category: revenue x purchase fraction; categories
 * not in `marges` are 0%). Mirrors the exact margin math: mix rows distribute logo omzet by
 * their google/ms/puls weights, cross-sell lines add to their own category. Summed over all
 * categories this equals newCogsByEntity.meevynd + naerby per year (same components, regrouped).
 */
export function computeWorkbookCogsByCategory(inp: WorkbookInputs, marges: MargesMap): CogsCategory[] {
  const omz: Record<StreamKey, number[]> = { google: zeros(), microsoft: zeros(), puls: zeros() }
  for (const s of inp.logos) omz[s.key] = streamOmzet(s)

  const byCat = new Map<string, number[]>()
  const add = (label: string, vals: number[]): void => {
    const cur = byCat.get(label) ?? zeros()
    for (let y = 0; y < N; y++) cur[y] += vals[y] || 0
    byCat.set(label, cur)
  }
  for (const row of inp.mix) {
    const m = marges[row.label] ?? 0
    add(
      row.label,
      SHEET_YEARS.map((_, y) => (omz.google[y] * row.google + omz.microsoft[y] * row.ms + omz.puls[y] * row.puls) * m),
    )
  }
  for (const line of inp.crossSell) {
    // Margin lookup uses the raw category (matches newCogsByEntity exactly); only the display
    // label falls back to 'Overige' so a blank-category line still groups somewhere sensible.
    const m = marges[line.category] ?? 0
    add(
      line.category || 'Overige',
      SHEET_YEARS.map((_, y) => (line.values[y] || 0) * m),
    )
  }
  return [...byCat.entries()].map(([label, perYear]) => ({ label, perYear }))
}

export interface StreamValue {
  key: StreamKey
  label: string
  revenue: number[] // new-logo revenue per year for this stream (streamOmzet)
  avgPerAccount: number[] // that year's new-logo revenue / cumulative accounts signed to date
}

/**
 * Per logo stream, how a cohort scales in value: `revenue` is the stream's new-logo revenue
 * per year (the same streamOmzet math the model uses everywhere), `avgPerAccount` is that
 * year's revenue divided by the cumulative accounts signed to date (running sum of counts).
 * Lets the user sanity-check where value lands with the per-stream growth ramp (e.g. 15%/yr).
 * A stream with no cumulative accounts yet reports 0 for that year (avoids divide-by-zero).
 */
export function computeWorkbookStreamValue(inp: WorkbookInputs): StreamValue[] {
  return inp.logos.map((s) => {
    const revenue = streamOmzet(s)
    let cumAccounts = 0
    const avgPerAccount = SHEET_YEARS.map((_, y) => {
      cumAccounts += s.counts[y] || 0
      return cumAccounts > 0 ? revenue[y] / cumAccounts : 0
    })
    return { key: s.key, label: s.label, revenue, avgPerAccount }
  })
}

const findEntity = (dashboard: DashboardBlock, name: string) =>
  dashboard.entities.find((e) => e.name === name)

/**
 * Derive the frozen baseline (pre-existing business + fixed opex) from the import
 * snapshot. baselineOmzet/baselineCogs strip out the model's own new revenue/COGS so
 * that re-adding the live new figures stays faithful; fixedOpex = brutomarge - ebit
 * (the snapshot's total operating cost below the gross margin line, held constant).
 */
export function deriveCostContext(
  dashboard: DashboardBlock,
  importInputs: WorkbookInputs,
  marges: MargesMap,
  roster: RosterRole[] = [],
): CostContext {
  const rev = computeWorkbookRevenue(importInputs)
  const cogs = newCogsByEntity(importInputs, marges)
  const newOmzet = { meevynd: rev.meevyndNew, naerby: rev.naerbyNew, holding: zeros(), groep: rev.totalNew }
  const newCogs = {
    meevynd: cogs.meevynd,
    naerby: cogs.naerby,
    holding: zeros(),
    groep: sumYears(cogs.meevynd, cogs.naerby),
  }
  // Authoritative baseline personnel per BV, straight from the Dashboard's Personeelskosten.
  const personnelOf = (name: string): number[] => SHEET_YEARS.map((_, i) => findEntity(dashboard, name)?.personeel[i] ?? 0)
  const basePersonnel = {
    meevynd: personnelOf('Meevynd'),
    naerby: personnelOf('Naerby'),
    holding: personnelOf('Holding'),
  }
  const groepPersonnel = sumYears(sumYears(basePersonnel.meevynd, basePersonnel.naerby), basePersonnel.holding)
  const personnelByKey: Record<keyof typeof newOmzet, number[]> = {
    meevynd: basePersonnel.meevynd,
    naerby: basePersonnel.naerby,
    holding: basePersonnel.holding,
    groep: groepPersonnel,
  }
  const base = (name: string, key: keyof typeof newOmzet): EntityCostBase => {
    const e = findEntity(dashboard, name)
    const snapOmzet = e?.omzet ?? []
    const snapCogs = e?.cogs ?? []
    const snapBruto = e?.brutomarge ?? []
    const snapEbit = e?.ebit ?? []
    const fixedOpex = subArr(snapBruto, snapEbit)
    return {
      baselineOmzet: subArr(snapOmzet, newOmzet[key]),
      baselineCogs: subArr(snapCogs, newCogs[key]),
      fixedOpex,
      nonPersonnelOpex: subArr(fixedOpex, personnelByKey[key]),
    }
  }
  return {
    meevynd: base('Meevynd', 'meevynd'),
    naerby: base('Naerby', 'naerby'),
    holding: base('Holding', 'holding'),
    groep: base('Groep', 'groep'),
    basePersonnel,
    baseRoster: roster,
  }
}

/**
 * LIVE personnel cost per entity per year. Starts from the authoritative Dashboard
 * baseline, then applies the re-allocation delta of every edited role:
 *   livePersonnel[e][y] = basePersonnel[e][y] + Σ_role roleCost(role)[y] × (livePct − basePct)
 * The live pct comes from `inp.roster` (matched by index to `ctx.baseRoster`); the base
 * pct from `ctx.baseRoster`. With no roster (or identical pct) the deltas are zero, so
 * live personnel == basePersonnel and the EBIT is unchanged. Because a role's cost is a
 * fixed amount merely redistributed across entities, the deltas sum to zero, re-allocation
 * is zero-sum across entities and the GROUP personnel (hence group EBIT) is preserved.
 */
export function personnelByEntity(
  inp: WorkbookInputs,
  ctx: CostContext,
): { meevynd: number[]; naerby: number[]; holding: number[] } {
  const live = {
    meevynd: [...ctx.basePersonnel.meevynd],
    naerby: [...ctx.basePersonnel.naerby],
    holding: [...ctx.basePersonnel.holding],
  }
  const liveRoster = inp.roster
  if (!liveRoster) return live
  ctx.baseRoster.forEach((baseRole, i) => {
    const liveRole = liveRoster[i]
    if (!liveRole) return
    const cost = roleCost(baseRole) // bruto/soc/months are fixed → cost from the base role
    const dM = (liveRole.pct.meevynd || 0) - (baseRole.pct.meevynd || 0)
    const dN = (liveRole.pct.naerby || 0) - (baseRole.pct.naerby || 0)
    const dH = (liveRole.pct.holding || 0) - (baseRole.pct.holding || 0)
    for (let y = 0; y < N; y++) {
      live.meevynd[y] += cost[y] * dM
      live.naerby[y] += cost[y] * dN
      live.holding[y] += cost[y] * dH
    }
  })
  return live
}

/**
 * Compute the LIVE P&L: baseline (frozen) + live new revenue/COGS from the current
 * inputs. Operating cost = non-personnel opex (frozen) + LIVE personnel (re-allocated
 * by the roster); EBIT = brutomarge - operating cost. With no roster edits this is
 * identical to the snapshot fixedOpex, so the import reproduces the Dashboard EBIT.
 */
export function computeWorkbookCosts(inp: WorkbookInputs, ctx: CostContext, marges: MargesMap): WorkbookCosts {
  const rev = computeWorkbookRevenue(inp)
  const cogs = newCogsByEntity(inp, marges)
  const newOmzet = { meevynd: rev.meevyndNew, naerby: rev.naerbyNew, holding: zeros(), groep: rev.totalNew }
  const newCogs = {
    meevynd: cogs.meevynd,
    naerby: cogs.naerby,
    holding: zeros(),
    groep: sumYears(cogs.meevynd, cogs.naerby),
  }
  const livePersonnel = personnelByEntity(inp, ctx)
  const groepPersonnel = sumYears(sumYears(livePersonnel.meevynd, livePersonnel.naerby), livePersonnel.holding)
  const liveOpex: Record<keyof typeof newOmzet, number[]> = {
    meevynd: sumYears(ctx.meevynd.nonPersonnelOpex, livePersonnel.meevynd),
    naerby: sumYears(ctx.naerby.nonPersonnelOpex, livePersonnel.naerby),
    holding: sumYears(ctx.holding.nonPersonnelOpex, livePersonnel.holding),
    groep: sumYears(ctx.groep.nonPersonnelOpex, groepPersonnel),
  }
  const build = (name: string, base: EntityCostBase, key: keyof typeof newOmzet): EntityCosts => {
    const omzet = sumYears(base.baselineOmzet, newOmzet[key])
    const c = sumYears(base.baselineCogs, newCogs[key])
    const brutomarge = subArr(omzet, c)
    const ebit = subArr(brutomarge, liveOpex[key])
    return {
      name,
      omzet,
      cogs: c,
      brutomarge,
      ebit,
      grossMarginPct: SHEET_YEARS.map((_, y) => (omzet[y] ? brutomarge[y] / omzet[y] : 0)),
      ebitMarginPct: SHEET_YEARS.map((_, y) => (omzet[y] ? ebit[y] / omzet[y] : 0)),
    }
  }
  return {
    meevynd: build('Meevynd', ctx.meevynd, 'meevynd'),
    naerby: build('Naerby', ctx.naerby, 'naerby'),
    holding: build('Holding', ctx.holding, 'holding'),
    groep: build('Groep', ctx.groep, 'groep'),
  }
}
