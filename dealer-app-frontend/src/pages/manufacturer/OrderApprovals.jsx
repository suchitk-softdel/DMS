import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import PaidOutlined from '@mui/icons-material/PaidOutlined'
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined'
import RequestQuoteOutlined from '@mui/icons-material/RequestQuoteOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { useNavigate } from 'react-router-dom'
import DealerMap from '@/components/orders/DealerMap'
import KpiGrid from '@/components/patterns/KpiGrid'
import SectionCard from '@/components/patterns/SectionCard'
import PageHeader from '@/components/ui/PageHeader'
import { ORDER_DETAILS_PATH } from '@/constants/modules'
import { formatCurrency } from '@/lib/format'
import { useAsyncData } from '@/lib/useAsyncData'
import { getApprovalSummary } from '@/services/dataService'

// Order Approvals (manufacturer login only): the overview of the dealer
// network. The orders themselves, with approve and reject, are on Order Details.

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

// Network tiles.
//   Revenue: total price of the orders the dealers confirmed (accepted or fulfilled)
//   Pipeline: total price of the quoted orders, waiting for the dealer
//   Dealers / Active: dealers in the network, and how many are active
//   Claims: all warranty claims of the network's dealers
function buildKpis({ network }) {
  const activePct = network.dealers ? Math.round((network.activeDealers / network.dealers) * 100) : 0
  return [
    {
      key: 'revenue',
      label: 'Revenue',
      value: formatCurrency(network.revenue.value, { compact: true }),
      accent: 'primary.main',
      icon: PaidOutlined,
      trend: { text: `${plural(network.revenue.orders, 'order')} accepted or fulfilled` },
    },
    {
      key: 'pipeline',
      label: 'Pipeline',
      value: formatCurrency(network.pipeline.value, { compact: true }),
      accent: 'warning.main',
      icon: RequestQuoteOutlined,
      trend: { text: `${plural(network.pipeline.orders, 'quote')} waiting for dealers` },
    },
    {
      key: 'dealers',
      label: 'Dealers',
      value: network.dealers,
      accent: 'secondary.main',
      icon: StorefrontOutlined,
      trend: { text: 'In your network' },
    },
    {
      key: 'active',
      label: 'Active',
      value: network.activeDealers,
      accent: 'success.main',
      icon: CheckCircleOutlined,
      trend: { text: `${activePct}% of dealers` },
    },
    {
      key: 'claims',
      label: 'Claims',
      value: network.claims,
      accent: 'error.main',
      icon: ReportProblemOutlined,
      trend: { text: 'All warranty claims' },
    },
  ]
}

export default function OrderApprovals() {
  const navigate = useNavigate()
  const { data: summary, error } = useAsyncData(getApprovalSummary)
  const subtitle = summary ? `${summary.manufacturer.name}  ·  your network of ${summary.dealers.length} dealers` : ''
  const waiting = summary?.pending

  return (
    <>
      <PageHeader title="Order Approvals" subtitle={subtitle} />
      <Stack spacing={3}>
        {error && <Alert severity="error">{error.message}</Alert>}
        <KpiGrid items={summary ? buildKpis(summary) : []} loading={!summary && !error} skeletonCount={5} columns={5} spacing={2.5} />
        {waiting && (
          <Alert
            severity={waiting.count === 0 ? 'success' : waiting.oldestDays > 2 ? 'warning' : 'info'}
            action={
              <Button color="inherit" sx={{ fontWeight: 700 }} onClick={() => navigate(`${ORDER_DETAILS_PATH}?queue=pending`)}>
                Open Order Details →
              </Button>
            }
          >
            {waiting.count === 0
              ? 'No orders waiting for approval.'
              : `${plural(waiting.count, 'order')} waiting for approval · ${formatCurrency(waiting.value, { compact: true })} · oldest ${plural(waiting.oldestDays, 'day')}`}
          </Alert>
        )}
        {summary && (
          <SectionCard title="Dealer locations" subtitle="Each pin is a dealer at its latitude and longitude. Click a pin for details.">
            <DealerMap dealers={summary.locations} />
          </SectionCard>
        )}
      </Stack>
    </>
  )
}
