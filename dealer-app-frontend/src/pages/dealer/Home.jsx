import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'
import { usePermissions } from '@/lib/rbac'

// SRS v1.0 section 3.1 (FR-HOME-1 to 6)
export default function Home() {
  const { user } = usePermissions()

  return (
    <>
      <PageHeader title={`Welcome, ${user?.name ?? ''}`} subtitle="Your dealership at a glance" />
      <ComingSoon
        title="Home dashboard"
        note="KPIs (revenue, health score, open orders, pending claims), today's AI insight, quick actions and recent activity will appear here."
      />
    </>
  )
}
