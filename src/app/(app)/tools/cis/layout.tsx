import { AppShell } from '@/components/layout/app-shell'
import { getProfile, requireTool } from '@/lib/suite/auth'

export default async function CisLayout({ children }: { children: React.ReactNode }) {
  await requireTool('cis')
  // Role only gates the StillPoint Suite app switcher in the sidebar (owner-only UI).
  const { profile } = await getProfile()
  return <AppShell isOwner={profile?.role === 'owner'}>{children}</AppShell>
}
