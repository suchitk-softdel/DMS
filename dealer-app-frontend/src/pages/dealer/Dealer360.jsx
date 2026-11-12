import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

// SRS v1.0 section 3.3 (FR-D360-1 to 6)
export default function Dealer360() {
  return (
    <>
      <PageHeader title="Dealer 360" subtitle="Your performance, health score and history" />
      <ComingSoon
        title="Dealer 360"
        note="Revenue, growth, an explainable health score, AI recommendations and your dealer timeline will appear here."
      />
    </>
  )
}
