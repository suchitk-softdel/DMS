import ComingSoon from '@/components/ui/ComingSoon'
import PageHeader from '@/components/ui/PageHeader'

export default function Forecasting() {
  return (
    <>
      <PageHeader title="Forecasting" subtitle="Demand forecast and replenishment suggestions" />
      <ComingSoon
        title="Forecasting"
        note="November and December demand forecasts per dealer, forecast accuracy and suggested order quantities will appear here."
      />
    </>
  )
}
