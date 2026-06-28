// Business Case Model — Excel "Forecast" workbook importer.
// Maps the standard forecast sheet onto a Dataset, falling back to ADAPTA for
// anything missing or unmapped (each fallback adds a non-blocking warning).
import * as XLSX from 'xlsx'
import { ADAPTA } from './seed'
import type { Dataset, ProductKey } from './types'

/** Label fragments (lower-case, "contains") that map a sheet row to a product line. */
const LABEL_MAP: { key: ProductKey; needles: string[] }[] = [
  { key: 'google_lic', needles: ['google werkplek'] },
  { key: 'ms_lic', needles: ['microsoft werkplek'] },
  { key: 'beheer', needles: ['beheer'] },
  { key: 'bereik', needles: ['bereikbaar'] },
  { key: 'omsorg', needles: ['omsorg'] },
  { key: 'ow', needles: ['onafhankelijke werkplek'] },
  { key: 'hw_new', needles: ['hardware nieuwe'] },
  { key: 'hw_repl', needles: ['hardware vervang'] },
  { key: 'proj', needles: ['projecten'] },
  { key: 'puls_hello', needles: ['puls — hello', 'puls hello'] },
  { key: 'puls_dwv', needles: ['puls — dwv', 'dwv'] },
  { key: 'grund', needles: ['grund'] },
]

type Row = (string | number | null | undefined)[]

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
    const n = Number(cleaned)
    if (cleaned !== '' && Number.isFinite(n)) return n
  }
  return null
}

/** The first up-to-5 numeric cells on a row (after the label column). */
function numericCells(row: Row): number[] {
  const out: number[] = []
  for (let i = 1; i < row.length && out.length < 5; i++) {
    const n = toNum(row[i])
    if (n !== null) out.push(n)
  }
  return out
}

function label(row: Row): string {
  return String(row[0] ?? '').toLowerCase().trim()
}

function pad5(arr: number[]): number[] {
  const out = arr.slice(0, 5)
  while (out.length < 5) out.push(0)
  return out
}

export async function parseForecastWorkbook(
  file: File,
): Promise<{ dataset: Dataset; warnings: string[] }> {
  const warnings: string[] = []
  const wb = XLSX.read(await file.arrayBuffer())
  const sheetName = wb.SheetNames.includes('Forecast') ? 'Forecast' : wb.SheetNames[0]
  if (sheetName !== 'Forecast') {
    warnings.push(`Sheet "Forecast" not found — using "${sheetName ?? '(none)'}".`)
  }
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined
  const rows: Row[] = sheet
    ? (XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as Row[])
    : []

  // --- product lines ---
  const productLines = {} as Record<ProductKey, number[]>
  for (const { key, needles } of LABEL_MAP) {
    const match = rows.find((r) => {
      const l = label(r)
      return needles.some((n) => l.includes(n))
    })
    const cells = match ? numericCells(match) : []
    if (cells.length >= 5) {
      productLines[key] = pad5(cells)
    } else {
      productLines[key] = [...ADAPTA.productLines[key]]
      warnings.push(`Row for "${needles[0]}" missing or incomplete — using sample data.`)
    }
  }

  // --- baseline (first numeric on a row containing "baseline") ---
  const baselineRow = rows.find((r) => label(r).includes('baseline'))
  const baselineCells = baselineRow ? numericCells(baselineRow) : []
  let baseline: number
  if (baselineCells.length > 0) {
    baseline = baselineCells[0]
  } else {
    baseline = ADAPTA.baseline
    warnings.push('No "baseline" row found — using sample baseline.')
  }

  // --- motion (derived element-wise from the mapped product lines) ---
  const add = (...keys: ProductKey[]): number[] =>
    productLines.google_lic.map((_, i) => keys.reduce((s, k) => s + productLines[k][i], 0))

  const motion = {
    new_business: add('google_lic', 'ms_lic', 'beheer', 'hw_new', 'proj'),
    cross_up: add('bereik', 'omsorg', 'hw_repl'),
    innov: add('ow', 'puls_hello', 'puls_dwv', 'grund'),
  }

  const dataset: Dataset = {
    name: file.name.replace(/\.[^.]+$/, ''),
    baseline,
    productLines,
    motion,
    logoPatternG: [...ADAPTA.logoPatternG],
    logoPatternMS: [...ADAPTA.logoPatternMS],
    pulsLogos: [...ADAPTA.pulsLogos],
    planHerijkt: {
      laag: [...ADAPTA.planHerijkt.laag],
      mid: [...ADAPTA.planHerijkt.mid],
      hoog: [...ADAPTA.planHerijkt.hoog],
    },
    margins: { ...ADAPTA.margins },
  }

  return { dataset, warnings }
}
