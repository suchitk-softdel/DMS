import CloseIcon from '@mui/icons-material/Close'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import AsyncContent from '@/components/patterns/AsyncContent'
import ConfirmDialog from '@/components/patterns/ConfirmDialog'
import AcceptQuoteDialog from '@/components/orders/AcceptQuoteDialog'
import { acceptanceLabel, NEXT_STEP, statusLabel, STEPS, TYPE_LABELS } from '@/components/orders/orderLabels'
import StatusChip from '@/components/ui/StatusChip'
import { formatCurrency, formatDate } from '@/lib/format'
import { createOrder, getOrder, updateOrderStatus } from '@/services/dataService'

/**
 * Side panel with one order or quote: customer, lines, total, progress and the
 * button that moves it to its next status (FR-ORD-1). An accepted quote can be
 * turned into an order with the same lines.
 *
 * orderId: the order to show, or null to close. onChanged(order) after a change;
 * onOpenOrder(id) to switch the panel to another order (e.g. the new order).
 * Give it `key={orderId}`, so each order starts with a fresh panel.
 */
export default function OrderDrawer({ orderId, onClose, onChanged, onOpenOrder }) {
  const [state, setState] = useState({ order: null, loading: Boolean(orderId), error: null })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [confirm, setConfirm] = useState(null) // the step waiting for confirmation
  const [accepting, setAccepting] = useState(false) // recording the customer's acceptance of a quote

  useEffect(() => {
    if (!orderId) return undefined
    let cancelled = false
    getOrder(orderId)
      .then((order) => !cancelled && setState({ order, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ order: null, loading: false, error }))
    return () => {
      cancelled = true
    }
  }, [orderId])

  const { order } = state
  const next = order ? NEXT_STEP[order.type][order.status] : null
  const steps = order ? STEPS[order.type] : []

  const run = async (action) => {
    setBusy(true)
    setActionError(null)
    try {
      await action()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const advance = (acceptance) =>
    run(async () => {
      const updated = await updateOrderStatus(order.id, next.status, acceptance)
      setState({ order: updated, loading: false, error: null })
      setAccepting(false)
      onChanged(updated)
    })

  // Same customer and lines as a new order: from an accepted quote (sent to
  // the manufacturer straight away) or from a rejected order (a draft to fix).
  const copyToOrder = (status) =>
    run(async () => {
      const created = await createOrder({
        type: 'order',
        customerId: order.customer.id,
        status,
        items: order.items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
      })
      onChanged(created)
      onOpenOrder(created.id)
    })

  // Fulfilling changes revenue and registers warranty units, so ask first.
  // Accepting a quote asks how and by whom the customer accepted.
  const onNext = () => {
    if (next.status === 'fulfilled') setConfirm(next)
    else if (order.type === 'quote' && next.status === 'approved') {
      setActionError(null)
      setAccepting(true)
    } else advance()
  }

  return (
    <Drawer
      anchor="right"
      open={Boolean(orderId)}
      onClose={busy ? undefined : onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 560 } } } }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {order ? TYPE_LABELS[order.type] : 'Loading'}
          </Typography>
          <Typography component="h2" sx={{ fontSize: 24, fontWeight: 700 }}>
            {orderId}
          </Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} disabled={busy}>
          <CloseIcon />
        </IconButton>
      </Stack>

      <Box sx={{ p: 3, overflowY: 'auto', flexGrow: 1 }}>
        <AsyncContent loading={state.loading} error={state.error}>
          {order && (
            <Stack spacing={3}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusChip status={order.status} label={statusLabel(order.type, order.status)} size="medium" />
                <Typography color="text.secondary">Created {formatDate(order.createdAt)}</Typography>
              </Stack>

              {order.status === 'rejected' ? (
                <Alert severity="error">
                  <strong>Rejected by {order.reviewedBy?.name ?? 'the manufacturer'}</strong>
                  {order.reviewedAt ? ` on ${formatDate(order.reviewedAt)}` : ''}. Reason: {order.rejectionReason}
                </Alert>
              ) : (
                <Stepper activeStep={steps.indexOf(order.status)} alternativeLabel>
                  {steps.map((s) => (
                    <Step key={s} completed={steps.indexOf(s) <= steps.indexOf(order.status)}>
                      <StepLabel>{statusLabel(order.type, s)}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              )}
              {order.type === 'order' && order.status === 'submitted' && (
                <Alert severity="info">Waiting for the manufacturer to approve this order.</Alert>
              )}
              {order.type === 'quote' && order.status === 'submitted' && (
                <Alert severity="info">Waiting for the customer's answer. When they accept, record it with "Customer accepted".</Alert>
              )}
              {order.type === 'quote' && order.status === 'approved' && (
                <Alert severity="success">
                  <strong>Accepted by customer</strong>
                  {order.acceptanceContact ? ` · ${order.acceptanceContact}` : ''}
                  {order.acceptanceMethod ? ` · by ${acceptanceLabel(order.acceptanceMethod)}` : ''}
                  {order.reviewedAt ? ` · ${formatDate(order.reviewedAt)}` : ''}
                  {order.reviewedBy ? ` · recorded by ${order.reviewedBy.name}` : ''}
                  {order.acceptanceNote && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Note: {order.acceptanceNote}
                    </Typography>
                  )}
                </Alert>
              )}
              {order.type === 'order' && order.status === 'approved' && order.reviewedAt && (
                <Alert severity="success">
                  Approved by {order.reviewedBy?.name ?? 'the manufacturer'} on {formatDate(order.reviewedAt)}. Mark it fulfilled once
                  it is installed.
                </Alert>
              )}

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Customer
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{order.customer.name}</Typography>
                <Typography color="text.secondary">
                  {order.customer.type === 'commercial' ? 'Commercial' : 'Residential'} · {order.customer.city}
                </Typography>
              </Box>

              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        Qty
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        Price
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        Amount
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{item.product.sku}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.product.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(item.unitPrice, { decimals: 2 })}</TableCell>
                        <TableCell align="right">{formatCurrency(item.quantity * item.unitPrice, { decimals: 2 })}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} sx={{ fontWeight: 700, borderBottom: 0 }}>
                        Total
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 18, borderBottom: 0 }}>
                        {formatCurrency(order.total, { decimals: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>

              {actionError && <Alert severity="error">{actionError}</Alert>}
              {order.type === 'order' && order.status === 'fulfilled' && (
                <Alert severity="success">Fulfilled: counted in revenue, and its equipment units are registered for warranty.</Alert>
              )}
            </Stack>
          )}
        </AsyncContent>
      </Box>

      {order && (next || (order.type === 'quote' && order.status === 'approved') || order.status === 'rejected') && (
        <Stack direction="row" spacing={1.5} sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider', justifyContent: 'flex-end' }}>
          {next && (
            <Button variant="contained" size="large" onClick={onNext} loading={busy}>
              {next.label}
            </Button>
          )}
          {order.type === 'quote' && order.status === 'approved' && (
            <Button variant="contained" size="large" onClick={() => copyToOrder('submitted')} loading={busy}>
              Create order from quote
            </Button>
          )}
          {order.status === 'rejected' && (
            <Button variant="contained" size="large" onClick={() => copyToOrder('draft')} loading={busy}>
              Copy to a new draft
            </Button>
          )}
        </Stack>
      )}

      <AcceptQuoteDialog
        open={accepting}
        quote={order}
        busy={busy}
        error={accepting ? actionError : null}
        onConfirm={(acceptance) => advance(acceptance)}
        onCancel={() => setAccepting(false)}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={`Mark ${order?.id} as fulfilled?`}
        message="The order will count in revenue, and each equipment unit is registered for warranty. This can't be undone."
        confirmLabel="Mark fulfilled"
        loading={busy}
        onConfirm={advance}
        onCancel={() => setConfirm(null)}
      />
    </Drawer>
  )
}
