'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Kanban, Target, LayoutGrid } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Tools', icon: LayoutGrid },
  { href: '/tools/cis', label: 'Home', icon: LayoutDashboard },
  { href: '/tools/cis/contacts', label: 'Contacts', icon: Users },
  { href: '/tools/cis/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/tools/cis/year-plan', label: 'Plan', icon: Target },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-cream border-t border-border z-50 safe-area-pb">
      <div className="flex justify-around py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' || href === '/tools/cis'
            ? pathname === href
            : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={`
                flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors
                ${isActive ? 'text-terracotta font-medium' : 'text-text-light'}
              `}
            >
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
