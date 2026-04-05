import { Plus } from 'lucide-react'

interface FabProps {
  onClick: () => void
  label?: string
}

export function Fab({ onClick, label = 'Add' }: FabProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-20 md:bottom-8 right-6 w-14 h-14 bg-terracotta text-warm-white rounded-full shadow-lg hover:bg-terracotta-muted transition-colors focus-ring flex items-center justify-center z-40"
    >
      <Plus size={24} />
    </button>
  )
}
