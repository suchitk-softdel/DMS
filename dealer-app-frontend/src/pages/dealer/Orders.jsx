import SearchIcon from '@mui/icons-material/Search'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import InputAdornment from '@mui/material/InputAdornment'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import NewOrderDialog from '@/components/orders/NewOrderDialog'
import OrderDrawer from '@/components/orders/OrderDrawer'
import { hasPrices, statusLabel } from '@/components/orders/orderLabels'
import EmptyState from '@/components/patterns/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import StatusChip from '@/components/ui/StatusChip'
import { formatCurrency, formatDayMonth } from '@/lib/format'
import { useToast } from '@/lib/toast'
import { useAsyncData } from '@/lib/useAsyncData'
import { getOrders, getOrdersSummary } from '@/services/dataService'

// Orders, SRS v1.0 section 3.4 (FR-ORD-1 to 6). The app is dealer <->
// manufacturer only: the dealer sends an order request with quantities, the
// manufacturer approves it and quotes catalogue prices, the dealer accepts
// the quote and fulfils the order.

// Status groups for the filter pills (the exact status shows on each row).
// Must match ORDER_STAGES in the backend (src/services/orderService.js).
const STAGES = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts', statuses: ['draft'] },
  { value: 'open', label: 'In progress', statuses: ['submitted', 'approved', 'accepted'] },
  { value: 'done', label: 'Completed', statuses: ['fulfilled'] },
  { value: 'closed', label: 'Closed', statuses: ['rejected', 'declined'] },
]
// Quick actions from Home and Copilot open the form directly (?action=createOrder).
const OPEN_FORM_ACTIONS = ['createOrder', 'createQuote']
const COLUMNS = [
  { field: 'id', label: 'Order ID', sortable: true },
  { field: 'units', label: 'Quantity', align: 'right' },
  { field: 'total', label: 'Amount', align: 'right', sortable: true },
  { field: 'status', label: 'Status', sortable: true },
  { field: 'createdAt', label: 'Date', sortable: true },
]

const countFor = (counts, stage) =>
  (stage.statuses ?? Object.keys(counts.order)).reduce((sum, status) => sum + (counts.order[status] ?? 0), 0)

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [stage, setStage] = useState('all')
  // An exact status, set by the banners (e.g. requests waiting for the manufacturer).
  const [status, setStatus] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ field: 'createdAt', dir: 'desc' })
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  // The loaded page of orders; `key` says which request it answers, so the
  // table shows "loading" whenever the filters have moved on.
  const [list, setList] = useState({ key: null, items: [], total: 0, error: null })
  const [refresh, setRefresh] = useState(0)
  const [openOrderId, setOpenOrderId] = useState(null)
  const [formOpen, setFormOpen] = useState(() => OPEN_FORM_ACTIONS.includes(searchParams.get('action')))
  const toast = useToast()

  const { data: summary, reload: reloadSummary } = useAsyncData(getOrdersSummary)

  // Remove ?action= once used, so a page refresh does not open the form again.
  useEffect(() => {
    if (searchParams.has('action')) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])


  // ?search=… from the top-bar search fills this page's search box.
  const urlSearch = searchParams.get('search')
  const [appliedUrlSearch, setAppliedUrlSearch] = useState(null)
  if (urlSearch !== null && urlSearch !== appliedUrlSearch) {
    setAppliedUrlSearch(urlSearch)
    setSearchInput(urlSearch)
  }

  // ?order=ORD-123 (e.g. from a notification) opens that order.
  const linkedOrder = searchParams.get('order')
  const shownOrderId = openOrderId ?? linkedOrder
  const closeOrder = () => {
    setOpenOrderId(null)
    if (linkedOrder) setSearchParams({}, { replace: true })
  }

  // Search a moment after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const queryKey = JSON.stringify({
    type: 'order',
    stage: stage === 'all' || status ? undefined : stage,
    status: status ?? undefined,
    search: search || undefined,
    sort: sort.field,
    dir: sort.dir,
    limit: rowsPerPage,
    offset: page * rowsPerPage,
    refresh,
  })
  const loading = list.key !== queryKey

  useEffect(() => {
    let cancelled = false
    const request = JSON.parse(queryKey)
    delete request.refresh
    getOrders(request)
      .then((result) => !cancelled && setList({ key: queryKey, ...result, error: null }))
      .catch((error) => !cancelled && setList((previous) => ({ ...previous, key: queryKey, error })))
    return () => {
      cancelled = true
    }
  }, [queryKey])

  const reloadAll = useCallback(() => {
    setRefresh((n) => n + 1)
    reloadSummary()
  }, [reloadSummary])

  const setStageFilter = (value) => {
    setStage(value)
    setStatus(null)
    setPage(0)
  }
  const showStatus = (value) => {
    setStatus(value)
    setSearchInput('')
    setPage(0)
  }
  const toggleSort = (field) => {
    setSort((current) => ({ field, dir: current.field === field && current.dir === 'desc' ? 'asc' : 'desc' }))
    setPage(0)
  }

  const onCreated = (order) => {
    setFormOpen(false)
    toast(`Order ${order.id} ${order.status === 'draft' ? 'saved as draft' : 'sent to the manufacturer for a quote'}.`)
    reloadAll()
    setOpenOrderId(order.id)
  }

  const subtitle = summary ? `${summary.openOrders} open orders  ·  ${summary.awaitingApproval} waiting for the manufacturer` : ''

  return (
    <>
      <PageHeader title="Orders" subtitle={subtitle} />

      <Stack spacing={3}>
        {/* FR-ORD-6: requests waiting for the manufacturer */}
        {summary?.awaitingApproval > 0 && (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={() => showStatus('submitted')}>
                Show {summary.awaitingApproval === 1 ? 'it' : 'them'}
              </Button>
            }
          >
            {summary.awaitingApproval === 1 ? '1 order request is' : `${summary.awaitingApproval} order requests are`} waiting for the manufacturer.
          </Alert>
        )}
        {summary?.quotesToAccept > 0 && (
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" onClick={() => showStatus('approved')}>
                Review
              </Button>
            }
          >
            {summary.quotesToAccept === 1 ? '1 manufacturer quote is' : `${summary.quotesToAccept} manufacturer quotes are`} waiting for you to accept or decline.
          </Alert>
        )}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, flexWrap: 'wrap', rowGap: 2 }}>
          <Button variant="contained" size="large" onClick={() => setFormOpen(true)} sx={{ px: 3.5 }}>
            + New Order
          </Button>
          <TextField
            size="small"
            placeholder="Search order ID"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 220, maxWidth: { md: 360 } }}
            slotProps={{
              htmlInput: { 'aria-label': 'Search order ID' },
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

        {/* FR-ORD-3: status filter pills with counts */}
        <Stack direction="row" spacing={1.25} useFlexGap sx={{ flexWrap: 'wrap' }} role="group" aria-label="Status">
          {STAGES.map((st) => {
            const active = !status && stage === st.value
            const count = summary ? countFor(summary.counts, st) : null
            return (
              <Chip
                key={st.value}
                label={`${st.label}${count === null ? '' : ` (${count})`}`}
                onClick={() => setStageFilter(st.value)}
                aria-pressed={active}
                variant={active ? 'filled' : 'outlined'}
                color={active ? 'secondary' : 'default'}
                sx={{ px: 1, height: 36, fontSize: 15, fontWeight: 600, bgcolor: active ? undefined : 'background.paper' }}
              />
            )
          })}
          {status && (
            <Chip
              label={`Showing: ${statusLabel('order', status)} orders`}
              onDelete={() => setStageFilter('all')}
              color="primary"
              sx={{ height: 36, fontSize: 15, fontWeight: 600 }}
            />
          )}
        </Stack>

        <Card sx={{ position: 'relative' }}>
          {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} aria-label="Loading orders" />}
          {list.error ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="error" action={<Button onClick={reloadAll}>Retry</Button>}>
                {list.error.message}
              </Alert>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table sx={{ minWidth: 640 }}>
                  <TableHead>
                    <TableRow>
                      {COLUMNS.map((c) => (
                        <TableCell key={c.field} align={c.align} sortDirection={sort.field === c.field ? sort.dir : false}>
                          {c.sortable ? (
                            <TableSortLabel active={sort.field === c.field} direction={sort.field === c.field ? sort.dir : 'desc'} onClick={() => toggleSort(c.field)}>
                              {c.label}
                            </TableSortLabel>
                          ) : (
                            c.label
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {list.items.map((o) => (
                      <TableRow
                        key={o.id}
                        hover
                        onClick={() => setOpenOrderId(o.id)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpenOrderId(o.id))}
                        tabIndex={0}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{o.id}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {o.itemCount} {o.itemCount === 1 ? 'line' : 'lines'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {o.units} {o.units === 1 ? 'unit' : 'units'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {hasPrices(o) ? (
                            formatCurrency(o.total)
                          ) : (
                            <Typography component="span" variant="body2" color="text.secondary">
                              Awaiting quote
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={o.status} label={statusLabel(o.type, o.status)} sx={{ minWidth: 96, fontWeight: 600 }} />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {formatDayMonth(o.createdAt)} {new Date(o.createdAt).getFullYear()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {!loading && list.items.length === 0 && <EmptyState title="No matching orders" message="Try another status or search." />}
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

      {formOpen && <NewOrderDialog open onClose={() => setFormOpen(false)} onCreated={onCreated} />}
      <OrderDrawer key={shownOrderId ?? 'closed'} orderId={shownOrderId} onClose={closeOrder} onChanged={reloadAll} onOpenOrder={setOpenOrderId} />
    </>
  )
}
