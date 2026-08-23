'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, Kanban, Upload, LogOut, Target, Package, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppSwitcher } from '@/components/suite/app-switcher'

const navItems = [
  { href: '/tools/cis', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tools/cis/contacts', label: 'Contacts', icon: Users },
  { href: '/tools/cis/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/tools/cis/offers', label: 'Offers', icon: Package },
  { href: '/tools/cis/year-plan', label: 'Year Plan', icon: Target },
  { href: '/tools/cis/import', label: 'Import', icon: Upload },
]

export function Sidebar({ isOwner = false }: { isOwner?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-64 bg-cream border-r border-border h-screen sticky top-0">
      <div className="p-6 pb-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-text-light hover:text-charcoal transition-colors"
          >
            <ArrowLeft size={14} />
            All tools
          </Link>
          {/* StillPoint Suite app switcher: owner only. */}
          {isOwner && <AppSwitcher current="cis" align="left" iconSize={18} className="-mt-2 -mr-2" />}
        </div>
        <h1 className="font-dm-serif text-2xl text-charcoal">StillPoint</h1>
        <p className="text-text-light text-xs mt-0.5">Commercial Intelligence</p>
      </div>

      <nav className="flex-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/tools/cis'
            ? pathname === '/tools/cis'
            : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-input text-sm font-medium transition-colors mb-1
                ${isActive
                  ? 'bg-sand text-charcoal border-l-[3px] border-terracotta'
                  : 'text-text-light hover:text-charcoal hover:bg-sand-light border-l-[3px] border-transparent'
                }
              `}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-input text-sm text-text-light hover:text-charcoal hover:bg-sand-light w-full transition-colors"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
