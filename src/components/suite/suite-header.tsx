'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface SuiteUser {
  name: string
  role: 'owner' | 'client'
  initials: string
}

export function SuiteHeader({
  user,
  back = false,
  title,
}: {
  user: SuiteUser
  back?: boolean
  title?: string
}) {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-suite-border bg-suite-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[2400px] items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-suite-slate text-[11px] font-semibold text-white">
              S
            </span>
            <span className="text-sm font-semibold text-suite-ink">
              Stillpoint <span className="font-normal text-suite-ink-3">Suite</span>
            </span>
          </Link>
          {title && <span className="text-sm font-medium text-suite-ink">{title}</span>}
          <div id="suite-header-center" className="flex min-w-0 items-center" />
        </div>

        <div className="flex items-center gap-4">
          <div id="suite-header-actions" className="flex items-center gap-2" />
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-suite-panel text-xs font-semibold text-suite-ink-2">
              {user.initials}
            </span>
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-medium text-suite-ink">{user.name}</div>
              <div className="text-[11px] capitalize text-suite-ink-3">{user.role}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="grid h-8 w-8 place-items-center rounded-md text-suite-ink-3 transition-colors hover:bg-suite-panel hover:text-suite-ink"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
