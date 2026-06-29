import { describe, it, expect } from 'vitest'
import { ADAPTA } from './seed'
import { presetByKey } from './presets'
import { compute, distribute } from './model'

const M = 1_000_000
const total2030 = (key: string) => compute(ADAPTA, presetByKey(key)!.params).totalRevenue[4]

describe('BCM model', () => {
  it('growth presets hit the herijkt targets in 2030', () => {
    expect(total2030('laag') / M).toBeCloseTo(22.6, 1)
    expect(total2030('mid') / M).toBeCloseTo(26.7, 1)
    expect(total2030('hoog') / M).toBeCloseTo(30.4, 1)
  })

  it('Leads is the widest funnel stage and the top row', () => {
    const c = compute(ADAPTA, presetByKey('mid')!.params)
    expect(c.funnel[0].stage).toBe('Leads')
    const tops = c.funnel.map((f) => f.perYear[4])
    expect(Math.max(...tops)).toBe(c.funnel[0].perYear[4])
  })

  it('blended margin for the laag mix is ~0.31, proving the seed margins are used (not 0.44)', () => {
    const c = compute(ADAPTA, presetByKey('laag')!.params)
    expect(c.blendedMargin).toBeGreaterThan(0.29)
    expect(c.blendedMargin).toBeLessThan(0.33)
  })

  it('gLogos 11 yields 11 cumulative Google logos by 2030 (not 55)', () => {
    const c = compute(ADAPTA, presetByKey('mid')!.params)
    expect(c.cumLogosG[4]).toBeCloseTo(11, 6)
    expect(c.totalNewLogos2030).toBeCloseTo(22, 6)
  })

  it('distribute spreads a cumulative total without inflating it', () => {
    expect(distribute(11, ADAPTA.logoPatternG).reduce((s, x) => s + x, 0)).toBeCloseTo(11, 6)
    expect(distribute(7, ADAPTA.logoPatternMS).reduce((s, x) => s + x, 0)).toBeCloseTo(7, 6)
  })

  it('avg value per new logo lands in the €M-scale, not €85k', () => {
    const c = compute(ADAPTA, presetByKey('mid')!.params)
    expect(c.avgValuePerLogo).toBeGreaterThan(400000)
  })

  it('default baseline churn is 0, so the baseline stays flat (targets preserved)', () => {
    const c = compute(ADAPTA, presetByKey('mid')!.params)
    expect(c.base[4]).toBeCloseTo(c.base[0], 6)
  })

  it('baseline churn erodes the book and lowers total revenue', () => {
    const p = presetByKey('mid')!.params
    const churned = compute(ADAPTA, { ...p, baselineChurn: 10 })
    expect(churned.base[4]).toBeLessThan(churned.base[0])
    expect(churned.totalRevenue[4]).toBeLessThan(compute(ADAPTA, p).totalRevenue[4])
  })

  it('produces a J-curve: invest first, net positive and paid back within the horizon (mid)', () => {
    const c = compute(ADAPTA, presetByKey('mid')!.params)
    expect(c.netContribution[0]).toBeLessThan(0)
    expect(c.netByEnd).toBeGreaterThan(0)
    expect(c.paybackYear).not.toBeNull()
    expect(c.paybackMonths).toBeGreaterThan(0)
    expect(c.paybackMonths!).toBeLessThanOrEqual(60)
    expect(c.roi).toBeGreaterThan(1)
  })

  it('exposes the lead-gen supply gap (demand exceeds capacity in hoog)', () => {
    const c = compute(ADAPTA, presetByKey('hoog')!.params)
    expect(c.leadCapacityPerYear[0]).toBe(80)
    expect(c.leadGapPerYear[4]).toBeGreaterThan(0)
    expect(c.leadCoverage).toBeGreaterThan(0)
  })

  it('delta vs plan 2030 is computed and near zero for the calibrated mid case', () => {
    const c = compute(ADAPTA, presetByKey('mid')!.params)
    expect(Math.abs(c.deltaVsPlan2030)).toBeLessThan(2_000_000)
  })
})
