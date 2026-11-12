import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'
import { usePermissions } from '@/lib/rbac'

export default function Home() {
  const { user } = usePermissions()

  return (
    <>
      <PageHeader title={`Welcome, ${user?.name ?? ''}`} subtitle="Your dealership at a glance" />
      <ComingSoon
        title="Home dashboard"
        note="KPIs, alerts and quick actions for your dealership will appear here."
      />
    </>
  )
}
