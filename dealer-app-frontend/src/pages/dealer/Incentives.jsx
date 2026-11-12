import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

// SRS v1.0 section 3.6 (FR-INC-1 to 6)
export default function Incentives() {
  return (
    <>
      <PageHeader title="Incentives & Training" subtitle="Program earnings, milestones and certifications" />
      <ComingSoon
        title="Incentives & Training"
        note="Incentive progress, your peer rank, certifications, training courses and upcoming events will appear here."
      />
    </>
  )
}
