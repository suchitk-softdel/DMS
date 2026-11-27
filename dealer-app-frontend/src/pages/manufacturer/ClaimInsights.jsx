import DealerClaimInsights from '@/components/orders/DealerClaimInsights'
import PageHeader from '@/components/ui/PageHeader'

// Manufacturer's Claim Insights: warranty claim patterns across its dealers
// (claim rate per 100 units, risk level, dealers to review and investigations).
export default function ClaimInsights() {
  return (
    <>
      <PageHeader title="Claim Insights" subtitle="Warranty claim patterns across your dealers" />
      <DealerClaimInsights />
    </>
  )
}
