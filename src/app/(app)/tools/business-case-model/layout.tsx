import { requireTool, getProfile } from '@/lib/suite/auth'
import { SuiteHeader } from '@/components/suite/suite-header'
import { initialsOf } from '@/components/suite/utils'

export default async function BcmLayout({ children }: { children: React.ReactNode }) {
  await requireTool('business-case-model')
  const { profile } = await getProfile()
  const name = profile?.display_name ?? profile?.email ?? 'User'
  return (
    <div className="min-h-screen bg-suite-bg font-suite text-suite-ink">
      <SuiteHeader
        user={{ name, role: profile?.role ?? 'client', initials: initialsOf(name) }}
        back
        title="Business Case Model"
      />
      {children}
    </div>
  )
}
