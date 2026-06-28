import { ToastProvider } from '@/components/ui/toast'

// Thin shell for every signed-in route. The CRM keeps its own warm AppShell
// under /tools/cis; the launcher, Business Case Model and admin bring their
// own cool "suite" styling.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
