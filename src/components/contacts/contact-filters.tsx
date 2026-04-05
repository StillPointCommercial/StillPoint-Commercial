'use client'

import { Search } from 'lucide-react'
import type { RelationshipStatus, IcpFit } from '@/lib/types'
import { STATUS_LABELS, ICP_LABELS } from '@/lib/types'

interface ContactFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  status: RelationshipStatus | ''
  onStatusChange: (value: RelationshipStatus | '') => void
  icp: IcpFit | ''
  onIcpChange: (value: IcpFit | '') => void
}

const statusOptions: RelationshipStatus[] = ['dormant', 'warming', 'active', 'client', 'past_client']
const icpOptions: IcpFit[] = ['strong', 'moderate', 'weak', 'not_assessed']

export function ContactFilters({
  search, onSearchChange,
  status, onStatusChange,
  icp, onIcpChange,
}: ContactFiltersProps) {
  return (
    <div className="space-y-3 mb-6">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-gray" />
        <input
          type="text"
          placeholder="Search name, company, tags..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-input border border-border bg-warm-white pl-9 pr-3 py-2 text-sm text-text placeholder:text-warm-gray focus-ring"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="All statuses"
          active={!status}
          onClick={() => onStatusChange('')}
        />
        {statusOptions.map(s => (
          <FilterChip
            key={s}
            label={STATUS_LABELS[s]}
            active={status === s}
            onClick={() => onStatusChange(s)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="All ICP"
          active={!icp}
          onClick={() => onIcpChange('')}
        />
        {icpOptions.map(i => (
          <FilterChip
            key={i}
            label={ICP_LABELS[i]}
            active={icp === i}
            onClick={() => onIcpChange(i)}
          />
        ))}
      </div>
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1 rounded-full text-xs font-medium transition-colors
        ${active
          ? 'bg-terracotta text-warm-white'
          : 'bg-sand text-charcoal-light hover:bg-sand-light'
        }
      `}
    >
      {label}
    </button>
  )
}
