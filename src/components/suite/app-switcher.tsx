'use client'

/**
 * StillPoint Suite - App Switcher (the "waffle" menu).
 *
 * ONE canonical component, copied verbatim into every StillPoint app together
 * with ./suite-apps.ts (the registry). Source of truth for the app list and the
 * subdomain map: ~/.claude/PROJECTS.md, section "StillPoint Suite".
 *
 * Copies (identical apart from the 'use client' first line in Next.js apps):
 *   CIS             src/components/suite/app-switcher.tsx   (Next.js, 'use client')
 *   Round Table     src/components/suite/app-switcher.tsx   (Next.js, 'use client')
 *   Document Signer src/components/suite/AppSwitcher.tsx    (Vite)
 *   COI Calculator  src/components/suite/AppSwitcher.tsx    (Vite)
 *   Deal Qualifier  src/components/suite/AppSwitcher.tsx    (Vite)
 *   Vela            src/components/suite/AppSwitcher.tsx    (Vite)
 *
 * Zero dependencies (no Tailwind classes, no icon library) so it renders the
 * same in Tailwind v3, v4 and shadcn apps. Theme it per app with optional CSS
 * variables on any ancestor (all have sane light defaults):
 *   --sp-switcher-fg          icon colour (idle)
 *   --sp-switcher-fg-strong   text + icon colour (active / in popover)
 *   --sp-switcher-bg          popover background
 *   --sp-switcher-border      popover border
 *   --sp-switcher-hover       hover / current-app background
 *   --sp-switcher-muted       group labels + taglines
 *   --sp-switcher-accent      focus ring
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import {
  SUITE_APPS,
  SUITE_GROUP_LABEL,
  isSuiteHost,
  resolveSuiteUrl,
  type SuiteAppId,
  type SuiteGroup,
} from './suite-apps'

const noopSubscribe = () => () => {}
const readClientHost = () => isSuiteHost(window.location.hostname)
const readServerHost = () => false

/**
 * Are we served from a *.stillpointcommercial.com origin? useSyncExternalStore
 * keeps SSR + hydration consistent (server snapshot is false; the client
 * re-renders with the real hostname right after hydration).
 */
function useOnCustomDomain(): boolean {
  return useSyncExternalStore(noopSubscribe, readClientHost, readServerHost)
}

const CSS = `
.sp-switcher{position:relative;display:inline-flex;font-family:inherit;line-height:1.2}
.sp-switcher__btn{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9px;border:0;background:transparent;color:var(--sp-switcher-fg,#64748b);cursor:pointer;padding:0;transition:background .15s,color .15s}
.sp-switcher__btn:hover,.sp-switcher__btn[aria-expanded="true"]{background:var(--sp-switcher-hover,rgba(15,23,42,.07));color:var(--sp-switcher-fg-strong,#0f172a)}
.sp-switcher__btn:focus-visible{outline:2px solid var(--sp-switcher-accent,#2E75B6);outline-offset:2px}
.sp-switcher__pop{position:absolute;z-index:1000;width:300px;max-width:calc(100vw - 16px);background:var(--sp-switcher-bg,#fff);color:var(--sp-switcher-fg-strong,#0f172a);border:1px solid var(--sp-switcher-border,rgba(15,23,42,.12));border-radius:14px;box-shadow:0 14px 36px -14px rgba(15,23,42,.3),0 2px 8px rgba(15,23,42,.08);padding:10px}
.sp-switcher__pop--bottom{top:calc(100% + 8px)}
.sp-switcher__pop--top{bottom:calc(100% + 8px)}
.sp-switcher__pop--right{right:0}
.sp-switcher__pop--left{left:0}
.sp-switcher__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
.sp-switcher__group{grid-column:1/-1;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--sp-switcher-muted,#94a3b8);padding:8px 6px 2px}
.sp-switcher__group:first-child{padding-top:2px}
.sp-switcher__item{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 4px 8px;border-radius:10px;text-decoration:none;color:inherit;text-align:center;transition:background .15s}
.sp-switcher__item:hover{background:var(--sp-switcher-hover,rgba(15,23,42,.07))}
.sp-switcher__item:focus-visible{outline:2px solid var(--sp-switcher-accent,#2E75B6);outline-offset:-2px}
.sp-switcher__item[aria-current="page"]{background:var(--sp-switcher-hover,rgba(15,23,42,.07));cursor:default}
.sp-switcher__tile{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;color:#fff;font-size:11px;font-weight:700;letter-spacing:.02em;box-shadow:inset 0 -1px 0 rgba(0,0,0,.12)}
.sp-switcher__name{font-size:12px;font-weight:600;color:var(--sp-switcher-fg-strong,#0f172a)}
.sp-switcher__tag{font-size:10px;color:var(--sp-switcher-muted,#94a3b8)}
`

function WaffleIcon({ size = 20 }: { size?: number }) {
  // 3x3 dot grid, currentColor.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="5" r="2" /><circle cx="12" cy="5" r="2" /><circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
      <circle cx="5" cy="19" r="2" /><circle cx="12" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
    </svg>
  )
}

/** The grid of app links. Rendered inside the popover, or standalone via variant="list". */
export function SuiteAppGrid({
  current,
  groups,
  onNavigate,
}: {
  current?: SuiteAppId
  groups?: readonly SuiteGroup[]
  onNavigate?: () => void
}) {
  const onCustomDomain = useOnCustomDomain()
  const visibleGroups = (groups ?? ['work', 'home']).filter((g) => SUITE_APPS.some((a) => a.group === g))
  return (
    <div className="sp-switcher__grid" role="menu">
      {visibleGroups.map((g) => (
        <GroupBlock key={g} group={g} current={current} onCustomDomain={onCustomDomain} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

function GroupBlock({
  group,
  current,
  onCustomDomain,
  onNavigate,
}: {
  group: SuiteGroup
  current?: SuiteAppId
  onCustomDomain: boolean
  onNavigate?: () => void
}) {
  return (
    <>
      <div className="sp-switcher__group">{SUITE_GROUP_LABEL[group]}</div>
      {SUITE_APPS.filter((a) => a.group === group).map((app) => {
        const isCurrent = app.id === current
        return (
          <a
            key={app.id}
            role="menuitem"
            className="sp-switcher__item"
            href={resolveSuiteUrl(app, onCustomDomain)}
            aria-current={isCurrent ? 'page' : undefined}
            onClick={(e) => {
              if (isCurrent) e.preventDefault()
              else onNavigate?.()
            }}
            title={app.tagline}
          >
            <span className="sp-switcher__tile" style={{ background: app.color }}>{app.short}</span>
            <span className="sp-switcher__name">{app.name}</span>
            <span className="sp-switcher__tag">{app.tagline}</span>
          </a>
        )
      })}
    </>
  )
}

export interface AppSwitcherProps {
  /** Which app this copy lives in. Highlighted and not clickable in the grid. */
  current: SuiteAppId
  /** 'button' = waffle icon that opens a popover (default). 'list' = the grid inline (for sheets, settings pages). */
  variant?: 'button' | 'list'
  /** Popover horizontal anchor relative to the button. */
  align?: 'left' | 'right'
  /** Popover vertical direction. Use 'top' when the button sits at the bottom of a sidebar. */
  side?: 'bottom' | 'top'
  /** Restrict to some groups, e.g. ['home']. Default: all. */
  groups?: readonly SuiteGroup[]
  /** Accessible label for the button. */
  label?: string
  /** Extra class on the root element (for positioning by the host app). */
  className?: string
  style?: CSSProperties
  iconSize?: number
}

export function AppSwitcher({
  current,
  variant = 'button',
  align = 'right',
  side = 'bottom',
  groups,
  label = 'StillPoint apps',
  className,
  style,
  iconSize = 20,
}: AppSwitcherProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // React 19 hoists + dedupes <style> with href/precedence into <head>.
  const styleTag = <style href="sp-app-switcher" precedence="default">{CSS}</style>

  if (variant === 'list') {
    return (
      <div className={['sp-switcher sp-switcher--list', className].filter(Boolean).join(' ')} style={{ display: 'block', ...style }}>
        {styleTag}
        <SuiteAppGrid current={current} groups={groups} />
      </div>
    )
  }

  return (
    <div ref={rootRef} className={['sp-switcher', className].filter(Boolean).join(' ')} style={style}>
      {styleTag}
      <button
        ref={btnRef}
        type="button"
        className="sp-switcher__btn"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setOpen((v) => !v)}
      >
        <WaffleIcon size={iconSize} />
      </button>
      {open && (
        <div id={popId} className={`sp-switcher__pop sp-switcher__pop--${side} sp-switcher__pop--${align}`}>
          <SuiteAppGrid current={current} groups={groups} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
