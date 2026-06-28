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
})
