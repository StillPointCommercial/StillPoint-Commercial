// Export the tweaked model back into the user's COPY: overwrite ONLY the revenue
// input cells (every formula is preserved and Google recalculates the full P&L),
// and write the model-only funnel into its own tab. The original is never touched.
// With { copyId }: updates that copy in place. With { sourceId } only: makes a fresh
// copy first ("save as new copy").
import { getGoogleAccessToken } from '@/lib/google/token'
import { writeRanges, ensureSheetTab } from '@/lib/google/sheets'
import { copyFile } from '@/lib/google/drive'
import { MAPPINGS } from '@/lib/bcm/mapping'
import { serializeWorkbookInputs, type WorkbookInputs } from '@/lib/bcm/workbook'

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      copyId?: string
      sourceId?: string
      name?: string
      mappingId?: string
      inputs?: WorkbookInputs
      funnelRows?: (string | number)[][]
    }
    const token = await getGoogleAccessToken()
    if (!token) return Response.json({ error: 'no_google_token' }, { status: 400 })
    if (!body.inputs) return Response.json({ error: 'bad_request' }, { status: 400 })

    const mapping = MAPPINGS.find((m) => m.id === body.mappingId) ?? MAPPINGS[0]

    // Resolve the target copy: reuse an existing one, or create a fresh copy from source.
    let copyId = body.copyId
    let copyUrl = copyId ? `https://docs.google.com/spreadsheets/d/${copyId}/edit` : ''
    if (!copyId) {
      if (!body.sourceId) return Response.json({ error: 'no_target' }, { status: 400 })
      const copy = await copyFile(token, body.sourceId, body.name ?? 'StillPoint — Business Case')
      copyId = copy.id
      copyUrl = copy.url
    }

    const writes = serializeWorkbookInputs(body.inputs, {
      logos: mapping.revenueInputs.logos,
      productMix: mapping.revenueInputs.productMix,
      crossSell: mapping.revenueInputs.crossSell,
    })
    await writeRanges(token, copyId, writes)

    if (body.funnelRows && body.funnelRows.length) {
      await ensureSheetTab(token, copyId, mapping.funnelTab)
      await writeRanges(token, copyId, [{ range: `'${mapping.funnelTab}'!A1`, values: body.funnelRows }])
    }

    return Response.json({ copyId, url: copyUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
