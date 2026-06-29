// Business Case Model — pure math. No side effects; fully unit-tested.
import type { Dataset, Params, Computed, FunnelRow, MarginKey } from './types'

export function sum(a: number[]): number {
  return a.reduce((s, x) => s + x, 0)
}

function runningSum(a: number[]): number[] {
  const out: number[] = []
  let s = 0
  for (const x of a) { s += x; out.push(s) }
  return out
}

/** Ramp fraction at relationship year k (1..5). */
export function frac(k: number, instap: number, groei: number, plafond: number): number {
  return Math.min(plafond, instap + groei * (k - 1)) / 100
}

/** Spread a CUMULATIVE logo total across the five years by a pattern; result sums to cumLogos. */
export function distribute(cumLogos: number, pattern: number[]): number[] {
  const tot = sum(pattern)
  if (tot === 0) return pattern.map(() => 0)
  return pattern.map((p) => (p * cumLogos) / tot)
}

/** Revenue across calendar years from all cohorts signed up to that year, each ramped by its age. */
export function cohort(newPerYear: number[], MAX: number, instap: number, groei: number, plafond: number): number[] {
  const n = newPerYear.length
  const out = new Array(n).fill(0)
  for (let cal = 0; cal < n; cal++) {
    let v = 0
    for (let c = 0; c <= cal; c++) {
      v += newPerYear[c] * MAX * frac(cal - c + 1, instap, groei, plafond)
    }
    out[cal] = v
  }
  return out
}

const MIX_LABELS: { key: MarginKey; label: string; param: keyof Params }[] = [
  { key: 'lic', label: 'Licenties', param: 'mix_lic' },
  { key: 'beheer', label: 'Beheer & support', param: 'mix_beheer' },
  { key: 'omsorg', label: 'Omsorg / IAM', param: 'mix_omsorg' },
  { key: 'bereik', label: 'Bereikbaarheid', param: 'mix_bereik' },
  { key: 'hardware', label: 'Hardware', param: 'mix_hardware' },
  { key: 'puls', label: 'Puls', param: 'mix_puls' },
  { key: 'grund', label: 'Grund', param: 'mix_grund' },
]

export function compute(ds: Dataset, p: Params): Computed {
  const years = ds.productLines.google_lic.map((_, i) => 2026 + i)

  // --- logos (cumulative totals spread by pattern) ---
  const newPerYearG = distribute(p.gLogos, ds.logoPatternG)
  const newPerYearMS = distribute(p.msLogos, ds.logoPatternMS)

  const newLogoRevG = cohort(newPerYearG, p.gMax, p.instap, p.groei, p.plafond)
  const newLogoRevMS = cohort(newPerYearMS, p.msMax, p.instap, p.groei, p.plafond)
  const newLogoRev = newLogoRevG.map((v, i) => v + newLogoRevMS[i])

  // cross-sell and innovation are FIXED euro arrays from the dataset, constant across scenarios
  const crossUp = ds.motion.cross_up
  const innov = ds.motion.innov
  const newTotal = newLogoRev.map((v, i) => v + crossUp[i] + innov[i])
  const base = years.map((_, y) => p.baseline * Math.pow(1 - p.baselineChurn / 100, y))
  const totalRevenue = newTotal.map((v, i) => v + base[i])

  // current-forecast reference (uses the dataset's own new_business motion)
  const forecastNewBusiness = ds.motion.new_business
  const forecastTotal = forecastNewBusiness.map((v, i) => v + crossUp[i] + innov[i] + ds.baseline)

  // --- margin ---
  const mixShares = MIX_LABELS.map((m) => ({
    key: m.key, label: m.label, share: p[m.param] as number, margin: ds.margins[m.key],
  }))
  const mixTot = mixShares.reduce((s, m) => s + m.share, 0) || 1
  const blendedMargin = mixShares.reduce((s, m) => s + (m.share / mixTot) * m.margin, 0)
  const marginEuro = newLogoRev.map((v) => v * blendedMargin)

  // --- logo cumulatives & value ---
  const cumLogosG = runningSum(newPerYearG)
  const cumLogosMS = runningSum(newPerYearMS)
  const cumLogos = cumLogosG.map((v, i) => v + cumLogosMS[i])
  const totalNewLogos2030 = cumLogos[cumLogos.length - 1]
  const avgValuePerLogo = totalNewLogos2030 > 0 ? newLogoRev[newLogoRev.length - 1] / totalNewLogos2030 : 0
  const valuePerLogoG = [1, 2, 3, 4, 5].map((k) => p.gMax * frac(k, p.instap, p.groei, p.plafond))
  const valuePerLogoMS = [1, 2, 3, 4, 5].map((k) => p.msMax * frac(k, p.instap, p.groei, p.plafond))

  // --- market ---
  const marketPenetration = (p.bestaande + totalNewLogos2030) / (p.samKern || 1)
  const cumWonByYear = cumLogos
  const whitespace = cumWonByYear.map((won) => p.samKern - p.bestaande - won)

  // --- funnel (back-calculated from contracts; Leads is the widest top stage) ---
  const contracts = newPerYearG.map((v, i) => v + newPerYearMS[i])
  const voorstellen = contracts.map((v) => v / (p.c_vc / 100))
  const demos = voorstellen.map((v) => v / (p.c_dv / 100))
  const meetings = demos.map((v) => v / (p.c_dd / 100))
  const suspects = meetings.map((v) => v / (p.c_ld / 100))
  const leads = suspects.map((v) => v / (p.c_sl / 100))
  const perMonth = (arr: number[]) => sum(arr) / 60
  const funnel: FunnelRow[] = [
    { stage: 'Leads', perYear: leads, perMonth: perMonth(leads) },
    { stage: 'Suspects', perYear: suspects, perMonth: perMonth(suspects) },
    { stage: 'Meetings / discovery', perYear: meetings, perMonth: perMonth(meetings) },
    { stage: "Demo's", perYear: demos, perMonth: perMonth(demos) },
    { stage: 'Voorstellen', perYear: voorstellen, perMonth: perMonth(voorstellen) },
    { stage: 'Contracten', perYear: contracts, perMonth: perMonth(contracts) },
  ]
  const totalLeads = sum(leads)
  const leadsPctCore = totalLeads / (p.samKern || 1)
  const leadsPerMonth2030 = leads[leads.length - 1] / 12

  // --- investment & return (the net business case) ---
  const grossContribution = newTotal.map((v) => v * blendedMargin)
  const annualGtmCost = p.gtmFte * p.gtmCostPerFte + p.deliveryFte * p.deliveryCostPerFte + p.marketingSpend
  const gtmCost = years.map(() => annualGtmCost)
  const netContribution = grossContribution.map((v, i) => v - gtmCost[i])
  const cumulativeCash = runningSum(netContribution)
  const totalGtmCost = sum(gtmCost)
  const totalContribution = sum(grossContribution)
  const netByEnd = cumulativeCash[cumulativeCash.length - 1]
  const roi = totalGtmCost > 0 ? totalContribution / totalGtmCost : 0
  let paybackYear: number | null = null
  let paybackMonths: number | null = null
  for (let i = 0; i < cumulativeCash.length; i++) {
    if (cumulativeCash[i] >= 0) {
      paybackYear = years[i]
      const prev = i > 0 ? cumulativeCash[i - 1] : 0
      const denom = cumulativeCash[i] - prev
      const fracInto = denom > 0 ? Math.min(1, Math.max(0, -prev / denom)) : 0
      paybackMonths = Math.round((i + fracInto) * 12)
      break
    }
  }

  // --- lead capacity vs demand ---
  const leadCapacityPerYear = years.map(() => p.leadCapacity)
  const leadGapPerYear = leads.map((v, i) => Math.max(0, v - leadCapacityPerYear[i]))
  const leadCoverage = totalLeads > 0 ? sum(leadCapacityPerYear) / totalLeads : 0

  const deltaVsPlan2030 =
    totalRevenue[totalRevenue.length - 1] - ds.planHerijkt[p.tier][totalRevenue.length - 1]

  return {
    years,
    newLogoRev, newLogoRevG, newLogoRevMS, crossUp, innov, newTotal, base, totalRevenue,
    forecastTotal, forecastNewBusiness,
    blendedMargin, marginEuro, mixShares,
    newPerYearG, newPerYearMS, cumLogosG, cumLogosMS, cumLogos,
    totalNewLogos2030, avgValuePerLogo, valuePerLogoG, valuePerLogoMS,
    marketPenetration, whitespace, cumWonByYear,
    funnel, leadsPerYear: leads, totalLeads, leadsPctCore, leadsPerMonth2030,
    planPath: ds.planHerijkt[p.tier], deltaVsPlan2030,
    gtmCost, grossContribution, netContribution, cumulativeCash,
    paybackYear, paybackMonths, roi, totalGtmCost, totalContribution, netByEnd,
    leadCapacityPerYear, leadGapPerYear, leadCoverage,
  }
}
