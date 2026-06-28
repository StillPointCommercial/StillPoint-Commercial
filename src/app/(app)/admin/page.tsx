import { createClient } from '@/lib/supabase/server'
import { AdminConsole } from '@/components/admin/admin-console'
import type {
  AdminProfile,
  AdminTool,
  AdminOrg,
  OrgDomainRow,
  OrgToolRow,
  OrgStat,
} from '@/components/admin/admin-console'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()

  const [orgsRes, domainsRes, orgToolsRes, toolsRes, profilesRes, datasetsRes, scenariosRes] =
    await Promise.all([
      supabase.from('orgs').select('id, name, slug, created_at').order('name'),
      supabase.from('org_domains').select('org_id, domain'),
      supabase.from('org_tools').select('org_id, tool_slug, enabled'),
      supabase
        .from('tools')
        .select('slug, name, description, icon, enabled, sort_order, default_for_new_users')
        .order('sort_order'),
      supabase.from('profiles').select('id, email, display_name, org, role, org_id').order('created_at'),
      supabase.from('bcm_datasets').select('id, org_id'),
      supabase.from('bcm_scenarios').select('id, org_id'),
    ])

  const orgs = (orgsRes.data ?? []) as AdminOrg[]
  const orgDomains = (domainsRes.data ?? []) as OrgDomainRow[]
  const orgTools = (orgToolsRes.data ?? []) as OrgToolRow[]
  const tools = (toolsRes.data ?? []) as AdminTool[]
  const profiles = (profilesRes.data ?? []) as AdminProfile[]
  const datasets = (datasetsRes.data ?? []) as { id: string; org_id: string | null }[]
  const scenarios = (scenariosRes.data ?? []) as { id: string; org_id: string | null }[]

  // Per-org counts: members (profiles by org_id), datasets, scenarios.
  const orgStats: Record<string, OrgStat> = {}
  for (const o of orgs) {
    orgStats[o.id] = { members: 0, datasets: 0, scenarios: 0 }
  }
  for (const p of profiles) {
    if (p.org_id && orgStats[p.org_id]) orgStats[p.org_id].members += 1
  }
  for (const d of datasets) {
    if (d.org_id && orgStats[d.org_id]) orgStats[d.org_id].datasets += 1
  }
  for (const sc of scenarios) {
    if (sc.org_id && orgStats[sc.org_id]) orgStats[sc.org_id].scenarios += 1
  }

  return (
    <AdminConsole
      orgs={orgs}
      orgDomains={orgDomains}
      orgTools={orgTools}
      tools={tools}
      profiles={profiles}
      orgStats={orgStats}
    />
  )
}
