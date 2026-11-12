import { useParams } from 'react-router-dom'
import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

export default function DealerDetails() {
  const { dealerId } = useParams()

  return (
    <>
      <PageHeader title="Dealer Details" subtitle={`Dealer ${dealerId}`} />
      <ComingSoon
        title="Dealer details"
        note="Profile, sales history, orders, claims and forecast for this dealer will appear here."
      />
    </>
  )
}
