import { Settings } from 'lucide-react'
import { requireProfile } from '@/lib/suite/auth'
import { SuiteHeader } from '@/components/suite/suite-header'
import { initialsOf } from '@/components/suite/utils'
import { Tile } from '@/components/suite/tile'
import { toolIcon } from '@/components/suite/icons'

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

  return (
    <div className="min-h-screen bg-suite-bg font-suite text-suite-ink">
      <SuiteHeader user={{ name, role: profile.role, initials: initialsOf(name) }} />

      <main className="mx-auto max-w-[1600px] px-6 py-12">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-suite-ink-3">Stillpoint Suite</p>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-suite-ink">Your tools</h1>
        <p className="mt-1.5 text-suite-ink-2">
          {isOwner
            ? 'You have owner access to every enabled tool in the suite.'
            : 'The tools your StillPoint partner has enabled for you.'}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
      </main>
    </div>
  )
}
