// Cheap change detection for the sheet -> app direction of the workbook round-trip:
// report a workbook file's Drive modifiedTime. The studio polls this while a workbook
// is open and pulls a fresh read when the Sheet was edited in Google directly.
import { resolveGoogleAccess } from '@/lib/google/token'
import { getFileModifiedTime } from '@/lib/google/drive'

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { fileId?: string }
    if (!body.fileId) return Response.json({ error: 'bad_request' }, { status: 400 })
    const access = await resolveGoogleAccess()
    if (!access) return Response.json({ error: 'no_google_token' }, { status: 400 })
    return Response.json({ modifiedTime: await getFileModifiedTime(access.token, body.fileId) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Status check failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
