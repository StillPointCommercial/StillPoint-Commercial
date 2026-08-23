import { headers } from 'next/headers'
import { Settings, PenLine, Calculator, ClipboardCheck, Compass, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { requireProfile } from '@/lib/suite/auth'
import { SuiteHeader } from '@/components/suite/suite-header'
import { initialsOf } from '@/components/suite/utils'
import { Tile } from '@/components/suite/tile'
import { toolIcon } from '@/components/suite/icons'
import { SUITE_APPS, isSuiteHost, resolveSuiteUrl, type SuiteAppId } from '@/components/suite/suite-apps'

// Icons for the other StillPoint apps (owner-only tiles). The app list itself
// lives in suite-apps.ts (canonical: ~/.claude/PROJECTS.md, "StillPoint Suite").
const SUITE_APP_ICONS: Partial<Record<SuiteAppId, LucideIcon>> = {
  sign: PenLine,
  coi: Calculator,
  deals: ClipboardCheck,
  vela: Compass,
  table: UtensilsCrossed,
}

export const dynamic = 'force-dynamic'

type Tool = { slug: string; name: string; description: string | null; icon: string | null; sort_order: number }

export default async function LauncherPage() {
  const { supabase, user, profile } = await requireProfile()
  const isOwner = profile.role === 'owner'

  const { data: toolsData } = await supabase
    .from('tools')
    .select('slug, name, description, icon, sort_order')
    .eq('enabled', true)
    .order('sort_order')
  let tools = (toolsData ?? []) as Tool[]

  if (!isOwner) {
    // Tiles are granted per organization (org_tools), shared by the whole team.
    const { data: access } = await supabase
      .from('org_tools')
      .select('tool_slug, enabled')
      .eq('org_id', profile.org_id ?? '')
    const granted = new Set((access ?? []).filter((a) => a.enabled).map((a) => a.tool_slug))
    tools = tools.filter((t) => granted.has(t.slug))
  }

  const name = profile.display_name ?? profile.email ?? 'User'

  // Other StillPoint apps (separate deployments). Owner only; links resolve to
  // the *.stillpointcommercial.com subdomains when this page is itself served
  // from one, otherwise to the *.vercel.app URLs (consistent auth origins).
  const host = (await headers()).get('host') ?? ''
  const onCustomDomain = isSuiteHost(host.split(':')[0])
  const otherApps = isOwner ? SUITE_APPS.filter((a) => a.id !== 'cis') : []

  return (
    <div className="min-h-screen bg-suite-bg font-suite text-suite-ink">
      <SuiteHeader user={{ name, role: profile.role, initials: initialsOf(name) }} />

      <main className="mx-auto w-full max-w-[2400px] px-6 lg:px-10 py-12">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <Tile
              key={t.slug}
              href={`/tools/${t.slug}`}
              name={t.name}
              description={t.description ?? ''}
              icon={toolIcon(t.icon)}
              badge={isOwner ? 'All access' : undefined}
            />
          ))}
          {isOwner && (
            <Tile
              href="/admin"
              name="Admin console"
              description="Manage users, per-user tile access and read client scenarios."
              icon={Settings}
              badge="Owner"
            />
          )}
          {tools.length === 0 && !isOwner && (
            <div className="col-span-full rounded-xl border border-dashed border-suite-border bg-suite-subtle p-10 text-center text-suite-ink-2">
              No tools have been enabled for your account yet.
            </div>
          )}
        </div>

        {otherApps.length > 0 && (
          <section className="mt-12" aria-labelledby="other-apps-heading">
            <h2 id="other-apps-heading" className="text-xs font-semibold uppercase tracking-[0.08em] text-suite-ink-3">
              Other StillPoint apps
            </h2>
            <p className="mt-1 text-sm text-suite-ink-2">
              Separate apps, same suite. Work tools first, then home.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {otherApps.map((app) => (
                <Tile
                  key={app.id}
                  href={resolveSuiteUrl(app, onCustomDomain)}
                  name={app.name}
                  description={app.tagline}
                  icon={SUITE_APP_ICONS[app.id] ?? Compass}
                  badge={app.group === 'home' ? 'Home' : 'Work'}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
