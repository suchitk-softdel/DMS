import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

export default function ManufacturerDashboard() {
  return (
    <>
      <PageHeader title="Manufacturer Dashboard" subtitle="Dealer network at a glance" />
      <ComingSoon
        title="Manufacturer dashboard"
        note="Network-wide sales, order volume, at-risk dealers and forecast highlights will appear here."
      />
    </>
  )
}
