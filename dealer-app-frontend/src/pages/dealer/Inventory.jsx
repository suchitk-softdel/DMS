import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

// SRS v1.0 section 3.5 (FR-INV-1 to 6)
export default function Inventory() {
  return (
    <>
      <PageHeader title="Inventory Intelligence" subtitle="Demand forecast and AI reorder recommendations" />
      <ComingSoon
        title="Inventory Intelligence"
        note="Inventory risk, demand vs. supply trends and ranked reorder recommendations will appear here."
      />
    </>
  )
}
