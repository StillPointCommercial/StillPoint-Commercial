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

// --- Personeel roster: FTE proxy (months active / 12) by year, plus the editable roles ---

/** One roster row: fixed pay/ramp + an EDITABLE entity-allocation (H/I/J = %Meevynd/Naerby/Holding). */
export interface RosterRole {
  name: string
  bruto: number // bruto monthly salary (col B)
  soc: number // social charges as a fraction (col C)
  months: number[] // months active per year 2027-2030 (cols D-G)
  pct: { meevynd: number; naerby: number; holding: number } // entity split (cols H/I/J), blank = 0
}

export interface PeopleBlock {
  fteByYear: number[]
  roleCount: number
  roles: RosterRole[]
}

export function parsePersonnelRoster(rows: string[][]): PeopleBlock {
  const fte = [0, 0, 0, 0]
  const roles: RosterRole[] = []
  for (const row of rows ?? []) {
    const name = String(row?.[0] ?? '').trim()
    // Skip the roster's own header + blank spacer rows FIRST: the header carries year labels
    // ("Mnd 2027" ...) in the month columns, which the structural guard below would otherwise
    // read as out-of-range numbers.
    if (!name || /^naam/i.test(name)) continue
    // The Personeel tab continues below the roster with the loonsom totals block (per-entity
    // euro sums: "Entiteit" header + Meevynd/Naerby/Holding rows) and the loonindexatie /
    // cumulatieve-factor rows. The read range is intentionally generous so NEW roster rows are
    // picked up, so it overruns into that block; stop there. Detected two independent ways so
    // it survives a header rename:
    //   (a) LABEL: the known section headers/rows that sit below the roster.
    //   (b) STRUCTURAL: a real role's months active are 0-12; the totals rows carry euro
    //       amounts (hundreds of thousands) in those columns. A month > 12 means we left it.
    // The roster is one contiguous block at the top, so the first such row ends it.
    if (/^(entiteit|loonsom|totaal|indexatie|cumulatie|loonindexatie)/i.test(name)) break
    // months active per year: cols D-G = idx 3-6
    const months = [num(row?.[3]), num(row?.[4]), num(row?.[5]), num(row?.[6])]
    if (months.some((m) => m > 12.5)) break
    if (months.every((m) => m === 0)) continue
    roles.push({
      name,
      bruto: num(row?.[1]), // col B
      soc: num(row?.[2]), // col C (fraction)
      months,
      pct: { meevynd: num(row?.[7]), naerby: num(row?.[8]), holding: num(row?.[9]) }, // cols H/I/J
    })
    for (let y = 0; y < 4; y++) fte[y] += Math.min(12, months[y]) / 12
  }
  return { fteByYear: fte, roleCount: roles.length, roles }
}

// --- Indirecte kosten: per-entity overhead per year (Jaar 2027-2030 in cols K-N) ---

export interface IndirecteCosts {
  meevynd: number[]
  naerby: number[]
  holding: number[]
}

/**
 * Three entity blocks, each headed by a row whose col A names the entity
 * ("Meevynd" / "Naerby" / "Holding"), followed by a "Post" header and post rows.
 * The per-year amounts sit in cols K-N (idx 10-13) = Jaar 2027-2030; sum each
 * entity's post rows over those four columns. Label-scanned, not fixed offsets.
 */
export function parseIndirecte(rows: string[][]): IndirecteCosts {
  const out: IndirecteCosts = { meevynd: [0, 0, 0, 0], naerby: [0, 0, 0, 0], holding: [0, 0, 0, 0] }
  let cur: keyof IndirecteCosts | null = null
  for (const row of rows ?? []) {
    const a = String(row?.[0] ?? '').trim()
    if (/meevynd/i.test(a)) { cur = 'meevynd'; continue }
    if (/naerby/i.test(a)) { cur = 'naerby'; continue }
    if (/holding/i.test(a)) { cur = 'holding'; continue }
    if (!a || /^post/i.test(a) || /totaal/i.test(a)) continue
    if (!cur) continue
    // Jaar 2027-2030 in cols K-N = idx 10-13.
    const vals = [num(row?.[10]), num(row?.[11]), num(row?.[12]), num(row?.[13])]
    if (vals.every((v) => v === 0)) continue
    for (let y = 0; y < 4; y++) out[cur][y] += vals[y]
  }
  return out
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
