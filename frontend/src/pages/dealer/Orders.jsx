import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

export default function Orders() {
  return (
    <>
      <PageHeader title="Orders" subtitle="Place and track equipment orders" />
      <ComingSoon
        title="Orders"
        note="Order history, order status tracking and new order entry will appear here."
      />
    </>
  )
}
