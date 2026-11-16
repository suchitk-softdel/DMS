import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

// SRS v1.0 section 3.8 (FR-SC-1 to 5)
export default function SalesCoach() {
  return (
    <>
      <PageHeader title="Sales Coach" subtitle="Opportunity briefs, bundles and proposals" />
      <ComingSoon
        title="Sales Coach"
        note="Customer briefs, recommended bundles, win probability and draft proposals will appear here."
      />
    </>
  )
}
