import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const session = data.session
      const user = data.user ?? session?.user ?? null
      if (user) {
        // Gate: the on-signup trigger only provisions a profile for an authorized
        // account (owner, a known company domain, or an invited email). No profile
        // means the account is not authorized for this platform.
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()
        if (!profile) {
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/login?error=not_invited`)
        }

        // Persist the Google refresh token so server routes can call Sheets/Drive.
        if (session?.provider_token || session?.provider_refresh_token) {
          const patch: {
            user_id: string
            updated_at: string
            access_token?: string
            expires_at?: string
            refresh_token?: string
          } = { user_id: user.id, updated_at: new Date().toISOString() }
          if (session.provider_token) {
            patch.access_token = session.provider_token
            patch.expires_at = new Date(Date.now() + 3500 * 1000).toISOString()
          }
          if (session.provider_refresh_token) patch.refresh_token = session.provider_refresh_token
          await supabase.from('google_tokens').upsert(patch)
        }
      }
      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
