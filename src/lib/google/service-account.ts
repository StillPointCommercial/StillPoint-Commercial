// Service-account auth for Google Sheets/Drive (SERVER-ONLY).
// When GOOGLE_SA_EMAIL + GOOGLE_SA_PRIVATE_KEY are configured, ALL Sheets/Drive
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

export function serviceAccountEmail(): string | null {
  return process.env.GOOGLE_SA_EMAIL?.trim() || null
}

export function serviceAccountConfigured(): boolean {
  return Boolean(serviceAccountEmail() && process.env.GOOGLE_SA_PRIVATE_KEY)
}

const b64url = (s: string): string => Buffer.from(s).toString('base64url')

/**
 * Mint (and cache) an access token for the service account via a signed JWT.
 * Returns null when the SA env vars are absent or the exchange fails, so callers
 * can fall back to the legacy per-user OAuth token.
 */
export async function getServiceAccountToken(): Promise<string | null> {
  const email = serviceAccountEmail()
  const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY
  if (!email || !rawKey) return null
  if (cached && cached.expiresAt > Date.now() + 120_000) return cached.token

  try {
    // Vercel env vars often store the key with literal \n sequences.
    const key = rawKey.replace(/\\n/g, '\n')
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
