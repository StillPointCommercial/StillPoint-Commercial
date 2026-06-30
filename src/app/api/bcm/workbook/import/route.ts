// Import a Google Sheet workbook (e.g. Adapta "Prognose 2027-2030") for the round-trip.
// READS only, it does not copy. A copy is created per saved scenario (via the export
// route), so importing to preview never clutters Drive.
//   { url }    -> read the shared SOURCE, returns sourceId
//   { copyId } -> re-read an existing scenario copy (refresh), returns copyId
// Returns parsed revenue inputs, the computed revenue, and the read-only cost/people blocks.
import { getGoogleAccessToken } from '@/lib/google/token'
import { extractSpreadsheetId, getSpreadsheetMeta, readRanges } from '@/lib/google/sheets'
import { detectMapping } from '@/lib/bcm/mapping'
import { parseWorkbookInputs, computeWorkbookRevenue } from '@/lib/bcm/workbook'

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { url?: string; copyId?: string }
    const token = await getGoogleAccessToken()
    if (!token) return Response.json({ error: 'no_google_token' }, { status: 400 })

    let id: string
    let sourceId: string | null = null
    let copyId: string | null = null
    if (body.copyId) {
      id = body.copyId
      copyId = body.copyId
    } else {
      const srcId = extractSpreadsheetId(body.url ?? '')
      if (!srcId) return Response.json({ error: 'bad_url' }, { status: 400 })
      id = srcId
      sourceId = srcId
    }

    const meta = await getSpreadsheetMeta(token, id)
    const mapping = detectMapping(meta.sheetTitles)
    if (!mapping) {
      return Response.json({ error: 'unrecognized_workbook', sheetTitles: meta.sheetTitles }, { status: 400 })
    }

    const ri = mapping.revenueInputs
    const rb = mapping.readBlocks
    const wanted = [
      ri.logos,
      ri.productMix,
      ri.crossSell,
      ri.crossSellLabels,
      rb.dashboard,
      rb.personnelTotals,
      rb.personnelRoster,
      rb.indirecte,
      rb.scenarioPaths,
      rb.margins,
    ]
    const got = await readRanges(token, id, wanted)

    const inputs = parseWorkbookInputs({
      logos: got[ri.logos] ?? [],
      mix: got[ri.productMix] ?? [],
      crossSell: got[ri.crossSell] ?? [],
      crossSellLabels: got[ri.crossSellLabels] ?? [],
    })
    const revenue = computeWorkbookRevenue(inputs)

    return Response.json({
      sourceId,
      copyId,
      copyUrl: copyId ? `https://docs.google.com/spreadsheets/d/${copyId}/edit` : '',
      title: meta.title,
      mappingId: mapping.id,
      inputs,
      revenue,
      blocks: {
        dashboard: got[rb.dashboard] ?? [],
        personnelTotals: got[rb.personnelTotals] ?? [],
        personnelRoster: got[rb.personnelRoster] ?? [],
        indirecte: got[rb.indirecte] ?? [],
        scenarioPaths: got[rb.scenarioPaths] ?? [],
        margins: got[rb.margins] ?? [],
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
