import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

export default function DealerSales() {
  return (
    <>
      <PageHeader title="Dealer Sales" subtitle="Sales performance per dealer" />
      <ComingSoon
        title="Dealer sales"
        note="Sales, revenue and profit by dealer, product and period will appear here."
      />
    </>
  )
}
