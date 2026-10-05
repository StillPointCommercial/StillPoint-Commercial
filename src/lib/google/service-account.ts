// Service-account auth for Google Sheets/Drive (SERVER-ONLY).
// When the service account is configured (GOOGLE_SA_KEY_JSON, or GOOGLE_SA_EMAIL +
// GOOGLE_SA_PRIVATE_KEY), ALL Sheets/Drive
// traffic runs as the StillPoint service account instead of per-user OAuth tokens.
// Client users then never need Drive scopes at sign-in, which keeps the suite
// working inside customer workspaces that block third-party app access (e.g.
// Adapta). The flow: a source sheet is shared with the SA address once (Viewer is
// enough); scenario copies are owned by the SA and shared back to the user so
// they can open and edit them manually in their own browser (first-party Google,
// outside any third-party restriction).
import { createSign } from 'node:crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SA_SCOPES =
  'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive'

let cached: { token: string; expiresAt: number } | null = null

interface SaCreds {
  email: string
  key: string
}

/**
 * Credentials come from GOOGLE_SA_KEY_JSON (the whole downloaded key file, pasted
 * as-is: the easiest and least error-prone setup) or, as a fallback, from the pair
 * GOOGLE_SA_EMAIL + GOOGLE_SA_PRIVATE_KEY.
 */
function readCreds(): SaCreds | null {
  const json = process.env.GOOGLE_SA_KEY_JSON?.trim()
  if (json) {
    try {
      const parsed = JSON.parse(json) as { client_email?: string; private_key?: string }
      if (parsed.client_email && parsed.private_key) {
        return { email: parsed.client_email, key: parsed.private_key }
      }
      console.error('[google/sa] GOOGLE_SA_KEY_JSON lacks client_email or private_key')
    } catch {
      console.error('[google/sa] GOOGLE_SA_KEY_JSON is not valid JSON')
    }
  }
  const email = process.env.GOOGLE_SA_EMAIL?.trim()
  const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY?.trim()
  if (email && rawKey) {
    // Tolerate a value pasted with its JSON quotes and with literal \n sequences.
    return { email, key: rawKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n') }
  }
  return null
}

export function serviceAccountEmail(): string | null {
  return readCreds()?.email ?? null
}

export function serviceAccountConfigured(): boolean {
  return readCreds() !== null
}

const b64url = (s: string): string => Buffer.from(s).toString('base64url')

/**
 * Mint (and cache) an access token for the service account via a signed JWT.
 * Returns null when the SA env vars are absent or the exchange fails, so callers
 * can fall back to the legacy per-user OAuth token.
 */
export async function getServiceAccountToken(): Promise<string | null> {
  const creds = readCreds()
  if (!creds) return null
  if (cached && cached.expiresAt > Date.now() + 120_000) return cached.token

  try {
    const { email, key } = creds
    const iat = Math.floor(Date.now() / 1000)
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claims = b64url(
      JSON.stringify({ iss: email, scope: SA_SCOPES, aud: TOKEN_URL, iat, exp: iat + 3600 }),
    )
    const signer = createSign('RSA-SHA256')
    signer.update(`${header}.${claims}`)
    const signature = signer.sign(key).toString('base64url')

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${header}.${claims}.${signature}`,
      }),
    })
    if (!res.ok) {
      console.error('[google/sa] token exchange failed:', res.status, (await res.text()).slice(0, 300))
      return null
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!json.access_token) return null
    cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 }
    return cached.token
  } catch (err) {
    console.error('[google/sa] token mint failed:', err instanceof Error ? err.message : err)
    return null
  }
}
