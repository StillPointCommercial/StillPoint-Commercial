// Export the tweaked model back into the user's COPY: overwrite ONLY the revenue
// input cells (every formula is preserved and Google recalculates the full P&L),
// and write the model-only funnel into its own tab. The original is never touched.
// With { copyId }: updates that copy in place. With { sourceId } only: makes a fresh
// copy first ("save as new copy").
import { createClient } from '@/lib/supabase/server'
import { resolveGoogleAccess } from '@/lib/google/token'
import { writeRanges, ensureSheetTab } from '@/lib/google/sheets'
import { copyFile, shareFile } from '@/lib/google/drive'
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
    const access = await resolveGoogleAccess()
    if (!access) return Response.json({ error: 'no_google_token' }, { status: 400 })
    const token = access.token
    if (!body.inputs) return Response.json({ error: 'bad_request' }, { status: 400 })

    const mapping = MAPPINGS.find((m) => m.id === body.mappingId) ?? MAPPINGS[0]

    // Resolve the target copy: reuse an existing one, or create a fresh copy from source.
    let copyId = body.copyId
    let copyUrl = copyId ? `https://docs.google.com/spreadsheets/d/${copyId}/edit` : ''
    let shareWarning: string | undefined
    if (!copyId) {
      if (!body.sourceId) return Response.json({ error: 'no_target' }, { status: 400 })
      const copy = await copyFile(token, body.sourceId, body.name ?? 'StillPoint: Business Case')
      copyId = copy.id
      copyUrl = copy.url
      // A copy minted by the service account lives in the SA's Drive; share it with
      // the signed-in user so they can open and edit it manually in their browser.
      if (access.via === 'service-account') {
        try {
          const supabase = await createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (user?.email) await shareFile(token, copyId, user.email, 'writer')
        } catch (err) {
          shareWarning = `Sheet copy created, but sharing it with you failed: ${
            err instanceof Error ? err.message : 'unknown error'
          }`
          console.error('[bcm/export] share failed:', err)
        }
      }
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

    return Response.json({ copyId, url: copyUrl, ...(shareWarning ? { shareWarning } : {}) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
