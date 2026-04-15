'use client'

import { Greeting } from '@/components/dashboard/greeting'
import { MetricCards } from '@/components/dashboard/metric-cards'
import { PlannedActions } from '@/components/dashboard/planned-actions'
import { AttentionList } from '@/components/dashboard/attention-list'
import { GoingColdList } from '@/components/dashboard/going-cold-list'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { PaceWidget } from '@/components/dashboard/pace-widget'
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
        securedValue={data.securedValue}
        overdueCount={data.overdueCount}
      />

      {/* Year plan pace (shows only when plan is configured) */}
      <PaceWidget />

      {/* Forward-looking: what's coming up */}
      <PlannedActions
        today={data.plannedActions.today}
        week={data.plannedActions.week}
        later={data.plannedActions.later}
        overdueCount={data.overdueCount}
      />

      {/* Attention-needed sections */}
      <AttentionList contacts={data.overdueContacts} />
      <GoingColdList contacts={data.goingCold} />

      {/* Backward-looking: what happened */}
      <RecentActivity entries={data.recentActivity} contacts={data.contacts} />

      {data.overdueCount === 0 && data.goingCold.length === 0 && data.recentActivity.length === 0 &&
       data.plannedActions.today.length === 0 && data.plannedActions.week.length === 0 && (
        <div className="text-center py-16 text-text-light">
          <p className="text-lg mb-2">All clear</p>
          <p className="text-sm">No overdue actions or fading relationships. Nice.</p>
        </div>
      )}
    </div>
  )
}
