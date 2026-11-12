import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

// SRS v1.0 section 3.4 (FR-ORD-1 to 6)
export default function Orders() {
  return (
    <>
      <PageHeader title="Orders & Quotes" subtitle="Create, submit and track quotes and orders" />
      <ComingSoon
        title="Orders & Quotes"
        note="Quotes and orders with status filters, search and AI insights on likely-to-close quotes will appear here."
      />
    </>
  )
}
