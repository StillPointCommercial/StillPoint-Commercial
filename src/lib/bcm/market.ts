// Adapta market sizing for the Funnel view, from the ICP / marktomvang analysis (v11).
// TAM = ICP-adjacent NL care orgs; SAM = the core ICP (VVT-stichtingen 800-15K medew,
// which is also the model's core-market count); SOM = realistic 3-year capture.
// Static reference data (NOT from the imported prognose workbook).

export interface MarketTier {
  key: 'tam' | 'sam' | 'som5' | 'som3'
  label: string
  orgs: number
  perYear: number // addressable market, euro / year
  threeYear: number // 3-year addressable market, euro
  note: string
}

export const ADAPTA_MARKET: MarketTier[] = [
  { key: 'tam', label: 'TAM: ICP-aangrenzend', orgs: 1224, perYear: 183_600_000, threeYear: 550_800_000, note: 'NL VVT + Gehandicapten + GGZ + aangrenzend' },
  { key: 'sam', label: 'SAM: kern-ICP', orgs: 220, perYear: 220_000_000, threeYear: 660_000_000, note: 'VVT-stichtingen 800-15K medewerkers (≈ €1M ARR elk)' },
  { key: 'som5', label: 'SOM: 5% share, 3 jr', orgs: 11, perYear: 11_000_000, threeYear: 33_000_000, note: '11 nieuwe klanten à €1M ARR' },
  { key: 'som3', label: 'SOM: 3% conservatief', orgs: 7, perYear: 7_000_000, threeYear: 21_000_000, note: '7 nieuwe klanten à €1M ARR' },
]

/** Average addressable ARR per org in a tier. */
export const tierAvgValue = (t: MarketTier): number => (t.orgs > 0 ? t.perYear / t.orgs : 0)

export const KERN_ICP_ORGS = 220 // SAM org count (== the model's core market)
export const KERN_ICP_MAX_ARR = 1_000_000 // max ARR per kern-ICP account
export const SOM_TARGET_ACCOUNTS = 11 // 5% / 3-year capture target (new accounts)
