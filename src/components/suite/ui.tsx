'use client'

import { type ReactNode } from 'react'

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ')
}

export function Panel({
  title,
  subtitle,
  right,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <section className={cx('rounded-xl border border-suite-border bg-suite-bg', className)}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 border-b border-suite-border px-5 py-3.5">
          <div>
            {title && <h3 className="text-sm font-semibold text-suite-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-suite-ink-3">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      <div className={cx('p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: ReactNode
  sub?: string
  accent?: boolean
}) {
  return (
    <div className="bg-suite-bg px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-suite-ink-3">{label}</div>
      <div className={cx('mt-1 text-2xl font-semibold tabular-nums', accent ? 'text-suite-accent' : 'text-suite-ink')}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-suite-ink-3">{sub}</div>}
    </div>
  )
}

export function KpiStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-suite-border bg-suite-border sm:grid-cols-3 lg:grid-cols-5">
      {children}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs text-suite-ink-2">{label}</label>
        <span className="text-xs font-semibold tabular-nums text-suite-ink">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-suite-panel accent-suite-accent"
      />
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-suite-border bg-suite-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            value === o.value ? 'bg-suite-bg text-suite-ink shadow-sm' : 'text-suite-ink-3 hover:text-suite-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-suite-accent' : 'bg-suite-neutral',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      <span
        className={cx(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'dark' }) {
  const tones = {
    neutral: 'bg-suite-subtle text-suite-ink-2',
    accent: 'bg-suite-accent-tint text-suite-accent-dark',
    dark: 'bg-suite-slate text-white',
  }
  return <span className={cx('rounded-full px-2.5 py-1 text-[11px] font-medium', tones[tone])}>{children}</span>
}

// Shared table styling (tabular numerals, hairline rows).
export const tbl = {
  table: 'w-full text-sm',
  th: 'px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-suite-ink-3',
  thR: 'px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-suite-ink-3',
  td: 'px-3 py-2 text-suite-ink',
  tdR: 'px-3 py-2 text-right tabular-nums text-suite-ink',
  tdMuted: 'px-3 py-2 text-suite-ink-2',
  tr: 'border-t border-suite-border',
  trHighlight: 'border-t border-suite-border bg-suite-subtle',
}

export function pos(n: number): string {
  return n >= 0 ? 'text-suite-pos' : 'text-suite-neg'
}
