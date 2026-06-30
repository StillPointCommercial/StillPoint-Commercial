import { describe, it, expect } from 'vitest'
import {
  computeWorkbookRevenue,
  computeWorkbookMix,
  computeWorkbookFunnel,
  computeWorkbookByMotion,
  computeWorkbookCategoryRevenue,
  streamOmzet,
  parseWorkbookInputs,
  serializeWorkbookInputs,
  newCogsByEntity,
  deriveCostContext,
  computeWorkbookCosts,
  type WorkbookInputs,
  type MargesMap,
} from './workbook'
import type { DashboardBlock, EntityPnl } from './workbook-blocks'

const r2 = (a: number[]) => a.map((x) => Math.round(x * 100) / 100)

// Adapta "Prognose 2027-2030 V12" inputs, transcribed from the Groeimotor sheet.
const ADAPTA: WorkbookInputs = {
  logos: [
    { key: 'google', label: 'g', instap: 300000, growth: 0.15, counts: [2, 2, 3, 3], startMonths: [1, 1, 1, 1] },
    { key: 'microsoft', label: 'ms', instap: 300000, growth: 0.15, counts: [1, 2, 2, 2], startMonths: [1, 1, 1, 1] },
    { key: 'puls', label: 'puls', instap: 300000, growth: 0.15, counts: [1, 2, 3, 4], startMonths: [1, 1, 1, 1] },
  ],
  mix: [
    { label: 'Uren implementatie', google: 0.1, ms: 0.1, puls: 0 },
    { label: 'Beheer', google: 0.1, ms: 0.1, puls: 0 },
    { label: 'Licenties Google', google: 0.8, ms: 0, puls: 0 },
    { label: 'Puls (Hello + DWV)', google: 0, ms: 0, puls: 1 },
    { label: 'Licenties overige', google: 0, ms: 0.8, puls: 0 },
  ],
  crossSell: [
    { label: 'IAM', category: 'Licenties IAM', entity: 'meevynd', values: [280000, 600000, 950000, 1300000] },
    { label: 'Bereik', category: 'Bereikbaarheid 24/7', entity: 'meevynd', values: [140000, 280000, 440000, 620000] },
    { label: 'Beheer', category: 'Beheer', entity: 'meevynd', values: [150000, 300000, 450000, 600000] },
    { label: 'HW new', category: 'Hardware', entity: 'meevynd', values: [200000, 400000, 650000, 950000] },
    { label: 'HW repl', category: 'Hardware', entity: 'meevynd', values: [0, 900000, 0, 950000] },
    { label: 'Projecten', category: 'Uren implementatie', entity: 'meevynd', values: [150000, 250000, 350000, 450000] },
    { label: 'Onafh. werkplek', category: 'Beheer', entity: 'meevynd', values: [240000, 360000, 720000, 1200000] },
    { label: 'Puls cross-sell', category: 'Puls (Hello + DWV)', entity: 'naerby', values: [0, 0, 0, 0] },
    { label: 'Grund', category: 'Overige', entity: 'naerby', values: [250000, 500000, 1200000, 2500000] },
  ],
}

describe('workbook revenue (faithful to Groeimotor)', () => {
  it('reproduces the logo omzet rows L7:O9', () => {
    const c = computeWorkbookRevenue(ADAPTA)
    expect(r2(c.logoOmzet.google)).toEqual([600000, 690000, 1190250, 1368787.5])
    expect(r2(c.logoOmzet.microsoft)).toEqual([300000, 690000, 793500, 912525])
    expect(r2(c.logoOmzet.puls)).toEqual([300000, 690000, 1190250, 1825050])
  })

  it('reproduces the entity subtotals and the group total exactly', () => {
    const c = computeWorkbookRevenue(ADAPTA)
    expect(r2(c.meevyndNew)).toEqual([2060000, 4470000, 5543750, 8351312.5])
    expect(r2(c.naerbyNew)).toEqual([550000, 1190000, 2390250, 4325050])
    expect(r2(c.totalNew)).toEqual([2610000, 5660000, 7934000, 12676362.5])
  })

  it('parses sheet ranges, assigns entities by category, and round-trips', () => {
    const ranges = {
      logos: [
        ['300000', '0.15', '2', '2', '3', '3', '1', '1', '1', '1'],
        ['300000', '0.15', '1', '2', '2', '2', '1', '1', '1', '1'],
        ['300000', '0.15', '1', '2', '3', '4', '1', '1', '1', '1'],
      ],
      mix: [
        ['0.1', '0.1', '0'],
        ['0.1', '0.1', '0'],
        ['0.8', '0', '0'],
        ['0', '0', '1'],
        ['0', '0.8', '0'],
      ],
      crossSell: [
        ['280000', '600000', '950000', '1300000'],
        ['140000', '280000', '440000', '620000'],
        ['150000', '300000', '450000', '600000'],
        ['200000', '400000', '650000', '950000'],
        ['0', '900000', '0', '950000'],
        ['150000', '250000', '350000', '450000'],
        ['240000', '360000', '720000', '1200000'],
        ['0', '0', '0', '0'],
        ['250000', '500000', '1200000', '2500000'],
      ],
      crossSellLabels: [
        ['Cross-sell Omsorg/IAM', 'Licenties IAM'],
        ['Bereikbaarheid', 'Bereikbaarheid 24/7'],
        ['Beheer cross-sell', 'Beheer'],
        ['Hardware nieuw', 'Hardware'],
        ['Hardware vervanging', 'Hardware'],
        ['Projecten', 'Uren implementatie'],
        ['Onafhankelijke werkplek', 'Beheer'],
        ['Puls cross-sell', 'Puls (Hello + DWV)'],
        ['Grund', 'Overige'],
      ],
    }
    const parsed = parseWorkbookInputs(ranges)
    expect(r2(computeWorkbookRevenue(parsed).totalNew)).toEqual([2610000, 5660000, 7934000, 12676362.5])
    expect(parsed.crossSell[7].entity).toBe('naerby')
    expect(parsed.crossSell[8].entity).toBe('naerby')
    expect(parsed.crossSell[0].entity).toBe('meevynd')

    const writes = serializeWorkbookInputs(parsed, {
      logos: 'Groeimotor!B7:K9',
      productMix: 'Groeimotor!B13:D17',
      crossSell: 'Groeimotor!C21:F29',
    })
    expect(writes[0].values[0]).toEqual([300000, 0.15, 2, 2, 3, 3, 1, 1, 1, 1])
    expect(writes[1].values.length).toBe(5)
    expect(writes[2].values.length).toBe(9)
    expect(writes[2].values[8]).toEqual([250000, 500000, 1200000, 2500000])
  })
})

describe('workbook mix + funnel (app-side, linked to the model)', () => {
  it('mix categories split new-logo revenue and sum to the logo omzet total', () => {
    const mix = computeWorkbookMix(ADAPTA)
    expect(mix.length).toBe(5)
    const total2030 = mix.reduce((s, c) => s + c.perYear[3], 0)
    expect(total2030).toBeCloseTo(1368787.5 + 912525 + 1825050, 0)
    expect(mix.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1, 6)
  })

  it('funnel back-calculates from contracts (= new logos) through the conversion rates', () => {
    const f = computeWorkbookFunnel(ADAPTA)
    expect(f.stages[0].stage).toBe('Leads')
    expect(f.stages[5].stage).toBe('Contracts')
    expect(f.stages[5].perYear[3]).toBe(9) // google 3 + ms 2 + puls 4
    expect(f.stages[0].perYear[3]).toBeGreaterThan(f.stages[5].perYear[3])
  })

  it('funnel reflects edited conversion rates and exposes the capacity gap', () => {
    const slow = computeWorkbookFunnel({
      ...ADAPTA,
      funnel: { cSL: 30, cLD: 50, cDD: 50, cDV: 50, cVC: 40, leadCapacity: 50 },
    })
    const base = computeWorkbookFunnel(ADAPTA)
    expect(slow.totalLeads).toBeGreaterThan(base.totalLeads)
    expect(slow.leadGapPerYear[3]).toBeGreaterThan(0)
  })
})

describe('workbook live cost / EBIT model (faithful to Marges + Dashboard)', () => {
  // Purchase-% from the Marges tab (services = 0%, so omitted).
  const ADAPTA_MARGES: MargesMap = {
    'Licenties Google': 0.893,
    'Licenties overige': 0.893,
    'Licenties IAM': 0.098,
    'Puls (Hello + DWV)': 0.623,
    Hardware: 0.757,
  }

  // Dashboard snapshot (per entity + group), years 2027-2030, transcribed from the workbook.
  const ent = (name: string, omzet: number[], cogs: number[], brutomarge: number[], ebit: number[]): EntityPnl => ({
    name,
    omzet,
    cogs,
    brutomarge,
    totaleKosten: [],
    personeel: [],
    ebitda: [],
    ebit,
    net: [],
  })

  const fakeDash: DashboardBlock = {
    years: [2027, 2028, 2029, 2030],
    entities: [
      ent(
        'Meevynd',
        [9092225.68, 11502225.68, 12575975.68, 15383538.18],
        [5362778.96, 6569558.96, 6542886.46, 7735896.09],
        [3729446.72, 4932666.72, 6033089.22, 7647642.1],
        [1078099.96, 1167368.58, 1658817.05, 3040556.35],
      ),
      ent(
        'Naerby',
        [2964004, 3604004, 4804254, 6739054],
        [1653981, 1896951, 2208606.75, 2604087.15],
        [1310023, 1707053, 2595647.25, 4134966.85],
        [-363120.05, -435200.71, -71678.77, 1256790.15],
      ),
      ent('Holding', [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [-32612, -57612, -57612, -57612]),
      ent(
        'Groep',
        [12056229.68, 15106229.68, 17380229.68, 22122592.18],
        [7016759.96, 8466509.96, 8751493.21, 10339983.24],
        [5039469.72, 6639719.72, 8628736.47, 11782608.95],
        [682367.91, 674555.88, 1529526.28, 4239734.5],
      ),
    ],
    doelpad: { laag: [], midden: [], hoog: [] },
  }

  it('rebuilds new-revenue COGS per entity from the Marges purchase-%', () => {
    // Meevynd 2027: Lic Google 480000*0.893 + Lic overige 240000*0.893 + IAM 280000*0.098 + Hardware 200000*0.757.
    const expected = 480000 * 0.893 + 240000 * 0.893 + 280000 * 0.098 + 200000 * 0.757
    expect(newCogsByEntity(ADAPTA, ADAPTA_MARGES).meevynd[0]).toBeCloseTo(expected, 0)
  })

  it('reproduces the Dashboard group EBIT at import (live model == document)', () => {
    const ctx = deriveCostContext(fakeDash, ADAPTA, ADAPTA_MARGES)
    const costs = computeWorkbookCosts(ADAPTA, ctx, ADAPTA_MARGES)
    const snap = [682367.91, 674555.88, 1529526.28, 4239734.5]
    snap.forEach((v, i) => expect(costs.groep.ebit[i]).toBeCloseTo(v, 0))
  })

  it('shows operating leverage: more google logos lift EBIT (fixed opex held)', () => {
    const ctx = deriveCostContext(fakeDash, ADAPTA, ADAPTA_MARGES)
    const baseEbit = computeWorkbookCosts(ADAPTA, ctx, ADAPTA_MARGES).groep.ebit[3]
    const grown: WorkbookInputs = {
      ...ADAPTA,
      logos: ADAPTA.logos.map((s) => (s.key === 'google' ? { ...s, counts: [4, 4, 5, 5] } : s)),
    }
    const grownEbit = computeWorkbookCosts(grown, ctx, ADAPTA_MARGES).groep.ebit[3]
    expect(grownEbit).toBeGreaterThan(baseEbit)
  })
})

describe('workbook revenue split (by motion + by category)', () => {
  it('by-motion split adds up to the group new total', () => {
    const m = computeWorkbookByMotion(ADAPTA)
    expect(m.total[3]).toBeCloseTo(12676362.5, 0)
    expect(m.newLogos[3] + m.crossSell[3]).toBeCloseTo(m.total[3], 6)
    expect(m.newLogos[3]).toBeGreaterThan(0)
    expect(m.crossSell[3]).toBeGreaterThan(0)
  })

  it('category revenue sums to the group new total across several categories', () => {
    const cats = computeWorkbookCategoryRevenue(ADAPTA)
    const total2030 = cats.reduce((s, c) => s + c.perYear[3], 0)
    expect(total2030).toBeCloseTo(12676362.5, 0)
    expect(cats.length).toBeGreaterThan(5)
  })
})

describe('logo value ceiling (entry value + max total value + cap %)', () => {
  it('is uncapped by default (matches the sheet) and plateaus at capPct% of maxValue', () => {
    const capped = streamOmzet({
      key: 'google', label: 'g', instap: 300000, growth: 0.15,
      counts: [1, 1, 1, 1], startMonths: [1, 1, 1, 1], maxValue: 350000, capPct: 100,
    })
    expect(capped[0]).toBeCloseTo(300000, 0) // 300000 < 350000 ceiling
    expect(capped[3]).toBeCloseTo(350000, 0) // 300000*1.15^3 = 456262.5 -> capped to 350000
    // ADAPTA (no maxValue) stays uncapped and unchanged
    expect(streamOmzet(ADAPTA.logos[0])[3]).toBeCloseTo(1368787.5, 0)
  })
})
