// Business Case Model: types

export type Tier = 'laag' | 'mid' | 'hoog'

export const YEARS = [2026, 2027, 2028, 2029, 2030] as const

export type ProductKey =
  | 'google_lic' | 'ms_lic' | 'beheer' | 'bereik' | 'omsorg' | 'ow'
  | 'hw_new' | 'hw_repl' | 'proj' | 'puls_hello' | 'puls_dwv' | 'grund'

export type MarginKey = 'lic' | 'beheer' | 'omsorg' | 'bereik' | 'hardware' | 'puls' | 'grund'

/** A dataset = the structural inputs of the model (seeded from Adapta, or imported from Excel). */
export interface Dataset {
  name: string
  baseline: number
  productLines: Record<ProductKey, number[]>
  motion: { new_business: number[]; cross_up: number[]; innov: number[] }
  logoPatternG: number[]
  logoPatternMS: number[]
  pulsLogos: number[]
  planHerijkt: Record<Tier, number[]>
  margins: Record<MarginKey, number>
}

/** Params = the editable controls of a single scenario. */
export interface Params {
  tier: Tier
  gLogos: number   // CUMULATIVE Google logos by 2030 (not per-year)
  msLogos: number  // CUMULATIVE Microsoft logos by 2030
  gMax: number     // MAX ARR per Google logo
  msMax: number    // MAX ARR per Microsoft logo
  instap: number   // year-1 entry, % of MAX
  groei: number    // growth per relationship year, points
  plafond: number  // plateau, % of MAX
  mix_lic: number
  mix_beheer: number
  mix_omsorg: number
  mix_bereik: number
  mix_hardware: number
  mix_puls: number
  mix_grund: number
  c_sl: number  // lead -> suspect %
  c_ld: number  // suspect -> discovery/meeting %
  c_dd: number  // discovery -> demo %
  c_dv: number  // demo -> proposal %
  c_vc: number  // proposal -> contract %
  samKern: number
  bestaande: number
  baseline: number
  // --- investment & realism ---
  baselineChurn: number      // % per year erosion of the existing book
  gtmFte: number             // go-to-market FTEs (BDM + sales/marketing)
  gtmCostPerFte: number      // loaded cost per GTM FTE, euro / year
  deliveryFte: number        // delivery FTEs (e.g. Microsoft engineer)
  deliveryCostPerFte: number // loaded cost per delivery FTE, euro / year
  marketingSpend: number     // lead-gen / marketing spend, euro / year
  leadCapacity: number       // qualified leads the team can generate, / year
}

export interface Preset {
  key: string
  label: string
  chip: string
  params: Params
}

export interface FunnelRow {
  stage: string
  perYear: number[]
  perMonth: number
}

export interface Computed {
  years: number[]
  // revenue
  newLogoRev: number[]
  newLogoRevG: number[]
  newLogoRevMS: number[]
  crossUp: number[]
  innov: number[]
  newTotal: number[]
  base: number[]
  totalRevenue: number[]
  forecastTotal: number[]      // baseline + motion.new_business + cross_up + innov (the "current forecast" reference)
  forecastNewBusiness: number[]
  // margin
  blendedMargin: number
  marginEuro: number[]
  mixShares: { key: MarginKey; label: string; share: number; margin: number }[]
  // logos
  newPerYearG: number[]
  newPerYearMS: number[]
  cumLogosG: number[]
  cumLogosMS: number[]
  cumLogos: number[]
  totalNewLogos2030: number
  avgValuePerLogo: number
  valuePerLogoG: number[]       // value of one logo by relationship year 1..5
  valuePerLogoMS: number[]
  // market
  marketPenetration: number
  whitespace: number[]
  cumWonByYear: number[]
  // funnel
  funnel: FunnelRow[]
  leadsPerYear: number[]
  totalLeads: number
  leadsPctCore: number
  leadsPerMonth2030: number
  // plan comparison
  planPath: number[]            // planHerijkt[params.tier]
  deltaVsPlan2030: number
  // investment & return (the net business case)
  gtmCost: number[]
  grossContribution: number[]
  netContribution: number[]
  cumulativeCash: number[]
  paybackYear: number | null
  paybackMonths: number | null
  roi: number
  totalGtmCost: number
  totalContribution: number
  netByEnd: number
  // lead capacity vs demand
  leadCapacityPerYear: number[]
  leadGapPerYear: number[]
  leadCoverage: number
  // existing-book churn -> lost accounts
  accountsLost: number[]
  accountsLost2030: number
}
