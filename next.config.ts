import type { NextConfig } from 'next'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// ---------------------------------------------------------------------------
// DEV WORKAROUND: Force-load server-side env vars from .env.local
// ---------------------------------------------------------------------------
// When running inside Claude Code (or similar AI-assisted dev tools), the
// shell environment may contain EMPTY values for keys like ANTHROPIC_API_KEY.
// Next.js respects existing env vars and will NOT override them from
// .env.local, so the app ends up with blank credentials.
//
// This block reads .env.local manually and fills in any server-side env var
// that is currently empty or missing. It deliberately skips NEXT_PUBLIC_*
// vars since those are handled by Next.js's built-in client env pipeline.
//
// This is only relevant during LOCAL DEVELOPMENT. In production (e.g. Vercel),
// env vars are set through the dashboard and this block is a harmless no-op.
// ---------------------------------------------------------------------------
const envLocalPath = join(process.cwd(), '.env.local')
if (existsSync(envLocalPath)) {
  const envContent = readFileSync(envLocalPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    // Skip comments and blank lines
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()

    // Only override server-side vars that are empty or undefined
    if (!key.startsWith('NEXT_PUBLIC_') && (!process.env[key] || process.env[key] === '')) {
      process.env[key] = value
    }
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
