import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

export default function DealerOrders() {
  return (
    <>
      <PageHeader title="Dealer Orders" subtitle="Orders placed by each dealer" />
      <ComingSoon
        title="Dealer orders"
        note="Incoming orders from every dealer, with status and fulfilment tracking, will appear here."
      />
    </>
  )
}
