'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Panel, Segmented, Chip, Kpi, KpiStrip, tbl, cx } from '@/components/suite/ui'
import { compute } from '@/lib/bcm/model'
import { ADAPTA } from '@/lib/bcm/seed'
import { fmtM, fmtPct, fmtNum } from '@/lib/bcm/format'
import type { Params } from '@/lib/bcm/types'
import { OrgManagementSection } from './org-management'

export type AdminProfile = {
  id: string
  email: string | null
  display_name: string | null
  org: string | null
  role: 'client' | 'owner'
  org_id: string | null
}

export type AdminTool = {
  slug: string
  name: string
  description: string | null
  icon: string | null
  enabled: boolean
  sort_order: number
  default_for_new_users: boolean
}

export type AdminOrg = {
  id: string
  name: string
  slug: string
  created_at: string | null
}

export type OrgDomainRow = {
  org_id: string
  domain: string
}

export type OrgToolRow = {
  org_id: string
  tool_slug: string
  enabled: boolean
}

export type OrgStat = {
  members: number
  datasets: number
  scenarios: number
}

type ScenarioRow = {
  id: string
  name: string
  params: Params
  is_baseline: boolean
}

function nameOf(p: AdminProfile): string {
  return p.display_name ?? p.email ?? 'Unknown user'
}

export function AdminConsole({
  orgs,
  orgDomains,
  orgTools,
  tools,
  profiles,
  orgStats,
}: {
  orgs: AdminOrg[]
  orgDomains: OrgDomainRow[]
  orgTools: OrgToolRow[]
  tools: AdminTool[]
  profiles: AdminProfile[]
  orgStats: Record<string, OrgStat>
}) {
  const supabase = useMemo(() => createClient(), [])

  // Enabled org_tools per org id, derived once for the "Viewing as" preview.
  const enabledByOrg = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    for (const row of orgTools) {
      if (!row.enabled) continue
      ;(map[row.org_id] ??= new Set<string>()).add(row.tool_slug)
    }
    return map
  }, [orgTools])

  const clients = useMemo(() => profiles.filter((p) => p.role !== 'owner'), [profiles])

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-suite-ink-3">Stillpoint Suite</p>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-suite-ink">Admin console</h1>
        <p className="mt-1.5 text-suite-ink-2">
          Manage client organizations, their tiles and members, and read shared scenarios.
        </p>
      </div>

      <UsersSection profiles={profiles} />

      <OrgManagementSection
        orgs={orgs}
        orgDomains={orgDomains}
        orgTools={orgTools}
        tools={tools}
        orgStats={orgStats}
      />

      <MembersSection orgs={orgs} profiles={profiles} />

      <ScenarioViewerSection supabase={supabase} orgs={orgs} />

      <ViewingAsSection clients={clients} orgs={orgs} tools={tools} enabledByOrg={enabledByOrg} />
    </main>
  )
}

/* ----------------------------------------------------------------- Users */

function UsersSection({ profiles }: { profiles: AdminProfile[] }) {
  return (
    <Panel title="Users" subtitle="Everyone provisioned in the suite.">
      <div className="overflow-x-auto">
        <table className={tbl.table}>
          <thead>
            <tr>
              <th className={tbl.th}>Name</th>
              <th className={tbl.th}>Email</th>
              <th className={tbl.th}>Org</th>
              <th className={tbl.th}>Role</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className={tbl.tr}>
                <td className={tbl.td}>{nameOf(p)}</td>
                <td className={tbl.tdMuted}>{p.email ?? '·'}</td>
                <td className={tbl.tdMuted}>{p.org ?? '·'}</td>
                <td className={tbl.td}>
                  <Chip tone={p.role === 'owner' ? 'dark' : 'neutral'}>{p.role}</Chip>
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr className={tbl.tr}>
                <td className={tbl.tdMuted} colSpan={4}>
                  No users provisioned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/* --------------------------------------------------------------- Members */

function MembersSection({ orgs, profiles }: { orgs: AdminOrg[]; profiles: AdminProfile[] }) {
  // Group: one group per org (by org_id) plus an "Owner / unassigned" group for org_id null.
  const groups = useMemo(() => {
    const byOrg: { key: string; label: string; members: AdminProfile[] }[] = orgs.map((o) => ({
      key: o.id,
      label: o.name,
      members: [],
    }))
    const index: Record<string, AdminProfile[]> = {}
    for (const g of byOrg) index[g.key] = g.members
    const unassigned: AdminProfile[] = []
    for (const p of profiles) {
      if (p.org_id && index[p.org_id]) index[p.org_id].push(p)
      else unassigned.push(p)
    }
    return [...byOrg, { key: '__none__', label: 'Owner / unassigned', members: unassigned }].filter(
      (g) => g.members.length > 0,
    )
  }, [orgs, profiles])

  return (
    <Panel title="Members" subtitle="People grouped by the organization they belong to.">
      {groups.length === 0 ? (
        <p className="text-sm text-suite-ink-2">No members yet.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 flex items-center gap-2">
                <h4 className="text-sm font-semibold text-suite-ink">{g.label}</h4>
                <Chip tone="neutral">{g.members.length}</Chip>
              </div>
              <div className="overflow-x-auto">
                <table className={tbl.table}>
                  <thead>
                    <tr>
                      <th className={tbl.th}>Name</th>
                      <th className={tbl.th}>Email</th>
                      <th className={tbl.th}>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.members.map((p) => (
                      <tr key={p.id} className={tbl.tr}>
                        <td className={tbl.td}>{nameOf(p)}</td>
                        <td className={tbl.tdMuted}>{p.email ?? '·'}</td>
                        <td className={tbl.td}>
                          <Chip tone={p.role === 'owner' ? 'dark' : 'neutral'}>{p.role}</Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------- Scenario viewer */

function ScenarioViewerSection({
  supabase,
  orgs,
}: {
  supabase: ReturnType<typeof createClient>
  orgs: AdminOrg[]
}) {
  const [orgId, setOrgId] = useState<string>('')
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function loadScenarios(id: string) {
    setOrgId(id)
    setSelectedId('')
    setScenarios([])
    if (!id) return
    setLoading(true)
    const { data } = await supabase
      .from('bcm_scenarios')
      .select('id, name, params, is_baseline')
      .eq('org_id', id)
    setScenarios((data ?? []) as ScenarioRow[])
    setLoading(false)
  }

  const selected = scenarios.find((s) => s.id === selectedId) ?? null
  const computed = selected ? compute(ADAPTA, selected.params as Params) : null

  return (
    <Panel
      title="Scenario viewer"
      subtitle="Inspect any organization's saved Business Case Model scenarios."
      right={<Chip tone="neutral">read-only</Chip>}
    >
      {orgs.length === 0 ? (
        <p className="text-sm text-suite-ink-2">No organizations to inspect.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-suite-ink-2">Organization</label>
            <Segmented
              options={orgs.map((o) => ({ value: o.id, label: o.name }))}
              value={orgId}
              onChange={loadScenarios}
            />
          </div>

          {orgId && (
            <div>
              {loading ? (
                <p className="text-sm text-suite-ink-3">Loading scenarios…</p>
              ) : scenarios.length === 0 ? (
                <p className="text-sm text-suite-ink-2">This organization has no saved scenarios.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {scenarios.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={cx(
                        'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                        s.id === selectedId
                          ? 'border-suite-accent bg-suite-accent-tint text-suite-accent-dark'
                          : 'border-suite-border bg-suite-bg text-suite-ink-2 hover:text-suite-ink',
                      )}
                    >
                      {s.name}
                      {s.is_baseline && <Chip tone="neutral">baseline</Chip>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {computed && (
            <KpiStrip>
              <Kpi label="Total 2030" value={fmtM(computed.totalRevenue[4])} />
              <Kpi label="New 2030" value={fmtM(computed.newTotal[4])} />
              <Kpi label="Logos 2030" value={fmtNum(Math.round(computed.totalNewLogos2030))} />
              <Kpi label="Penetration" value={fmtPct(computed.marketPenetration)} />
              <Kpi label="Whitespace" value={fmtNum(Math.round(computed.whitespace[4]))} />
            </KpiStrip>
          )}
        </div>
      )}
    </Panel>
  )
}

/* ---------------------------------------------------------- Viewing as */

function ViewingAsSection({
  clients,
  orgs,
  tools,
  enabledByOrg,
}: {
  clients: AdminProfile[]
  orgs: AdminOrg[]
  tools: AdminTool[]
  enabledByOrg: Record<string, Set<string>>
}) {
  const [userId, setUserId] = useState<string>('')
  const user = clients.find((c) => c.id === userId) ?? null
  const userOrg = user?.org_id ? orgs.find((o) => o.id === user.org_id) ?? null : null
  const granted = user?.org_id ? enabledByOrg[user.org_id] ?? new Set<string>() : new Set<string>()

  return (
    <Panel
      title="Viewing as"
      subtitle="Preview the launcher tiles a client would see, based on their organization."
      right={<Chip tone="neutral">read-only</Chip>}
    >
      {clients.length === 0 ? (
        <p className="text-sm text-suite-ink-2">No client users to preview.</p>
      ) : (
        <div className="space-y-4">
          <Segmented
            options={clients.map((c) => ({ value: c.id, label: nameOf(c) }))}
            value={userId}
            onChange={setUserId}
          />

          {!user ? (
            <p className="text-sm text-suite-ink-3">Select a client to preview their tiles.</p>
          ) : !user.org_id ? (
            <p className="text-sm text-suite-ink-2">
              This client is not assigned to any organization, so they see no tiles.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-suite-ink-3">
                Tiles for{' '}
                <span className="font-medium text-suite-ink-2">{userOrg?.name ?? 'their org'}</span>.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tools
                  .filter((t) => t.enabled)
                  .map((t) => {
                    const on = granted.has(t.slug)
                    return (
                      <div
                        key={t.slug}
                        className={cx(
                          'flex items-start justify-between gap-3 rounded-xl border p-4',
                          on
                            ? 'border-suite-border bg-suite-bg'
                            : 'border-dashed border-suite-border bg-suite-subtle',
                        )}
                      >
                        <div>
                          <div
                            className={cx(
                              'text-sm font-medium',
                              on ? 'text-suite-ink' : 'text-suite-ink-3',
                            )}
                          >
                            {t.name}
                          </div>
                          {t.description && (
                            <div className="mt-0.5 text-xs text-suite-ink-3">{t.description}</div>
                          )}
                        </div>
                        <Chip tone={on ? 'accent' : 'neutral'}>{on ? 'enabled' : 'disabled'}</Chip>
                      </div>
                    )
                  })}
                {tools.filter((t) => t.enabled).length === 0 && (
                  <p className="text-sm text-suite-ink-2">No enabled tools in the suite.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}
