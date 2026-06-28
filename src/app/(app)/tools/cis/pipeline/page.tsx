import { PageHeader } from '@/components/layout/page-header'
import { KanbanBoard } from '@/components/pipeline/kanban-board'
import { PipelineSummary } from '@/components/pipeline/pipeline-summary'

export default function PipelinePage() {
  return (
    <div>
      <PageHeader title="Pipeline" subtitle="Opportunity tracker" />
      <PipelineSummary />
      <KanbanBoard />
    </div>
  )
}
