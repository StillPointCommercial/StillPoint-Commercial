'use client'

// Layout + row-building helpers shared across the BCM section components.
import { type ReactNode } from 'react'
import type { Datum } from './charts'

/** Two-column section: sticky slider rail (~260px) beside outputs. */
export function SectionGrid({
  sliders,
  children,
}: {
  sliders: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <div className="md:sticky md:top-20 md:self-start">
        <div className="rounded-xl border border-suite-border bg-suite-bg p-4">{sliders}</div>
      </div>
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  )
}

export function SectionHeading({ title, n }: { title: string; n: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-suite-slate text-[11px] font-semibold text-white">
        {n}
      </span>
      <h2 className="text-base font-semibold text-suite-ink">{title}</h2>
    </div>
  )
}

export function SliderGroupNote({ children }: { children: ReactNode }) {
  return <p className="mt-3 border-t border-suite-border pt-3 text-[11px] text-suite-ink-3">{children}</p>
}

/** Build year-indexed rows from any number of named numeric arrays. */
export function yearRows(years: number[], cols: Record<string, number[]>): Datum[] {
  return years.map((y, i) => {
    const row: Datum = { year: String(y) }
    for (const key of Object.keys(cols)) row[key] = cols[key][i] ?? 0
    return row
  })
}

/** Build rows indexed by relationship year 1..len from named numeric arrays. */
export function indexRows(len: number, label: string, cols: Record<string, number[]>): Datum[] {
  return Array.from({ length: len }, (_, i) => {
    const row: Datum = { [label]: `Jr ${i + 1}` }
    for (const key of Object.keys(cols)) row[key] = cols[key][i] ?? 0
    return row
  })
}
