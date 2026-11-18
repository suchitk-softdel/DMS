import SearchIcon from '@mui/icons-material/Search'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
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
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import NewOrderDialog from '@/components/orders/NewOrderDialog'
import OrderDrawer from '@/components/orders/OrderDrawer'
import { hasPrices, STATUS_LABELS, statusLabel, TYPE_LABELS } from '@/components/orders/orderLabels'
import EmptyState from '@/components/patterns/EmptyState'
import NameWithInitial from '@/components/ui/NameWithInitial'
import PageHeader from '@/components/ui/PageHeader'
import SectionTitle from '@/components/ui/SectionTitle'
import StatusChip from '@/components/ui/StatusChip'
import { MODULE_PATHS } from '@/constants/modules'
import { formatCurrency, formatDayMonth } from '@/lib/format'
import { usePermissions } from '@/lib/rbac'
import { useToast } from '@/lib/toast'
import { useAsyncData } from '@/lib/useAsyncData'
import { getOrders, getOrdersSummary } from '@/services/dataService'

// Orders & Quotes, SRS v1.0 section 3.4 (FR-ORD-1 to 6), laid out as in the
// UI Design Concept: filters and the order list on the left, the Order
// Insight on the right.

const TYPES = [
  { value: 'all', label: 'All' },
  { value: 'order', label: 'Orders' },
  { value: 'quote', label: 'Quotes' },
]
const STATUSES = ['all', 'draft', 'submitted', 'approved', 'accepted', 'fulfilled', 'rejected', 'declined']
const ACTION_DIALOG = { createQuote: 'quote', createOrder: 'order' }
const COLUMNS = [
  { field: 'id', label: 'Order ID' },
  { field: 'customer', label: 'Customer' },
  { field: 'total', label: 'Amount', align: 'right' },
  { field: 'status', label: 'Status' },
  { field: 'createdAt', label: 'Date' },
]

// How many records match the type and status filters (for the status pills).
function countFor(counts, type, status) {
  const types = type === 'all' ? ['order', 'quote'] : [type]
  return types.reduce((sum, t) => {
    const byStatus = counts[t]
    return sum + (status === 'all' ? Object.values(byStatus).reduce((a, b) => a + b, 0) : (byStatus[status] ?? 0))
  }, 0)
}

export default function Orders() {
  const { can } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
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
  // Quick actions from Home and Copilot open the form directly (?action=createQuote).
  const [dialog, setDialog] = useState(() => ACTION_DIALOG[searchParams.get('action')] ?? null) // 'quote' | 'order' | null
  const toast = useToast()

  const { data: summary, reload: reloadSummary } = useAsyncData(getOrdersSummary)

  // Remove ?action= once used, so a page refresh does not open the form again.
  useEffect(() => {
    if (searchParams.has('action')) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

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

  const query = {
    type: type === 'all' ? undefined : type,
    status: status === 'all' ? undefined : status,
    search: search || undefined,
    sort: sort.field,
    dir: sort.dir,
    limit: rowsPerPage,
    offset: page * rowsPerPage,
  }
  const queryKey = JSON.stringify({ ...query, refresh })
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

  const changeFilter = (setter) => (value) => {
    setter(value)
    setPage(0)
  }
  const setTypeFilter = changeFilter(setType)
  const setStatusFilter = changeFilter(setStatus)
  const toggleSort = (field) => {
    setSort((current) => ({ field, dir: current.field === field && current.dir === 'desc' ? 'asc' : 'desc' }))
    setPage(0)
  }
  const showAwaiting = () => {
    setType('order')
    setStatus('submitted')
    setSearchInput('')
    setPage(0)
  }

  const onCreated = (order) => {
    setDialog(null)
    toast(`${TYPE_LABELS[order.type]} ${order.id} ${order.status === 'draft' ? 'saved as draft' : order.type === 'quote' ? 'sent to the customer' : 'sent to the manufacturer for a quote'}.`)
    reloadAll()
    setOpenOrderId(order.id)
  }

  const subtitle = summary ? `${summary.openOrders} open orders  ·  ${summary.awaitingApproval} awaiting approval` : ''
  // Customer quotes only go draft -> sent -> accepted, so the order-only pills are hidden for them.
  const statuses = type === 'quote' ? STATUSES.filter((s) => !['accepted', 'fulfilled', 'rejected', 'declined'].includes(s)) : STATUSES
  const showQuotesToAccept = () => {
    setType('order')
    setStatus('approved')
    setSearchInput('')
    setPage(0)
  }
  const insight = summary?.insight

  return (
    <>
      <PageHeader title="Orders & Quotes" subtitle={subtitle} />

      <Stack spacing={3}>
        {/* FR-ORD-6: orders awaiting approval */}
        {summary?.awaitingApproval > 0 && (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={showAwaiting}>
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
              <Button color="inherit" size="small" onClick={showQuotesToAccept}>
                Review
              </Button>
            }
          >
            {summary.quotesToAccept === 1 ? '1 manufacturer quote is' : `${summary.quotesToAccept} manufacturer quotes are`} waiting for you to accept or decline.
          </Alert>
        )}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, flexWrap: 'wrap', rowGap: 2 }}>
          <Stack direction="row" spacing={1.5}>
            <Button variant="contained" size="large" onClick={() => setDialog('quote')} sx={{ px: 3.5 }}>
              + New Quote
            </Button>
            <Button variant="outlined" size="large" onClick={() => setDialog('order')}>
              + New Order
            </Button>
          </Stack>
          <ToggleButtonGroup exclusive size="small" value={type} onChange={(_, v) => v && setTypeFilter(v)} aria-label="Type">
            {TYPES.map((t) => (
              <ToggleButton key={t.value} value={t.value} sx={{ px: 2 }}>
                {t.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <TextField
            size="small"
            placeholder="Search order ID or customer"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 220, maxWidth: { md: 360 } }}
            slotProps={{
              htmlInput: { 'aria-label': 'Search order ID or customer' },
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
          {statuses.map((s) => {
            const active = status === s
            const count = summary ? countFor(summary.counts, type, s) : null
            return (
              <Chip
                key={s}
                label={`${s === 'all' ? 'All' : type === 'all' ? STATUS_LABELS[s] : statusLabel(type, s)}${count === null ? '' : ` (${count})`}`}
                onClick={() => setStatusFilter(s)}
                aria-pressed={active}
                variant={active ? 'filled' : 'outlined'}
                color={active ? 'secondary' : 'default'}
                sx={{ px: 1, height: 36, fontSize: 15, fontWeight: 600, bgcolor: active ? undefined : 'background.paper' }}
              />
            )
          })}
        </Stack>

        <Grid container spacing={3.5}>
          <Grid size={{ xs: 12, lg: 8 }}>
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
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                          {COLUMNS.map((c) => (
                            <TableCell key={c.field} align={c.align} sortDirection={sort.field === c.field ? sort.dir : false} sx={{ fontWeight: 600 }}>
                              <TableSortLabel active={sort.field === c.field} direction={sort.field === c.field ? sort.dir : 'desc'} onClick={() => toggleSort(c.field)}>
                                {c.label}
                              </TableSortLabel>
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
                                {TYPE_LABELS[o.type]} · {o.itemCount} {o.itemCount === 1 ? 'line' : 'lines'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <NameWithInitial name={o.customer.name} />
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
                  {!loading && list.items.length === 0 && (
                    <EmptyState title="No matching orders" message="Try another status, type or search." />
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
          </Grid>

          {/* FR-ORD-5: Order Insight on quotes likely to close */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Box component="section" aria-label="Order insight" sx={{ bgcolor: 'brand.tealDark', color: 'common.white', borderRadius: 1.5, p: { xs: 2.5, md: 3.5 } }}>
              <SectionTitle sx={{ color: 'common.white', mb: 2 }}>Order Insight</SectionTitle>
              {insight ? (
                <>
                  <Typography sx={{ fontSize: 18, lineHeight: 1.5 }}>{insight.message}</Typography>
                  {insight.likely.length > 0 && (
                    <Stack spacing={1} sx={{ mt: 2.5 }}>
                      {insight.likely.map((q) => (
                        <Box
                          key={q.id}
                          component="button"
                          type="button"
                          onClick={() => setOpenOrderId(q.id)}
                          sx={{
                            all: 'unset',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 2,
                            px: 2,
                            py: 1.25,
                            borderRadius: 1,
                            bgcolor: 'rgba(255,255,255,0.12)',
                            '&:hover, &:focus-visible': { bgcolor: 'rgba(255,255,255,0.2)' },
                          }}
                        >
                          <span>
                            <strong>{q.id}</strong> · {q.customer}
                          </span>
                          <span style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{Math.round(q.probability * 100)}%</span>
                        </Box>
                      ))}
                    </Stack>
                  )}
                  <Typography sx={{ mt: 2.5, fontSize: 14, fontStyle: 'italic', opacity: 0.85 }}>
                    Evidence: {insight.evidence.join(' · ')}
                  </Typography>
                  {can(insight.action.module) && (
                    <Button
                      component={RouterLink}
                      to={MODULE_PATHS[insight.action.module]}
                      fullWidth
                      sx={{ mt: 3, height: 52, borderRadius: 1, bgcolor: 'common.white', color: 'brand.tealDark', fontSize: 16, '&:hover': { bgcolor: 'grey.100' } }}
                    >
                      {insight.action.label}
                    </Button>
                  )}
                </>
              ) : (
                <Typography sx={{ fontSize: 17 }}>{summary ? 'No open quotes right now.' : 'Loading…'}</Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Stack>

      {dialog && <NewOrderDialog open type={dialog} onClose={() => setDialog(null)} onCreated={onCreated} />}
      <OrderDrawer
        key={shownOrderId ?? 'closed'}
        orderId={shownOrderId}
        onClose={closeOrder}
        onChanged={reloadAll}
        onOpenOrder={setOpenOrderId}
      />
    </>
  )
}
