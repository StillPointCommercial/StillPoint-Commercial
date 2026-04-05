import { PageHeader } from '@/components/layout/page-header'
import { ImportWizard } from '@/components/import/import-wizard'

export default function ImportPage() {
  return (
    <div>
      <PageHeader title="Import Contacts" subtitle="Upload your address book" />
      <ImportWizard />
    </div>
  )
}
