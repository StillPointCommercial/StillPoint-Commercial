'use client'

import { Greeting } from '@/components/dashboard/greeting'
import { MetricCards } from '@/components/dashboard/metric-cards'
import { AttentionList } from '@/components/dashboard/attention-list'
import { GoingColdList } from '@/components/dashboard/going-cold-list'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { useDashboardData } from '@/lib/hooks/use-dashboard-data'

export default function DashboardPage() {
  const data = useDashboardData()

  if (!data) {
    return (
      <div>
        <Greeting />
        <div className="text-text-light">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div>
      <Greeting />
      <MetricCards
        activeConversations={data.activeConversations}
        pipelineValue={data.pipelineValue}
        overdueCount={data.overdueCount}
      />
      <AttentionList contacts={data.overdueContacts} />
      <GoingColdList contacts={data.goingCold} />
      <RecentActivity entries={data.recentActivity} contacts={data.contacts} />

      {data.overdueCount === 0 && data.goingCold.length === 0 && data.recentActivity.length === 0 && (
        <div className="text-center py-16 text-text-light">
          <p className="text-lg mb-2">All clear</p>
          <p className="text-sm">No overdue actions or fading relationships. Nice.</p>
        </div>
      )}
    </div>
  )
}
