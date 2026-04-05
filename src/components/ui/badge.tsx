import type { RelationshipStatus, IcpFit, ConfidenceLevel, OpportunityStage } from '@/lib/types'

type BadgeVariant = 'default' | 'status' | 'icp' | 'confidence' | 'stage'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  color?: string
}

const statusColors: Record<RelationshipStatus, string> = {
  dormant: 'bg-stone/20 text-warm-gray',
  warming: 'bg-caution-amber/10 text-caution-amber',
  active: 'bg-success-green/10 text-success-green',
  client: 'bg-terracotta/10 text-terracotta',
  past_client: 'bg-stone/20 text-charcoal-light',
}

const icpColors: Record<IcpFit, string> = {
  strong: 'bg-success-green/10 text-success-green',
  moderate: 'bg-caution-amber/10 text-caution-amber',
  weak: 'bg-attention-red/10 text-attention-red',
  not_assessed: 'bg-stone/20 text-warm-gray',
}

const confidenceColors: Record<ConfidenceLevel, string> = {
  low: 'bg-attention-red/10 text-attention-red',
  medium: 'bg-caution-amber/10 text-caution-amber',
  high: 'bg-success-green/10 text-success-green',
}

export function Badge({ children, color, className = '' }: BadgeProps & { className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-badge text-xs font-medium ${color || 'bg-sand text-charcoal-light'} ${className}`}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: RelationshipStatus }) {
  const { STATUS_LABELS } = require('@/lib/types')
  return <Badge color={statusColors[status]}>{STATUS_LABELS[status]}</Badge>
}

export function IcpBadge({ icp }: { icp: IcpFit }) {
  const { ICP_LABELS } = require('@/lib/types')
  return <Badge color={icpColors[icp]}>{ICP_LABELS[icp]}</Badge>
}

export function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  const { CONFIDENCE_LABELS } = require('@/lib/types')
  return <Badge color={confidenceColors[confidence]}>{CONFIDENCE_LABELS[confidence]}</Badge>
}
