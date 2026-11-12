import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

export default function DealerList() {
  return (
    <>
      <PageHeader title="Dealers" subtitle="All dealers in the network" />
      <ComingSoon
        title="Dealer list"
        note="A searchable list of dealers with tier, status and risk will appear here. Each row will open the dealer's details."
      />
    </>
  )
}
