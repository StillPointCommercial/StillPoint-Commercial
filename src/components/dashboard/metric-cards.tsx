import { MessageSquare, TrendingUp, AlertCircle } from 'lucide-react'

interface MetricCardsProps {
  activeConversations: number
  pipelineValue: number
  overdueCount: number
}

export function MetricCards({ activeConversations, pipelineValue, overdueCount }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
      <MetricCard
        icon={<MessageSquare size={18} />}
        label="Active"
        value={activeConversations.toString()}
      />
      <MetricCard
        icon={<TrendingUp size={18} />}
        label="Pipeline"
        value={`\u20AC${pipelineValue >= 1000 ? `${(pipelineValue / 1000).toFixed(0)}k` : pipelineValue.toString()}`}
      />
      <MetricCard
        icon={<AlertCircle size={18} />}
        label="Overdue"
        value={overdueCount.toString()}
        alert={overdueCount > 0}
      />
    </div>
  )
}

function MetricCard({ icon, label, value, alert = false }: { icon: React.ReactNode; label: string; value: string; alert?: boolean }) {
  return (
    <div className="bg-cream border border-border rounded-card p-4">
      <div className={`mb-2 ${alert ? 'text-attention-red' : 'text-charcoal-light'}`}>
        {icon}
      </div>
      <p className={`text-2xl font-medium font-dm-sans ${alert ? 'text-attention-red' : 'text-charcoal'}`}>
        {value}
      </p>
      <p className="text-xs text-text-light mt-0.5">{label}</p>
    </div>
  )
}
