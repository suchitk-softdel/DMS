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
import { hasPrices, NEXT_STEP, statusLabel, STEPS } from '@/components/orders/orderLabels'
import ReasonDialog from '@/components/orders/ReasonDialog'
import StatusChip from '@/components/ui/StatusChip'
import { formatCurrency, formatDate } from '@/lib/format'
import { createOrder, getOrder, updateOrderStatus } from '@/services/dataService'

/**
 * Side panel with one order request to the manufacturer: lines, quote total,
 * progress and the button that moves it to its next status (FR-ORD-1). A
 * rejected or declined order can be copied to a new request.
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
  const [declining, setDeclining] = useState(false) // declining the manufacturer's quote

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
  const next = order ? (NEXT_STEP[order.status] ?? null) : null
  const steps = STEPS

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

  const advance = () => setStatus(next.status)

  const setStatus = (status, reason) =>
    run(async () => {
      const updated = await updateOrderStatus(order.id, status, undefined, reason)
      setState({ order: updated, loading: false, error: null })
      setDeclining(false)
      onChanged(updated)
    })

  // Same lines as a new draft request, from a rejected or declined order.
  const copyToNewRequest = () =>
    run(async () => {
      const created = await createOrder({
        type: 'order',
        status: 'draft',
        items: order.items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
      })
      onChanged(created)
      onOpenOrder(created.id)
    })

  // Fulfilling adds the goods to stock and can't be undone, so ask first.
  const onNext = () => (next.status === 'fulfilled' ? setConfirm(next) : advance())

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
            {order ? 'Order' : 'Loading'}
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

              {order.status === 'declined' ? (
                <Alert severity="error">
                  <strong>You declined the manufacturer's quote</strong>
                  {order.dealerRespondedAt ? ` on ${formatDate(order.dealerRespondedAt)}` : ''}. Reason: {order.declineReason}
                </Alert>
              ) : order.status === 'rejected' ? (
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
              {order.status === 'submitted' && (
                <Alert severity="info">Waiting for the manufacturer to approve this request and send a quote.</Alert>
              )}
              {order.status === 'approved' && (
                <Alert severity="success">
                  <strong>Quote received</strong> from {order.reviewedBy?.name ?? 'the manufacturer'}
                  {order.reviewedAt ? ` on ${formatDate(order.reviewedAt)}` : ''}. Review the prices below, then accept or decline.
                </Alert>
              )}
              {order.status === 'accepted' && (
                <Alert severity="success">
                  You accepted the quote{order.dealerRespondedAt ? ` on ${formatDate(order.dealerRespondedAt)}` : ''}
                  {order.dealerRespondedBy ? ` (${order.dealerRespondedBy.name})` : ''}. Mark it fulfilled when the goods arrive.
                </Alert>
              )}


              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        Qty
                      </TableCell>
                      {hasPrices(order) && (
                        <>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            Price
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            Amount
                          </TableCell>
                        </>
                      )}
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
                        {hasPrices(order) && (
                          <>
                            <TableCell align="right">{formatCurrency(item.unitPrice, { decimals: 2 })}</TableCell>
                            <TableCell align="right">{formatCurrency(item.quantity * item.unitPrice, { decimals: 2 })}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                    {hasPrices(order) ? (
                      <TableRow>
                        <TableCell colSpan={3} sx={{ fontWeight: 700, borderBottom: 0 }}>
                          Quote total
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: 18, borderBottom: 0 }}>
                          {formatCurrency(order.total, { decimals: 2 })}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} sx={{ color: 'text.secondary', borderBottom: 0 }}>
                          Prices will be quoted by the manufacturer from the catalogue.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>

              {actionError && <Alert severity="error">{actionError}</Alert>}
              {order.status === 'fulfilled' && (
                <Alert severity="success">Fulfilled and added to your stock. Register its equipment units on the Warranty page.</Alert>
              )}
            </Stack>
          )}
        </AsyncContent>
      </Box>

      {order && (next || ['approved', 'rejected', 'declined'].includes(order.status)) && (
        <Stack direction="row" spacing={1.5} sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider', justifyContent: 'flex-end' }}>
          {order.status === 'approved' && (
            <>
              <Button variant="outlined" color="error" size="large" onClick={() => setDeclining(true)} disabled={busy}>
                Decline
              </Button>
              <Button variant="contained" size="large" onClick={() => setStatus('accepted')} loading={busy}>
                Accept quote
              </Button>
            </>
          )}
          {next && (
            <Button variant="contained" size="large" onClick={onNext} loading={busy}>
              {next.label}
            </Button>
          )}
          {['rejected', 'declined'].includes(order.status) && (
            <Button variant="contained" size="large" onClick={copyToNewRequest} loading={busy}>
              Copy to a new request
            </Button>
          )}
        </Stack>
      )}

      <ReasonDialog
        open={declining}
        title={`Decline the quote for ${order?.id}?`}
        message="The manufacturer will see your reason."
        reasons={['Price too high', 'Ordered elsewhere', 'Quantities changed']}
        confirmLabel="Decline quote"
        busy={busy}
        error={declining ? actionError : null}
        onConfirm={(reason) => setStatus('declined', reason)}
        onCancel={() => setDeclining(false)}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={`Mark ${order?.id} as fulfilled?`}
        message="The goods will be added to your stock. You can then register its equipment units for warranty. This can't be undone."
        confirmLabel="Mark fulfilled"
        loading={busy}
        onConfirm={() => advance()}
        onCancel={() => setConfirm(null)}
      />
    </Drawer>
  )
}
