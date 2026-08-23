/**
 * StillPoint Suite - app registry + URL helpers (pure module: no React, safe to
 * import from Next.js Server Components and from plain scripts).
 *
 * ONE canonical file, copied verbatim into every StillPoint app next to the
 * AppSwitcher component. Source of truth for the list and the subdomain map:
 * ~/.claude/PROJECTS.md, section "StillPoint Suite". When you add, rename or
 * re-home an app: update PROJECTS.md first, then every copy of this file.
 *
 * URL resolution: links use the *.stillpointcommercial.com subdomains when the
 * current page is itself served from one, otherwise the legacy *.vercel.app
 * URLs. Supabase sessions are per-origin, so this keeps you on one consistent
 * origin family, and nothing breaks before DNS for the subdomains is live.
 */
export type SuiteAppId = 'cis' | 'sign' | 'coi' | 'deals' | 'vela' | 'table'
export type SuiteGroup = 'work' | 'home'

export interface SuiteApp {
  id: SuiteAppId
  name: string
  tagline: string
  /** 1-3 letters shown on the coloured tile. */
  short: string
  color: string
  /** Canonical URL (custom subdomain). */
  url: string
  /** Vercel default URL, used until DNS for the subdomain is live. */
  legacyUrl: string
  group: SuiteGroup
}

export const SUITE_DOMAIN = 'stillpointcommercial.com'

export const SUITE_APPS: readonly SuiteApp[] = [
  { id: 'cis',   name: 'CIS',             tagline: 'Commercial Intelligence',  short: 'CIS', color: '#2E75B6', url: 'https://cis.stillpointcommercial.com',   legacyUrl: 'https://stillpoint-commercial.vercel.app',      group: 'work' },
  { id: 'sign',  name: 'Document Signer', tagline: 'Sign PDFs in the browser', short: 'DS',  color: '#0F766E', url: 'https://sign.stillpointcommercial.com',  legacyUrl: 'https://stillpoint-document-signer.vercel.app', group: 'work' },
  { id: 'coi',   name: 'COI Calculator',  tagline: 'Cost of inaction',         short: 'COI', color: '#B45309', url: 'https://coi.stillpointcommercial.com',   legacyUrl: 'https://coi-calculator-nine.vercel.app',        group: 'work' },
  { id: 'deals', name: 'Deal Qualifier',  tagline: 'Khalsa qualification',     short: 'DQ',  color: '#6D28D9', url: 'https://deals.stillpointcommercial.com', legacyUrl: 'https://deal-qualifier.vercel.app',             group: 'work' },
  { id: 'vela',  name: 'Vela',            tagline: 'From thought to motion',   short: 'V',   color: '#1F2937', url: 'https://vela.stillpointcommercial.com',  legacyUrl: 'https://vela-app-xi.vercel.app',                group: 'home' },
  { id: 'table', name: 'Round Table',     tagline: 'Where the family eats',    short: 'RT',  color: '#C2410C', url: 'https://table.stillpointcommercial.com', legacyUrl: 'https://family-kitchen-eta.vercel.app',         group: 'home' },
]

export const SUITE_GROUP_LABEL: Record<SuiteGroup, string> = { work: 'Work', home: 'Home' }

/** True when `hostname` is the suite domain or one of its subdomains. */
export function isSuiteHost(hostname: string): boolean {
  return hostname === SUITE_DOMAIN || hostname.endsWith('.' + SUITE_DOMAIN)
}

/** Resolve an app's URL for the origin family the current page lives on. */
export function resolveSuiteUrl(app: SuiteApp, onCustomDomain: boolean): string {
  return onCustomDomain ? app.url : app.legacyUrl
}
