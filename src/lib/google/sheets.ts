// Google Sheets v4 REST helpers (SERVER-ONLY, never import from a 'use client' file).
// All requests authenticate with a Bearer access token obtained via getGoogleAccessToken().

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

/** Pull the spreadsheet id out of a Sheets URL, or accept a bare id. */
export function extractSpreadsheetId(url: string): string | null {
  const trimmed = (url ?? '').trim()
  if (!trimmed) return null
  const m = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/)
  if (m) return m[1]
  // Already looks like a bare id (no slashes / spaces).
  if (/^[a-zA-Z0-9-_]+$/.test(trimmed)) return trimmed
  return null
}

/** Read the Google API error message from a non-ok response body (best effort). */
async function googleError(res: Response): Promise<string> {
  let detail = ''
  try {
    const body = (await res.json()) as { error?: { message?: string; status?: string } }
    detail = body?.error ? `${body.error.message ?? ''} [${body.error.status ?? ''}]` : JSON.stringify(body)
  } catch {
    detail = await res.text().catch(() => '')
  }
  const msg = `Google Sheets API ${res.status}: ${detail}`.slice(0, 400)
  console.error('[google/sheets]', msg)
  return msg
}

export interface SpreadsheetMeta {
  title: string
  sheetTitles: string[]
}

export async function getSpreadsheetMeta(
  accessToken: string,
  spreadsheetId: string,
): Promise<SpreadsheetMeta> {
  const res = await fetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties.title`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  )
  if (!res.ok) throw new Error(await googleError(res))
  const json = (await res.json()) as {
    properties?: { title?: string }
    sheets?: { properties?: { title?: string } }[]
  }
  const title = json.properties?.title ?? 'Untitled'
  const sheetTitles = (json.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => typeof t === 'string')
  return { title, sheetTitles }
}

export async function readSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const res = await fetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
      range,
    )}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  )
  if (!res.ok) throw new Error(await googleError(res))
  const json = (await res.json()) as { values?: (string | number | boolean)[][] }
  return (json.values ?? []).map((row) => row.map((c) => (c == null ? '' : String(c))))
}

export interface SheetTab {
  title: string
  rows: (string | number)[][]
}

export interface CreatedSpreadsheet {
  spreadsheetId: string
  url: string
}

export async function createSpreadsheet(
  accessToken: string,
  title: string,
  tabs: SheetTab[],
): Promise<CreatedSpreadsheet> {
  const createRes = await fetch(SHEETS_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: tabs.map((t) => ({ properties: { title: t.title } })),
    }),
  })
  if (!createRes.ok) throw new Error(await googleError(createRes))
  const created = (await createRes.json()) as { spreadsheetId?: string }
  const spreadsheetId = created.spreadsheetId
  if (!spreadsheetId) throw new Error('Google Sheets API did not return a spreadsheet id.')

  const updateRes = await fetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: tabs.map((t) => ({ range: `'${t.title}'!A1`, values: t.rows })),
      }),
    },
  )
  if (!updateRes.ok) throw new Error(await googleError(updateRes))

  return {
    spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  }
}

/** Read several ranges at once. Returns a map keyed by the requested range string. */
export async function readRanges(
  accessToken: string,
  spreadsheetId: string,
  ranges: string[],
): Promise<Record<string, string[][]>> {
  if (ranges.length === 0) return {}
  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&')
  const res = await fetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchGet?${qs}&majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
    {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    },
  )
  if (!res.ok) throw new Error(await googleError(res))
  // UNFORMATTED_VALUE so numbers arrive as raw numbers (300000), not locale-formatted
  // strings like "300.000" that a "."-as-decimal parser would misread as 300.
  const json = (await res.json()) as { valueRanges?: { values?: (string | number | boolean)[][] }[] }
  const out: Record<string, string[][]> = {}
  ;(json.valueRanges ?? []).forEach((vr, i) => {
    out[ranges[i]] = (vr.values ?? []).map((row) => row.map((c) => (c == null ? '' : String(c))))
  })
  return out
}

/**
 * Write values into specific ranges of an EXISTING spreadsheet. Only the given
 * (input) cells change; every formula elsewhere is left untouched and Google
 * recalculates the whole model. USER_ENTERED so "=..." strings stay formulas.
 */
export async function writeRanges(
  accessToken: string,
  spreadsheetId: string,
  data: { range: string; values: (string | number)[][] }[],
): Promise<void> {
  if (data.length === 0) return
  const res = await fetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
    },
  )
  if (!res.ok) throw new Error(await googleError(res))
}

/** Add a tab to an existing spreadsheet if it is not already present (e.g. the Funnel tab). */
export async function ensureSheetTab(
  accessToken: string,
  spreadsheetId: string,
  title: string,
): Promise<void> {
  const meta = await getSpreadsheetMeta(accessToken, spreadsheetId)
  if (meta.sheetTitles.includes(title)) return
  const res = await fetch(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    },
  )
  if (!res.ok) throw new Error(await googleError(res))
}
