import { LayoutGrid, BarChart3, Settings, type LucideIcon } from 'lucide-react'

export const TOOL_ICONS: Record<string, LucideIcon> = {
  'layout-grid': LayoutGrid,
  'bar-chart-3': BarChart3,
  settings: Settings,
}

export function toolIcon(name: string | null | undefined): LucideIcon {
  return TOOL_ICONS[name ?? ''] ?? LayoutGrid
}
