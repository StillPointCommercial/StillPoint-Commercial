// Adapta market intel: new-business prospects + current-client cross-sell openings.
// Sourced (app-side, static) from the marktanalyse workbook "Cross-sell matrix / nieuw
// business google prospects". This is REFERENCE data, identical across scenarios and not a
// per-scenario model input, so it lives here rather than in the Google Sheet round-trip.
// The source has org size (# employees) and a revenue-potential tier + a product cross-sell
// matrix, but no literal numeric ICP score and no separate healthcare-staff count, so ICP is
// represented via the value tier + sales priority, and "staff" is total employees.

import { KERN_ICP_ORGS } from './market'

export type ValueTier = 'groot' | 'midden' | 'klein' | 'seed'

/** Modeled ARR per account by revenue-potential tier (workbook "Definities" tab). */
export const TIER_ARR: Record<ValueTier, number> = {
  groot: 1_500_000, // "Groot: 1,5 miljoen of meer"
  midden: 1_000_000, // "Middengroot: rond 1 miljoen"
  klein: 500_000, // "Klein: rond de 500k"
  seed: 250_000, // "Groth seed" / "Goed initiatief": nascent
}

export const TIER_LABEL: Record<ValueTier, string> = {
  groot: 'Groot (≥ €1,5M)',
  midden: 'Midden (~€1M)',
  klein: 'Klein (~€500k)',
  seed: 'Seed',
}

export interface Prospect {
  name: string
  employees: number | null
  tier: ValueTier
  cloud: string
  priority: string // 'High' | 'Twijfel' | 'Blacklist'
  partner: string
  note: string
}

export interface ClientCrossSell {
  name: string
  employees: number | null
  tier: ValueTier
  crossSellOpen: number // # of products still 'Potential' = expansion whitespace on the account
  note: string
}

/** New-business prospects (Google-cloud health orgs) identified in the marktanalyse. */
export const PROSPECTS: Prospect[] = [
  { name: 'Prisma', employees: 3000, tier: 'midden', cloud: 'Google', priority: 'High', partner: 'Xebia', note: 'Formele uitvraag gedaan' },
  { name: 'Cello', employees: 3000, tier: 'midden', cloud: 'Google', priority: 'High', partner: 'Zepps', note: 'Gesprekken lopen (licenties 30 sept 2026)' },
  { name: 'Prodeba', employees: 450, tier: 'klein', cloud: 'Google', priority: 'High', partner: 'Zepps', note: 'Gesprekken gestart (licenties eind 2026)' },
  { name: 'Aafje', employees: 5000, tier: 'groot', cloud: 'Google', priority: 'High', partner: 'Onduidelijk', note: 'Weinig bekend; contactpersoon eerder bij Amstelring.' },
  { name: 'ZuidZorg', employees: 1250, tier: 'midden', cloud: 'Google', priority: 'High', partner: 'Ecare', note: 'Licenties lopen af in 2027' },
  { name: 'Altrecht', employees: 4000, tier: 'midden', cloud: 'Google', priority: 'Blacklist', partner: 'Onduidelijk', note: 'Veel energie in gestoken, wordt nooit concreet' },
  { name: 'Laurens', employees: 6000, tier: 'groot', cloud: 'Google', priority: 'Twijfel', partner: 'Xebia', note: 'Recent IAM-demo; vaak veel energie, weinig concreet. Aanbesteding eerder verloren.' },
  { name: 'Sensire', employees: 4000, tier: 'groot', cloud: 'Google', priority: 'Twijfel', partner: 'Rechtstreeks bij Google', note: 'Recent rechtstreeks bij Google ingekocht (2026).' },
]

/** Current clients + how many products are still open to cross-sell (expansion whitespace). */
export const CURRENT_CLIENTS: ClientCrossSell[] = [
  { name: 'BrabantZorg', employees: 6000, tier: 'groot', crossSellOpen: 3, note: '' },
  { name: 'Buurtzorg', employees: 14500, tier: 'groot', crossSellOpen: 2, note: '' },
  { name: 'De Betuwe', employees: 1200, tier: 'klein', crossSellOpen: 2, note: '' },
  { name: 'Prisma', employees: 3000, tier: 'midden', crossSellOpen: 3, note: '' },
  { name: 'ZuidZorg', employees: 3000, tier: 'midden', crossSellOpen: 6, note: '' },
  { name: 'Lister', employees: 1200, tier: 'midden', crossSellOpen: 4, note: '' },
  { name: 'Thuiszorg West-Brabant', employees: 2200, tier: 'midden', crossSellOpen: 6, note: 'Vaker om tafel gezeten, weinig concreet; doen veel zelf.' },
  { name: 'FysioHolland', employees: 550, tier: 'klein', crossSellOpen: 3, note: '' },
  { name: 'Zorgfederatie Oldenzaal', employees: 450, tier: 'klein', crossSellOpen: 4, note: '' },
  { name: 'Livio', employees: 2200, tier: 'groot', crossSellOpen: 2, note: 'Zitten op Microsoft.' },
  { name: 'Prodeba', employees: 450, tier: 'seed', crossSellOpen: 6, note: 'Groeit met ~120 mdw per jaar.' },
  { name: 'Het Vertrouwde Dorp', employees: 51, tier: 'klein', crossSellOpen: 0, note: '' },
  { name: 'ZuidZorg Wijkzorg', employees: 1200, tier: 'klein', crossSellOpen: 5, note: 'Per 1 mei 2026 alles van Ecare naar ons overgegaan.' },
  { name: 'Buurtdiensten NL', employees: 4500, tier: 'groot', crossSellOpen: 0, note: 'IAM opschalen in Q2 2026; project loopt.' },
  { name: 'FysioHolland STTC', employees: 510, tier: 'klein', crossSellOpen: 1, note: '' },
  { name: 'Phlox', employees: 50, tier: 'seed', crossSellOpen: 3, note: '' },
  { name: 'Health4You', employees: 4, tier: 'seed', crossSellOpen: 0, note: 'Te kleine organisatie, groeit niet.' },
  { name: 'Leading Aesthetics', employees: 20, tier: 'seed', crossSellOpen: 0, note: 'Koos voor Microsoft; aflopend Google-account.' },
]

// Microsoft suspects: orgs surfaced via the MS365-onderzoek + outreach. Earlier stage than the
// Google prospects and from a contact list, so no value tier / employee count in the source,
// only the org, care segment, how many people are engaged, the signal stage, and last touch.
export interface MicrosoftSuspect {
  name: string
  segment: string // VVT / Ziekenhuis / UMC / Koepel
  contacts: number // people engaged at the org
  stage: string // 'MS365-onderzoek' | 'Outreach' | 'Volledig Microsoft' | 'MS-signaal'
  last: string // last contact date (ISO)
}

export const MS_SUSPECTS: MicrosoftSuspect[] = [
  { name: 'Careyn', segment: 'VVT', contacts: 3, stage: 'MS365-onderzoek', last: '2025-03-17' },
  { name: 'Cordaan', segment: 'VVT', contacts: 3, stage: 'Volledig Microsoft', last: '2025-03-18' },
  { name: 'Heliomare', segment: 'Ziekenhuis / UMC', contacts: 3, stage: 'MS365-onderzoek', last: '2025-05-20' },
  { name: 'SZMK', segment: 'VVT', contacts: 3, stage: 'MS365-onderzoek', last: '2025-03-17' },
  { name: 'Tante Louise', segment: 'VVT', contacts: 3, stage: 'MS365-onderzoek', last: '2025-03-17' },
  { name: 'Thebe', segment: 'VVT', contacts: 3, stage: 'MS365-onderzoek', last: '2025-03-17' },
  { name: 'IJsselheem', segment: 'VVT', contacts: 2, stage: 'MS365-onderzoek', last: '2025-03-03' },
  { name: 'Zonnehuisgroep Noord', segment: 'VVT', contacts: 2, stage: 'MS365-onderzoek', last: '2025-03-17' },
  { name: 'Cardia', segment: 'VVT', contacts: 1, stage: 'MS365-onderzoek', last: '2025-02-26' },
  { name: 'Erasmus MC', segment: 'Ziekenhuis / UMC', contacts: 1, stage: 'Outreach', last: '2024-11-26' },
  { name: 'Het Zand', segment: 'VVT', contacts: 1, stage: 'MS365-onderzoek', last: '2025-02-26' },
  { name: 'Omring', segment: 'VVT', contacts: 1, stage: 'MS365-onderzoek', last: '2025-02-26' },
  { name: 'Radboudumc', segment: 'Ziekenhuis / UMC', contacts: 1, stage: 'Outreach', last: '2024-11-26' },
  { name: 'Sigra', segment: 'Koepel', contacts: 1, stage: 'MS365-onderzoek', last: '2025-03-03' },
  { name: 'UMC Utrecht', segment: 'Ziekenhuis / UMC', contacts: 1, stage: 'Outreach', last: '2024-11-09' },
  { name: 'Zorggroep IJV / Vereen', segment: 'VVT', contacts: 1, stage: 'MS-signaal', last: '2025-02-07' },
]

/** Active pipeline = high-priority prospects (not blacklisted / doubtful). */
export const isActiveProspect = (p: Prospect): boolean => /^high$/i.test(p.priority)

export interface MarketCoverage {
  clients: number
  prospectsActive: number
  prospectsTotal: number
  msSuspects: number
  identified: number // clients + active Google prospects + MS suspects
  kernOrgs: number // kern-ICP org count (SAM)
  undiscovered: number // kern - identified: white space not yet on the radar
  identifiedArr: number // modeled ARR of the active prospect pipeline
  crossSellOpenTotal: number // total open product slots across current clients
}

/** Coverage of the kern-ICP: how much is won / identified vs still-undiscovered white space. */
export function marketCoverage(): MarketCoverage {
  const clients = CURRENT_CLIENTS.length
  const active = PROSPECTS.filter(isActiveProspect)
  const msSuspects = MS_SUSPECTS.length
  const identified = clients + active.length + msSuspects
  return {
    clients,
    prospectsActive: active.length,
    prospectsTotal: PROSPECTS.length,
    msSuspects,
    identified,
    kernOrgs: KERN_ICP_ORGS,
    undiscovered: Math.max(0, KERN_ICP_ORGS - identified),
    identifiedArr: active.reduce((s, p) => s + TIER_ARR[p.tier], 0),
    crossSellOpenTotal: CURRENT_CLIENTS.reduce((s, c) => s + c.crossSellOpen, 0),
  }
}
