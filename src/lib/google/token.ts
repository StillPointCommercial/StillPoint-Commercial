import { createClient } from '@/lib/supabase/server'

/**
 * Returns a valid Google access token for the current user, refreshing it via
 * the stored refresh token when the cached one is missing or about to expire.
 * Returns null if the user has no Google token (e.g. signed in by email link).
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: row } = await supabase
    .from('google_tokens')
    .select('refresh_token, access_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!row) return null

  const valid =
    row.access_token && row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 60_000
  if (valid) return row.access_token as string

  if (!row.refresh_token) return (row.access_token as string | null) ?? null

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return (row.access_token as string | null) ?? null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token as string,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return (row.access_token as string | null) ?? null

  const json = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!json.access_token) return (row.access_token as string | null) ?? null

  await supabase
    .from('google_tokens')
    .update({
      access_token: json.access_token,
      expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  return json.access_token
}
