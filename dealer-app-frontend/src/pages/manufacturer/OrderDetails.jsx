import SearchIcon from '@mui/icons-material/Search'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import InputAdornment from '@mui/material/InputAdornment'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ApprovalDrawer from '@/components/orders/ApprovalDrawer'
import OrderDeskInsights from '@/components/orders/OrderDeskInsights'
import EmptyState from '@/components/patterns/EmptyState'
import NameWithInitial from '@/components/ui/NameWithInitial'
import PageHeader from '@/components/ui/PageHeader'
import StatusChip from '@/components/ui/StatusChip'
import { formatCurrency, formatDate } from '@/lib/format'
import { useToast } from '@/lib/toast'
import { useAsyncData } from '@/lib/useAsyncData'
import { getApprovalSummary, getNetworkOrders, getOrderDeskInsights } from '@/services/dataService'

// Order Details (manufacturer login only): the list of orders dealers send to
// the manufacturer. The order desk opens an order to approve or reject it with
// a reason; the dealer then fulfils the approved ones. The network tiles are on
// Order Approvals.

// Status names from the order desk's point of view.
const DESK_LABELS = { approved: 'Quoted', accepted: 'Accepted', declined: 'Declined by dealer', rejected: 'Rejected', fulfilled: 'Fulfilled' }
const DAY_MS = 24 * 60 * 60 * 1000
const daysWaiting = (date) => Math.floor((Date.now() - new Date(date)) / DAY_MS)

// The order lists (Show filter).
const QUEUES = [
  { value: 'pending', label: 'Waiting', count: (c) => c.pending },
  { value: 'approved', label: 'Quoted', count: (c) => c.approved },
  { value: 'accepted', label: 'Accepted', count: (c) => c.accepted },
  { value: 'fulfilled', label: 'Fulfilled', count: (c) => c.fulfilled },
  { value: 'closed', label: 'Rejected / declined', count: (c) => c.closed },
]

export default function OrderDetails() {
  // ?order=ORD-123 (e.g. from a notification) opens that order; ?queue=pending
  // (from Order Approvals) opens that list.
  const [searchParams, setSearchParams] = useSearchParams()
  // Quoted orders show first when the page opens, unless the link names a list.
  const [queue, setQueue] = useState(() => (QUEUES.some((q) => q.value === searchParams.get('queue')) ? searchParams.get('queue') : 'approved'))
  const [dealerId, setDealerId] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [list, setList] = useState({ key: null, items: [], total: 0, error: null })
  const [refresh, setRefresh] = useState(0)
  const [openOrderId, setOpenOrderId] = useState(null)
  const linkedOrder = searchParams.get('order')
  const shownOrderId = openOrderId ?? linkedOrder
  // ?search=… from the top-bar search fills this page's search box.
  const urlSearch = searchParams.get('search')
  const [appliedUrlSearch, setAppliedUrlSearch] = useState(null)
  if (urlSearch !== null && urlSearch !== appliedUrlSearch) {
    setAppliedUrlSearch(urlSearch)
    setSearchInput(urlSearch)
  }

  const closeOrder = () => {
    setOpenOrderId(null)
    if (linkedOrder) setSearchParams({}, { replace: true })
  }
  const toast = useToast()

  const { data: summary, error: summaryError, reload: reloadSummary } = useAsyncData(getApprovalSummary)
  const { data: insights, error: insightsError, reload: reloadInsights } = useAsyncData(getOrderDeskInsights)

  // Search a moment after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const queryKey = JSON.stringify({
    queue,
    dealerId: dealerId === 'all' ? undefined : dealerId,
    search: search || undefined,
    limit: rowsPerPage,
    offset: page * rowsPerPage,
    refresh,
  })
  const loading = list.key !== queryKey

  useEffect(() => {
    let cancelled = false
    const request = JSON.parse(queryKey)
    delete request.refresh
    getNetworkOrders(request)
      .then((result) => !cancelled && setList({ key: queryKey, ...result, error: null }))
      .catch((error) => !cancelled && setList((previous) => ({ ...previous, key: queryKey, error })))
    return () => {
      cancelled = true
    }
  }, [queryKey])

  const onDecided = useCallback(
    (order) => {
      toast(
        order.status === 'approved'
          ? `${order.id} approved. Quote sent to ${order.dealer.name}.`
          : `${order.id} rejected. ${order.dealer.name} will see the reason.`,
      )
      setRefresh((n) => n + 1)
      reloadSummary()
      reloadInsights()
    },
    [reloadInsights, reloadSummary, toast],
  )

  const showQueue = (value) => {
    setQueue(value)
    setPage(0)
  }
  const dealerName = summary?.dealers.find((d) => d.id === dealerId)?.name
  const pendingQueue = queue === 'pending'
  const subtitle = summary ? `${summary.manufacturer.name}  ·  orders sent by your ${summary.dealers.length} dealers` : ''

  return (
    <>
      <PageHeader title="Order Details" subtitle={subtitle} />

      <Stack spacing={3}>
        {summaryError && <Alert severity="error">{summaryError.message}</Alert>}
        <OrderDeskInsights summary={summary} insights={insights} error={insightsError} onQueue={showQueue} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, flexWrap: 'wrap', rowGap: 2 }}>
          <TextField
            select
            size="small"
            label="Show"
            value={queue}
            onChange={(e) => showQueue(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            {QUEUES.map((q) => (
              <MenuItem key={q.value} value={q.value}>
                {summary ? `${q.label} (${q.count(summary.counts)})` : q.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Dealer"
            value={dealerId}
            onChange={(e) => {
              setDealerId(e.target.value)
              setPage(0)
            }}
            sx={{ minWidth: 260 }}
          >
            <MenuItem value="all">All dealers</MenuItem>
            {(summary?.dealers ?? []).map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name}
                {d.pending ? ` · ${d.pending} waiting` : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            placeholder="Search order or dealer"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 220, maxWidth: { md: 360 } }}
            slotProps={{
              htmlInput: { 'aria-label': 'Search order or dealer' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Stack>

        <Card sx={{ position: 'relative' }}>
          {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} aria-label="Loading orders" />}
          {list.error ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="error" action={<Button onClick={() => setRefresh((n) => n + 1)}>Retry</Button>}>
                {list.error.message}
              </Alert>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table sx={{ minWidth: 800, tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '16%' }}>Order ID</TableCell>
                      <TableCell sx={{ width: '29%' }}>Dealer</TableCell>
                      <TableCell sx={{ width: '14%' }}>Date</TableCell>
                      <TableCell align="right" sx={{ width: '11%' }}>
                        Quantity
                      </TableCell>
                      <TableCell align="right" sx={{ width: '14%' }}>
                        Amount
                      </TableCell>
                      <TableCell sx={{ width: '16%', pl: 4 }}>{pendingQueue ? 'Waiting' : 'Status'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {list.items.map((o) => {
                      const waited = daysWaiting(o.createdAt)
                      return (
                        <TableRow
                          key={o.id}
                          hover
                          tabIndex={0}
                          onClick={() => setOpenOrderId(o.id)}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpenOrderId(o.id))}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            <Typography sx={{ fontWeight: 600 }}>{o.id}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {o.itemCount} {o.itemCount === 1 ? 'line' : 'lines'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <NameWithInitial name={o.dealer.name} secondary={`${o.dealer.city}, ${o.dealer.state}`} />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(o.createdAt)}</TableCell>
                          <TableCell align="right">
                            {o.units} {o.units === 1 ? 'unit' : 'units'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatCurrency(o.total)}
                          </TableCell>
                          <TableCell sx={{ pl: 4 }}>
                            {pendingQueue ? (
                              <Typography sx={{ fontWeight: 700, color: waited > 2 ? 'error.main' : 'text.primary' }}>
                                {waited} {waited === 1 ? 'day' : 'days'}
                              </Typography>
                            ) : (
                              <Box>
                                <StatusChip status={o.status} label={DESK_LABELS[o.status]} sx={{ fontWeight: 600 }} />
                                {(o.dealerRespondedAt ?? o.reviewedAt) && (
                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {formatDate(o.dealerRespondedAt ?? o.reviewedAt)}
                                  </Typography>
                                )}
                                {(o.rejectionReason ?? o.declineReason) && (
                                  <Typography variant="body2" color="error.main" sx={{ mt: 0.5 }} noWrap title={o.rejectionReason ?? o.declineReason}>
                                    {o.rejectionReason ?? o.declineReason}
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              {!loading && list.items.length === 0 && (
                <EmptyState
                  title={pendingQueue ? 'Nothing waiting' : 'No orders here'}
                  message={
                    search
                      ? 'No orders match your search.'
                      : dealerName
                        ? `No ${pendingQueue ? 'orders waiting' : 'orders here'} from ${dealerName}.`
                        : pendingQueue
                          ? 'Every order from your dealers has been decided.'
                          : 'Try another dealer or search.'
                  }
                />
              )}
              <TablePagination
                component="div"
                count={list.total}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(Number(e.target.value))
                  setPage(0)
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </>
          )}
        </Card>
      </Stack>

      <ApprovalDrawer key={shownOrderId ?? 'closed'} orderId={shownOrderId} onClose={closeOrder} onDecided={onDecided} />
    </>
  )
}
