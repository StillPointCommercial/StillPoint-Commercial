import { requireOwner, getProfile } from '@/lib/suite/auth'
import { SuiteHeader } from '@/components/suite/suite-header'
import { initialsOf } from '@/components/suite/utils'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireOwner()
  const { profile } = await getProfile()
  const name = profile?.display_name ?? profile?.email ?? 'Owner'
  return (
    <div className="min-h-screen bg-suite-bg font-suite text-suite-ink">
      <SuiteHeader
        user={{ name, role: profile?.role ?? 'owner', initials: initialsOf(name) }}
        back
        title="Admin console"
      />
      {children}
    </div>
  )
}
