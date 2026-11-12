import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

export default function Inventory() {
  return (
    <>
      <PageHeader title="Inventory" subtitle="Stock levels and product availability" />
      <ComingSoon
        title="Inventory"
        note="On-hand stock, distributor availability and reorder suggestions will appear here."
      />
    </>
  )
}
