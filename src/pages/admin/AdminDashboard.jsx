import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

export default function AdminDashboard() {
  return (
    <>
      <PageHeader title="Admin" subtitle="Manage the dealer network, users and permissions" />
      <ComingSoon
        title="Admin dashboard"
        note="Dealer network overview, user management and the role permission matrix will appear here."
      />
    </>
  )
}
