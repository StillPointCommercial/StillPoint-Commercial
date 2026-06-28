'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Requested at sign-in so the Business Case Model can read/write Google Sheets.
const GOOGLE_SCOPES =
  'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [emailMode, setEmailMode] = useState(false)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('error')
    if (e === 'not_invited' || e === 'no_access') {
      setError(
        "We couldn't find access for that account. Your organization may not be set up on this platform yet, or your email isn't on the invite list. Contact StillPoint to get access.",
      )
    } else if (e === 'auth') {
      setError('Sign-in failed. Please try again.')
    }
  }, [])

  async function signInWithGoogle() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: GOOGLE_SCOPES,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  async function sendEmailLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-suite-bg p-4 font-suite text-suite-ink">
      <div className="w-full max-w-sm rounded-xl border border-suite-border bg-suite-bg p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-9 w-9 place-items-center rounded-lg bg-suite-slate text-sm font-semibold text-white">
            S
          </div>
          <h1 className="text-xl font-semibold text-suite-ink">Stillpoint Suite</h1>
          <p className="mt-1 text-sm text-suite-ink-3">Sign in to your tools</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-suite-neg/30 bg-suite-neg-bg px-3 py-2 text-xs text-suite-neg">
            {error}
          </div>
        )}

        {sent ? (
          <div className="text-center text-sm text-suite-ink-2">
            Check your email for a sign-in link sent to{' '}
            <strong className="text-suite-ink">{email}</strong>.
          </div>
        ) : emailMode ? (
          <form onSubmit={sendEmailLink} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border border-suite-border bg-suite-bg px-3 py-2 text-sm text-suite-ink outline-none focus:border-suite-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-suite-slate px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-suite-ink disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send sign-in link'}
            </button>
            <button
              type="button"
              onClick={() => setEmailMode(false)}
              className="w-full text-center text-xs text-suite-ink-3 hover:text-suite-ink"
            >
              Back to Google sign-in
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <button
              onClick={signInWithGoogle}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-suite-border bg-suite-bg px-4 py-2.5 text-sm font-medium text-suite-ink transition-colors hover:bg-suite-subtle disabled:opacity-50"
            >
              <GoogleIcon />
              {loading ? 'Redirecting…' : 'Continue with Google'}
            </button>
            <button
              type="button"
              onClick={() => setEmailMode(true)}
              className="w-full text-center text-xs text-suite-ink-3 hover:text-suite-ink"
            >
              Use an email link instead
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-[11px] text-suite-ink-3">
          Access is by company domain or invitation.
        </p>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.9 0 6.6 1.7 8.1 3.1l5.9-5.8C34.6 3.3 29.8 1 24 1 14.6 1 6.5 6.4 2.6 14.3l6.9 5.4C11.4 13.9 17.1 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4.1H24v7.4h12.7c-.3 2.1-1.6 5.2-4.7 7.3l7 5.4c4.2-3.9 6.5-9.6 6.5-16z" />
      <path fill="#FBBC05" d="M9.5 28.3c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-6.9-5.4C1 16.3 0 20 0 24s1 7.7 2.6 10.7l6.9-5.4z" />
      <path fill="#34A853" d="M24 47c6.5 0 11.9-2.1 15.9-5.8l-7-5.4c-1.9 1.3-4.5 2.2-8.9 2.2-6.9 0-12.6-4.4-14.5-10.6l-6.9 5.4C6.5 41.6 14.6 47 24 47z" />
    </svg>
  )
}
