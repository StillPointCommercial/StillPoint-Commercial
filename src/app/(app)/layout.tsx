import { AppShell } from '@/components/layout/app-shell'
import { ToastProvider } from '@/components/ui/toast'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
    </ToastProvider>
  )
}
