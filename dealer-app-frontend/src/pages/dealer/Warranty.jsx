import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

// SRS v1.0 section 3.7 (FR-WAR-1 to 5)
export default function Warranty() {
  return (
    <>
      <PageHeader title="Warranty & Claims" subtitle="Register warranties and track claims" />
      <ComingSoon
        title="Warranty & Claims"
        note="Warranty registration, claim submission and a claims board (Submitted, Under Review, Approved, Reimbursed) will appear here."
      />
    </>
  )
}
