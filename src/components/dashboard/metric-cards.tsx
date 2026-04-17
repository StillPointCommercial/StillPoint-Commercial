import { MessageSquare, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'

interface MetricCardsProps {
  activeConversations: number
  pipelineValue: number
  securedValue: number
  overdueCount: number
}

function formatCurrency(val: number) {
  return val >= 1000 ? `\u20AC${(val / 1000).toFixed(0)}k` : `\u20AC${val}`
}

export function MetricCards({ activeConversations, pipelineValue, securedValue, overdueCount }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
      <MetricCard
        icon={<MessageSquare size={18} />}
        label="Active"
        value={activeConversations.toString()}
      />
      <MetricCard
        icon={<TrendingUp size={18} />}
        label="Pipeline"
        value={formatCurrency(pipelineValue)}
      />
      <MetricCard
        icon={<CheckCircle2 size={18} />}
        label="Secured"
        value={formatCurrency(securedValue)}
        positive={securedValue > 0}
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

function MetricCard({ icon, label, value, alert = false, positive = false }: { icon: React.ReactNode; label: string; value: string; alert?: boolean; positive?: boolean }) {
  return (
    <div className="bg-cream border border-border rounded-card p-4">
      <div className={`mb-2 ${alert ? 'text-attention-red' : positive ? 'text-success-green' : 'text-charcoal-light'}`}>
        {icon}
      </div>
      <p className={`text-2xl font-medium font-dm-sans ${alert ? 'text-attention-red' : positive ? 'text-success-green' : 'text-charcoal'}`}>
        {value}
      </p>
      <p className="text-xs text-text-light mt-0.5">{label}</p>
    </div>
  )
}
