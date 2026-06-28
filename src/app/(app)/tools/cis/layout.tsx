import { AppShell } from '@/components/layout/app-shell'
import { requireTool } from '@/lib/suite/auth'

export default async function CisLayout({ children }: { children: React.ReactNode }) {
  await requireTool('cis')
  return <AppShell>{children}</AppShell>
}
