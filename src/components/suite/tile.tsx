import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'

export function Tile({
  href,
  name,
  description,
  icon: Icon,
  badge,
}: {
  href: string
  name: string
  description: string
  icon: LucideIcon
  badge?: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-suite-border bg-suite-bg p-5 transition-all hover:-translate-y-0.5 hover:border-suite-accent-light hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]"
    >
      <div className="flex items-start justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-suite-panel text-suite-slate">
          <Icon size={22} />
        </span>
        {badge && (
          <span className="rounded-full bg-suite-subtle px-2.5 py-1 text-[11px] font-medium text-suite-ink-2">
            {badge}
          </span>
        )}
      </div>
      <h3 className="mt-4 text-base font-semibold text-suite-ink">{name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-suite-ink-2">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-suite-accent">
        Open
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
