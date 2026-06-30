// Parse the read-only computed blocks of a workbook (the cost/people/scenario tabs)
// into structured data for the dashboards. Label-scanning (not fixed offsets) so it
// tolerates small row shifts. Years are 2027-2030 for the P&L, 2026-2030 for targets.

function num(x: unknown): number {
  if (typeof x === 'number') return x
  const n = parseFloat(String(x ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const four = (row: string[] | undefined): number[] => [num(row?.[1]), num(row?.[2]), num(row?.[3]), num(row?.[4])]

// --- Marges tab: category -> purchase fraction (share of category revenue that is COGS) ---

/** Parse the Marges range into a category -> purchase % (fraction) map. Col A = category,
 *  col B = purchase fraction. Services sit at 0%. Empty / zero-key rows are skipped. */
export function parseMargins(rows: string[][]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of rows ?? []) {
    const key = String(row?.[0] ?? '').trim()
    if (!key) continue
    out[key] = num(row?.[1])
  }
  return out
}

// --- Dashboard tab: per-entity + group P&L + target paths ---

export interface EntityPnl {
  name: string
  omzet: number[]
  cogs: number[]
  brutomarge: number[]
  totaleKosten: number[]
  personeel: number[]
  ebitda: number[]
  ebit: number[]
  net: number[]
}

export interface DashboardBlock {
  years: number[]
  entities: EntityPnl[]
  doelpad: { laag: number[]; midden: number[]; hoog: number[] }
}

const METRIC: Record<string, keyof Omit<EntityPnl, 'name'>> = {
  omzet: 'omzet',
  'kostprijs van de omzet': 'cogs',
  brutomarge: 'brutomarge',
  'totale kosten': 'totaleKosten',
  personeelskosten: 'personeel',
  ebitda: 'ebitda',
  ebit: 'ebit',
  'resultaat na belasting': 'net',
}

function blankEntity(name: string): EntityPnl {
  return { name, omzet: [], cogs: [], brutomarge: [], totaleKosten: [], personeel: [], ebitda: [], ebit: [], net: [] }
}

export function parseDashboardBlock(rows: string[][]): DashboardBlock {
  const entities: EntityPnl[] = []
  let cur: EntityPnl | null = null
  const doelpad = { laag: [] as number[], midden: [] as number[], hoog: [] as number[] }
  for (const row of rows ?? []) {
    const a = String(row?.[0] ?? '').trim()
    if (!a) continue
    const al = a.toLowerCase()
    if (/^meevynd/i.test(a)) { cur = blankEntity('Meevynd'); entities.push(cur); continue }
    if (/^naerby/i.test(a)) { cur = blankEntity('Naerby'); entities.push(cur); continue }
    if (/^holding/i.test(a)) { cur = blankEntity('Holding'); entities.push(cur); continue }
    if (/^groep/i.test(a)) { cur = blankEntity('Groep'); entities.push(cur); continue }
    if (al.startsWith('doelpad laag')) { doelpad.laag = four(row); continue }
    if (al.startsWith('doelpad midden')) { doelpad.midden = four(row); continue }
    if (al.startsWith('doelpad hoog')) { doelpad.hoog = four(row); continue }
    const key = METRIC[al]
    if (key && cur) cur[key] = four(row)
  }
  return { years: [2027, 2028, 2029, 2030], entities, doelpad }
}

// --- Personeel: loaded cost per entity (lonen + sociale lasten) ---

export interface PersonnelTotals {
  entities: { name: string; cost: number[] }[]
}

export function parsePersonnelTotals(rows: string[][]): PersonnelTotals {
  const out: { name: string; cost: number[] }[] = []
  for (const row of rows ?? []) {
    const name = String(row?.[0] ?? '').trim()
    if (!name || /^entiteit/i.test(name) || /loonsom|totaal/i.test(name)) continue
    // B-E = lonen 2027-2030 (idx 1-4), F-I = sociale lasten 2027-2030 (idx 5-8)
    const cost = [0, 1, 2, 3].map((y) => num(row?.[1 + y]) + num(row?.[5 + y]))
    if (cost.some((c) => c !== 0)) out.push({ name, cost })
  }
  return { entities: out }
}

// --- Personeel roster: FTE proxy (months active / 12) by year ---

export interface PeopleBlock {
  fteByYear: number[]
  roleCount: number
}

export function parsePersonnelRoster(rows: string[][]): PeopleBlock {
  const fte = [0, 0, 0, 0]
  let roleCount = 0
  for (const row of rows ?? []) {
    const name = String(row?.[0] ?? '').trim()
    if (!name || /^naam|^entiteit|^totaal|loonindexatie/i.test(name)) continue
    // months active per year: cols D-G = idx 3-6
    const months = [num(row?.[3]), num(row?.[4]), num(row?.[5]), num(row?.[6])]
    if (months.every((m) => m === 0)) continue
    roleCount++
    for (let y = 0; y < 4; y++) fte[y] += Math.min(12, months[y]) / 12
  }
  return { fteByYear: fte, roleCount }
}

// --- Scenario tab: Laag / Midden / Hoog target paths (2026-2030) ---

export interface ScenarioPaths {
  years: number[]
  laag: number[]
  midden: number[]
  hoog: number[]
}

export function parseScenarioPaths(rows: string[][]): ScenarioPaths {
  const find = (re: RegExp): number[] => {
    const r = (rows ?? []).find((row) => re.test(String(row?.[0] ?? '')))
    return r ? [num(r[1]), num(r[2]), num(r[3]), num(r[4]), num(r[5])] : [0, 0, 0, 0, 0]
  }
  return { years: [2026, 2027, 2028, 2029, 2030], laag: find(/laag/i), midden: find(/midden/i), hoog: find(/hoog/i) }
}
