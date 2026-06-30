// Google Drive v3 helpers (SERVER-ONLY, never import from a 'use client' file).
// Used to make a NATIVE copy of a shared Google Sheet so the original is never
// touched and the copy keeps every formula, format and chart intact.
// Authenticate with a Bearer access token from getGoogleAccessToken().

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'

async function driveError(res: Response): Promise<string> {
  let detail = ''
  try {
    const body = (await res.json()) as { error?: { message?: string; status?: string } }
    detail = body?.error ? `${body.error.message ?? ''} [${body.error.status ?? ''}]` : JSON.stringify(body)
  } catch {
    detail = await res.text().catch(() => '')
  }
  const msg = `Google Drive API ${res.status}: ${detail}`.slice(0, 400)
  console.error('[google/drive]', msg)
  return msg
}

export interface CopiedFile {
  id: string
  url: string
}

/**
 * Make a native copy of a Drive file (e.g. a Google Sheet). The source is only read,
 * never modified. The copy lands in the authenticated user's Drive.
 */
export async function copyFile(
  accessToken: string,
  fileId: string,
  newName: string,
): Promise<CopiedFile> {
  const res = await fetch(
    `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}/copy?fields=id&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newName }),
    },
  )
  if (!res.ok) throw new Error(await driveError(res))
  const json = (await res.json()) as { id?: string }
  if (!json.id) throw new Error('Google Drive did not return a copied file id.')
  return { id: json.id, url: `https://docs.google.com/spreadsheets/d/${json.id}/edit` }
}
