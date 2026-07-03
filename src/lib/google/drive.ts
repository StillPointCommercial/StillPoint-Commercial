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
 * never modified. The copy is placed in the user's My Drive root (parents: ['root'])
 * so it is theirs to find and delete, instead of inheriting the source's parent folder
 * (which is often a shared folder the user does not own and cannot tidy up).
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
      body: JSON.stringify({ name: newName, parents: ['root'] }),
    },
  )
  if (!res.ok) throw new Error(await driveError(res))
  const json = (await res.json()) as { id?: string }
  if (!json.id) throw new Error('Google Drive did not return a copied file id.')
  return { id: json.id, url: `https://docs.google.com/spreadsheets/d/${json.id}/edit` }
}

/**
 * Read a file's Drive modifiedTime (RFC 3339 string). Cheap change detection for the
 * sheet -> app direction of the workbook round-trip: the studio polls this and pulls
 * a fresh read when the Sheet was edited in Google directly.
 */
export async function getFileModifiedTime(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(
    `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}?fields=modifiedTime&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) throw new Error(await driveError(res))
  const json = (await res.json()) as { modifiedTime?: string }
  if (!json.modifiedTime) throw new Error('Google Drive did not return a modifiedTime.')
  return json.modifiedTime
}
