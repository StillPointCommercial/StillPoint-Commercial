'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Panel, Toggle, Chip, tbl, cx } from '@/components/suite/ui'
import type { AdminOrg, AdminTool, OrgDomainRow, OrgToolRow, OrgStat } from './admin-console'

function orgToolKey(orgId: string, slug: string): string {
  return `${orgId}::${slug}`
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function OrgManagementSection({
  orgs: initialOrgs,
  orgDomains: initialDomains,
  orgTools: initialOrgTools,
  tools,
  orgStats,
}: {
  orgs: AdminOrg[]
  orgDomains: OrgDomainRow[]
  orgTools: OrgToolRow[]
  tools: AdminTool[]
  orgStats: Record<string, OrgStat>
}) {
  const supabase = useMemo(() => createClient(), [])

  const [orgs, setOrgs] = useState<AdminOrg[]>(initialOrgs)

  // Domains keyed by org id, kept in local state so add/remove is reflected immediately.
  const [domains, setDomains] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {}
    for (const o of initialOrgs) map[o.id] = []
    for (const d of initialDomains) {
      if (!map[d.org_id]) map[d.org_id] = []
      map[d.org_id].push(d.domain)
    }
    return map
  })

  // org_tools.enabled keyed by `${orgId}::${slug}`.
  const [orgTools, setOrgTools] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    for (const row of initialOrgTools) map[orgToolKey(row.org_id, row.tool_slug)] = row.enabled
    return map
  })

  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [slugDirty, setSlugDirty] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function addDomain(orgId: string, raw: string) {
    const domain = raw.trim().toLowerCase()
    if (!domain) return
    if ((domains[orgId] ?? []).includes(domain)) return
    // optimistic
    setDomains((prev) => ({ ...prev, [orgId]: [...(prev[orgId] ?? []), domain] }))
    const { error } = await supabase.from('org_domains').insert({ org_id: orgId, domain })
    if (error) {
      setDomains((prev) => ({
        ...prev,
        [orgId]: (prev[orgId] ?? []).filter((d) => d !== domain),
      }))
    }
  }

  async function removeDomain(orgId: string, domain: string) {
    const previous = domains[orgId] ?? []
    setDomains((prev) => ({
      ...prev,
      [orgId]: (prev[orgId] ?? []).filter((d) => d !== domain),
    }))
    const { error } = await supabase
      .from('org_domains')
      .delete()
      .eq('org_id', orgId)
      .eq('domain', domain)
    if (error) {
      setDomains((prev) => ({ ...prev, [orgId]: previous }))
    }
  }

  async function toggleOrgTool(orgId: string, slug: string, enabled: boolean) {
    const key = orgToolKey(orgId, slug)
    const previous = orgTools[key] ?? false
    setOrgTools((prev) => ({ ...prev, [key]: enabled }))
    const { error } = await supabase
      .from('org_tools')
      .upsert({ org_id: orgId, tool_slug: slug, enabled }, { onConflict: 'org_id,tool_slug' })
    if (error) {
      setOrgTools((prev) => ({ ...prev, [key]: previous }))
    }
  }

  async function createOrg() {
    const name = newName.trim()
    const slug = (slugDirty ? newSlug : slugify(newName)).trim()
    if (!name || !slug) {
      setCreateError('Name and slug are required.')
      return
    }
    setCreating(true)
    setCreateError(null)
    const { data, error } = await supabase
      .from('orgs')
      .insert({ name, slug })
      .select('id, name, slug, created_at')
      .single()
    setCreating(false)
    if (error || !data) {
      setCreateError(error?.message ?? 'Could not create organization.')
      return
    }
    const created = data as AdminOrg
    setOrgs((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    setDomains((prev) => ({ ...prev, [created.id]: [] }))
    setNewName('')
    setNewSlug('')
    setSlugDirty(false)
  }

  return (
    <Panel
      title="Client organizations"
      subtitle="Each org owns its launcher tiles, members and shared Business Case Model data."
    >
      <div className="space-y-5">
        {orgs.length === 0 ? (
          <p className="text-sm text-suite-ink-2">No organizations yet. Create your first below.</p>
        ) : (
          <div className="space-y-4">
            {orgs.map((org) => {
              const stat = orgStats[org.id] ?? { members: 0, datasets: 0, scenarios: 0 }
              const orgDomainList = domains[org.id] ?? []
              return (
                <div key={org.id} className="rounded-xl border border-suite-border bg-suite-bg p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-suite-ink">{org.name}</h4>
                        <Chip tone="neutral">{org.slug}</Chip>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suite-ink-3">
                        <span>{stat.members} {stat.members === 1 ? 'member' : 'members'}</span>
                        <span>{stat.datasets} {stat.datasets === 1 ? 'dataset' : 'datasets'}</span>
                        <span>{stat.scenarios} {stat.scenarios === 1 ? 'scenario' : 'scenarios'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Domains */}
                  <div className="mt-3">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-suite-ink-3">
                      Domains
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {orgDomainList.length === 0 && (
                        <span className="text-xs text-suite-ink-3">No domains yet.</span>
                      )}
                      {orgDomainList.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1.5 rounded-full bg-suite-subtle px-2.5 py-1 text-[11px] font-medium text-suite-ink-2"
                        >
                          {d}
                          <button
                            type="button"
                            aria-label={`Remove ${d}`}
                            onClick={() => removeDomain(org.id, d)}
                            className="text-suite-ink-3 transition-colors hover:text-suite-neg"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                      <DomainInput onAdd={(value) => addDomain(org.id, value)} />
                    </div>
                  </div>

                  {/* Tool toggles */}
                  <div className="mt-4">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-suite-ink-3">
                      Tiles
                    </div>
                    {tools.length === 0 ? (
                      <p className="mt-1.5 text-xs text-suite-ink-3">No tools defined.</p>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-2">
                        {tools.map((t) => {
                          const checked = orgTools[orgToolKey(org.id, t.slug)] ?? false
                          return (
                            <label
                              key={t.slug}
                              className="flex items-center gap-2 text-sm text-suite-ink"
                            >
                              <Toggle
                                checked={checked}
                                onChange={(v) => toggleOrgTool(org.id, t.slug, v)}
                              />
                              <span className={cx(!t.enabled && 'text-suite-ink-3')}>
                                {t.name}
                                {!t.enabled && ' (disabled)'}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* New organization form */}
        <div className="rounded-xl border border-dashed border-suite-border bg-suite-subtle p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-suite-ink-3">
            New organization
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-suite-ink-2">Name</label>
              <input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value)
                  if (!slugDirty) setNewSlug(slugify(e.target.value))
                }}
                placeholder="Acme Corporation"
                className="w-full rounded-input border border-suite-border bg-suite-bg px-3 py-2 text-sm text-suite-ink focus:border-suite-accent focus:outline-none"
              />
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs text-suite-ink-2">Slug</label>
              <input
                value={newSlug}
                onChange={(e) => {
                  setSlugDirty(true)
                  setNewSlug(slugify(e.target.value))
                }}
                placeholder="acme"
                className="w-full rounded-input border border-suite-border bg-suite-bg px-3 py-2 text-sm text-suite-ink focus:border-suite-accent focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={createOrg}
              disabled={creating || !newName.trim()}
              className="rounded-input bg-suite-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creating ? 'Creating…' : 'Add organization'}
            </button>
          </div>
          {createError && <p className="mt-2 text-xs text-suite-neg">{createError}</p>}
        </div>
      </div>
    </Panel>
  )
}

/* Small uncontrolled-ish input that adds a domain on Enter or button click. */
function DomainInput({ onAdd }: { onAdd: (value: string) => void }) {
  const [value, setValue] = useState('')

  function commit() {
    const v = value.trim()
    if (!v) return
    onAdd(v)
    setValue('')
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
        placeholder="add domain…"
        className="w-36 rounded-input border border-suite-border bg-suite-bg px-2.5 py-1 text-xs text-suite-ink focus:border-suite-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={commit}
        disabled={!value.trim()}
        className="rounded-input border border-suite-border px-2 py-1 text-xs text-suite-ink-2 transition-colors hover:text-suite-ink disabled:opacity-40"
      >
        +
      </button>
    </span>
  )
}
