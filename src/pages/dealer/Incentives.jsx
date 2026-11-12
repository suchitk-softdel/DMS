import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

export default function Incentives() {
  return (
    <>
      <PageHeader title="Incentives" subtitle="Rebates, spiffs and program earnings" />
      <ComingSoon
        title="Incentives"
        note="Active incentive programs, progress toward tiers and payout history will appear here."
      />
    </>
  )
}
