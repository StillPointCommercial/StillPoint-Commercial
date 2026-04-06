'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Invisible component that keeps the Supabase session alive.
 *
 * - Listens for auth state changes (SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT)
 * - On TOKEN_REFRESHED the middleware will pick up new cookies automatically
 * - On SIGNED_OUT redirects to /login
 * - Periodically refreshes the session to prevent expiry
 */
export function SessionRefresh() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }
      if (event === 'TOKEN_REFRESHED') {
        // Session was refreshed — router.refresh() ensures server components
        // re-render with the new cookies
        router.refresh()
      }
    })

    // Proactively refresh the session every 10 minutes to keep it alive.
    // The Supabase client auto-refreshes when the access token is close to
    // expiry, but this interval acts as a safety net for long-idle tabs.
    const interval = setInterval(async () => {
      const { data, error } = await supabase.auth.getSession()
      if (data.session) {
        // If the access token will expire in the next 5 minutes, refresh it
        const expiresAt = data.session.expires_at ?? 0
        const now = Math.floor(Date.now() / 1000)
        if (expiresAt - now < 300) {
          await supabase.auth.refreshSession()
        }
      }
    }, 10 * 60 * 1000) // every 10 minutes

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
    }
  }, [router])

  return null
}
