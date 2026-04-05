'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-warm-white p-4">
      <div className="w-full max-w-sm rounded-card bg-cream border border-border p-8">
        <h1 className="font-dm-serif text-3xl text-charcoal text-center mb-2">
          StillPoint
        </h1>
        <p className="text-text-light text-center text-sm mb-8">
          Commercial Intelligence System
        </p>

        {sent ? (
          <div className="text-center">
            <p className="text-text mb-2">Check your email</p>
            <p className="text-text-light text-sm">
              We sent a magic link to <strong className="text-charcoal">{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-charcoal-light mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="wouter@stillpoint.com"
                required
                className="w-full rounded-input border border-border bg-warm-white px-3 py-2 text-text placeholder:text-warm-gray focus-ring"
              />
            </div>

            {error && (
              <p className="text-attention-red text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-input bg-terracotta text-warm-white py-2 px-4 font-medium hover:bg-terracotta-muted transition-colors disabled:opacity-50 focus-ring"
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
