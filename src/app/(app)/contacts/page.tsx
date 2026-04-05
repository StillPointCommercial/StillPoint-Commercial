import { PageHeader } from '@/components/layout/page-header'
import { ContactList } from '@/components/contacts/contact-list'

export default function ContactsPage() {
  return (
    <div>
      <PageHeader title="Contacts" subtitle="Your network" />
      <ContactList />
    </div>
  )
}
