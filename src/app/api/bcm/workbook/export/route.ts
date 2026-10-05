// Export the tweaked model back into the user's COPY: overwrite ONLY the revenue
// input cells (every formula is preserved and Google recalculates the full P&L),
// and write the model-only funnel into its own tab. The original is never touched.
// With { copyId }: updates that copy in place. With { sourceId } only: makes a fresh
// copy first ("save as new copy"). With both: updates the copy, and in service-account
// mode re-mints from the source when the copy is invisible to the SA (self-heal).
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
    const inputs = body.inputs

    const mapping = MAPPINGS.find((m) => m.id === body.mappingId) ?? MAPPINGS[0]
    let shareWarning: string | undefined

    // Fresh copy from the source. A copy minted by the service account lives in the
    // SA's Drive; share it with the signed-in user so they can open and edit it
    // manually in their own browser.
    async function mintCopy(sourceId: string): Promise<{ id: string; url: string }> {
      const copy = await copyFile(token, sourceId, body.name ?? 'StillPoint: Business Case')
      if (access?.via === 'service-account') {
        try {
          const supabase = await createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (user?.email) await shareFile(token, copy.id, user.email, 'writer')
        } catch (err) {
          shareWarning = `Sheet copy created, but sharing it with you failed: ${
            err instanceof Error ? err.message : 'unknown error'
          }`
          console.error('[bcm/export] share failed:', err)
        }
      }
      return copy
    }

    async function writeModel(id: string): Promise<void> {
      const writes = serializeWorkbookInputs(inputs, {
        logos: mapping.revenueInputs.logos,
        productMix: mapping.revenueInputs.productMix,
        crossSell: mapping.revenueInputs.crossSell,
      })
      await writeRanges(token, id, writes)
      if (body.funnelRows && body.funnelRows.length) {
        await ensureSheetTab(token, id, mapping.funnelTab)
        await writeRanges(token, id, [{ range: `'${mapping.funnelTab}'!A1`, values: body.funnelRows }])
      }
    }

    let copyId: string
    let copyUrl: string
    if (!body.copyId) {
      if (!body.sourceId) return Response.json({ error: 'no_target' }, { status: 400 })
      const copy = await mintCopy(body.sourceId)
      copyId = copy.id
      copyUrl = copy.url
      await writeModel(copyId)
    } else {
      copyId = body.copyId
      copyUrl = `https://docs.google.com/spreadsheets/d/${copyId}/edit`
      try {
        await writeModel(copyId)
      } catch (err) {
        // A copy created earlier in a user's own Drive (legacy OAuth flow) is invisible
        // to the service account. Re-mint an SA-owned copy from the source so the
        // scenario heals itself instead of failing on every save.
        const msg = err instanceof Error ? err.message : ''
        if (access.via === 'service-account' && body.sourceId && /\b40[34]\b/.test(msg)) {
          const copy = await mintCopy(body.sourceId)
          copyId = copy.id
          copyUrl = copy.url
          await writeModel(copyId)
        } else {
          throw err
        }
      }
    }

    return Response.json({ copyId, url: copyUrl, ...(shareWarning ? { shareWarning } : {}) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
