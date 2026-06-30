// Canonical <-> source-sheet mapping for the Business Case Model.
//
// The app works on a CANONICAL model and the dashboards render that model. HOW a
// given workbook populates the canonical model lives here as a declarative mapping,
// so a new client is "another mapping config", not a new app:
//   - ADAPTA_MAPPING            : the Adapta "Prognose 2027-2030" workbook (mapping #1)
//   - (future) TEMPLATE_MAPPING : the StillPoint template clients fill in (mapping #0)
//
// On IMPORT we read the input ranges + the read-only computed blocks.
// On EXPORT we write ONLY the input ranges back into the user's COPY; every formula
// in the workbook is preserved and Google recalculates the full P&L.

export interface SheetMapping {
  id: string
  label: string
  /** Editable revenue inputs: read on import, written back into the copy on export. */
  revenueInputs: {
    /** logo rows: instap EUR/klant, growth %/yr, counts per year, start month per year. */
    logos: string
    /** product-mix matrix: category x entity (% of a new logo's revenue). */
    productMix: string
    /** "Blok 2" other new revenue (cross-sell etc.): values per year. */
    crossSell: string
    /** labels (omschrijving / category / entity) for the cross-sell rows. */
    crossSellLabels: string
  }
  /** Computed blocks read to populate the read-only cost & people dashboards. */
  readBlocks: {
    /** Dashboard tab: per-entity + group P&L (revenue, COGS, margin, costs, EBITDA/EBIT, net). */
    dashboard: string
    /** Personeel totals: loonsom + social charges per entity per year. */
    personnelTotals: string
    /** Personeel roster: one row per role (salary, month-ramp, entity split) for FTE/headcount. */
    personnelRoster: string
    /** Scenario tab: Laag / Midden / Hoog target paths. */
    scenarioPaths: string
    /** Marges tab: category -> purchase % (fraction of category revenue that is COGS). */
    margins: string
  }
  /** Tab written with the model-only funnel (leads/suspects/contracts) on export. */
  funnelTab: string
}

export const ADAPTA_MAPPING: SheetMapping = {
  id: 'adapta-v12',
  label: 'Prognose Adapta 2027-2030',
  revenueInputs: {
    logos: 'Groeimotor!B7:K9',
    productMix: 'Groeimotor!B13:D17',
    crossSell: 'Groeimotor!C21:F29',
    crossSellLabels: 'Groeimotor!A21:B29',
  },
  readBlocks: {
    dashboard: 'Dashboard!A4:E49',
    personnelTotals: 'Personeel!A57:I60',
    personnelRoster: 'Personeel!A3:K36',
    scenarioPaths: 'Scenario!A8:F11',
    margins: 'Marges!A3:B17',
  },
  funnelTab: 'Funnel (StillPoint)',
}

/** Mappings the importer knows. Detection (by tab names) chooses one. */
export const MAPPINGS: SheetMapping[] = [ADAPTA_MAPPING]

/** Pick a mapping by inspecting the workbook's tab titles (light fingerprint for now). */
export function detectMapping(sheetTitles: string[]): SheetMapping | null {
  if (sheetTitles.includes('Groeimotor') && sheetTitles.includes('Dashboard')) return ADAPTA_MAPPING
  return null
}
