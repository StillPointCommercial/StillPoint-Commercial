import { getGoogleAccessToken } from '@/lib/google/token'
import {
  extractSpreadsheetId,
  getSpreadsheetMeta,
  readSheetValues,
} from '@/lib/google/sheets'
import { rowsToDataset } from '@/lib/bcm/sheet-map'

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { url?: string }
    const url = body?.url

    const token = await getGoogleAccessToken()
    if (!token) return Response.json({ error: 'no_google_token' }, { status: 400 })

    const id = extractSpreadsheetId(url ?? '')
    if (!id) return Response.json({ error: 'bad_url' }, { status: 400 })

    const meta = await getSpreadsheetMeta(token, id)
    const tab =
      meta.sheetTitles.find((t) => t.toLowerCase() === 'forecast') ??
      meta.sheetTitles[0]
    if (!tab) return Response.json({ error: 'no_tabs' }, { status: 400 })

    const rows = await readSheetValues(token, id, `'${tab}'!A1:Z80`)
    const { dataset, warnings } = rowsToDataset(rows)

    return Response.json({ dataset, warnings, name: meta.title })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
