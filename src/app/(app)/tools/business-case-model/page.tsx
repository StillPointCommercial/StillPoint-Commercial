'use client'

// Import-first Business Case Model: the tool opens straight into the live workbook
// workspace (import a sheet or open a saved scenario). The owner can switch between
// client workspaces; everything else lives inside WorkbookStudio.
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WorkbookStudio } from '@/components/bcm/workbook-studio'

export default function BusinessCaseModelPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Identify the user, and (for the owner) list client workspaces to switch between.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setLoading(false)
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, role')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      const owner = profile?.role === 'owner'
      let initialOrg = (profile?.org_id as string | null) ?? null
      if (owner) {
        const { data: orgRows } = await supabase.from('orgs').select('id, name').order('name')
        if (cancelled) return
        const list = (orgRows ?? []) as { id: string; name: string }[]
        setOrgs(list)
        initialOrg = list[0]?.id ?? null // default the owner into the first client workspace
      }
      setUserId(user.id)
      setIsOwner(owner)
      setOrgId(initialOrg)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const switchOrg = useCallback((target: string | null) => setOrgId(target), [])

  return (
    <main className="mx-auto w-full max-w-[2400px] px-6 lg:px-10 py-6">
      {isOwner && orgs.length > 0 && (
        <div className="mb-5 flex items-center justify-end gap-1.5 text-xs text-suite-ink-3">
          <span>Workspace:</span>
          <select
            value={orgId ?? ''}
            onChange={(e) => switchOrg(e.target.value || null)}
            className="rounded-md border border-suite-border bg-suite-bg px-2 py-1 text-xs text-suite-ink focus:border-suite-accent focus:outline-none"
          >
            <option value="">My workspace</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-suite-ink-3">Loading…</p>
      ) : (
        <WorkbookStudio userId={userId} orgId={orgId} />
      )}
    </main>
  )
}
