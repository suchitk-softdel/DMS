import CloseIcon from '@mui/icons-material/Close'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import AsyncContent from '@/components/patterns/AsyncContent'
import { REJECTION_REASONS } from '@/components/orders/orderLabels'
import StatusChip from '@/components/ui/StatusChip'
import { formatCurrency, formatDate } from '@/lib/format'
import { approveOrder, getNetworkOrder, rejectOrder } from '@/services/dataService'

const MIN_REASON = 3
// Status names from the order desk's point of view.
const DESK_LABELS = {
  submitted: 'Waiting for approval',
  approved: 'Quoted',
  accepted: 'Accepted by dealer',
  declined: 'Declined by dealer',
  rejected: 'Rejected',
  fulfilled: 'Fulfilled',
}

/**
 * Manufacturer's view of one dealer order: dealer, customer, lines and total,
 * with Approve and Reject (a reason is required and shown to the dealer).
 * Give it `key={orderId}` so each order starts with a fresh panel.
 * onDecided(order) after an approval or rejection.
 */
export default function ApprovalDrawer({ orderId, onClose, onDecided }) {
  const [state, setState] = useState({ order: null, loading: Boolean(orderId), error: null })
  const [busy, setBusy] = useState(null) // 'approve' | 'reject' while saving
  const [actionError, setActionError] = useState(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!orderId) return undefined
    let cancelled = false
    getNetworkOrder(orderId)
      .then((order) => !cancelled && setState({ order, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ order: null, loading: false, error }))
    return () => {
      cancelled = true
    }
  }, [orderId])

  const { order } = state

  const decide = async (kind) => {
    setBusy(kind)
    setActionError(null)
    try {
      const updated = kind === 'approve' ? await approveOrder(order.id) : await rejectOrder(order.id, reason.trim())
      setState({ order: updated, loading: false, error: null })
      setRejecting(false)
      onDecided(updated)
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const reasonOk = reason.trim().length >= MIN_REASON

  return (
    <Drawer
      anchor="right"
      open={Boolean(orderId)}
      onClose={busy ? undefined : onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 600 } } } }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {order ? `Order from ${order.dealer.name}` : 'Loading'}
          </Typography>
          <Typography component="h2" sx={{ fontSize: 24, fontWeight: 700 }}>
            {orderId}
          </Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} disabled={Boolean(busy)}>
          <CloseIcon />
        </IconButton>
      </Stack>

      <Box sx={{ p: 3, overflowY: 'auto', flexGrow: 1 }}>
        <AsyncContent loading={state.loading} error={state.error}>
          {order && (
            <Stack spacing={3}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                <StatusChip status={order.status} label={DESK_LABELS[order.status]} size="medium" />
                <Typography color="text.secondary">Sent {formatDate(order.createdAt)}</Typography>
              </Stack>

              {order.status === 'approved' && (
                <Alert severity="success">
                  Quote sent by {order.reviewedBy?.name ?? 'the order desk'}
                  {order.reviewedAt ? ` on ${formatDate(order.reviewedAt)}` : ''}. Waiting for the dealer to accept.
                </Alert>
              )}
              {order.status === 'accepted' && (
                <Alert severity="success">
                  Accepted by {order.dealerRespondedBy?.name ?? 'the dealer'}
                  {order.dealerRespondedAt ? ` on ${formatDate(order.dealerRespondedAt)}` : ''}. The dealer will fulfil it once installed.
                </Alert>
              )}
              {order.status === 'declined' && (
                <Alert severity="error">
                  Declined by {order.dealerRespondedBy?.name ?? 'the dealer'}
                  {order.dealerRespondedAt ? ` on ${formatDate(order.dealerRespondedAt)}` : ''}. Reason: {order.declineReason}
                </Alert>
              )}
              {order.status === 'rejected' && (
                <Alert severity="error">
                  Rejected by {order.reviewedBy?.name ?? 'the order desk'}
                  {order.reviewedAt ? ` on ${formatDate(order.reviewedAt)}` : ''}. Reason: {order.rejectionReason}
                </Alert>
              )}
              {order.status === 'fulfilled' && <Alert severity="info">Fulfilled: installed by the dealer.</Alert>}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Dealer
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{order.dealer.name}</Typography>
                  <Typography color="text.secondary">
                    {order.dealer.tier} Tier · {order.dealer.city}, {order.dealer.state}
                  </Typography>
                  {order.createdBy && (
                    <Typography variant="body2" color="text.secondary">
                      Sent by {order.createdBy.name}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    End customer
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{order.customer.name}</Typography>
                  <Typography color="text.secondary">
                    {order.customer.type === 'commercial' ? 'Commercial' : 'Residential'} · {order.customer.city}
                  </Typography>
                </Box>
              </Stack>

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

              {order.status === 'submitted' && (
                <Typography variant="body2" color="text.secondary">
                  Approving sends the dealer a quote at these catalogue prices.
                </Typography>
              )}
              {actionError && <Alert severity="error">{actionError}</Alert>}
            </Stack>
          )}
        </AsyncContent>
      </Box>

      {order?.status === 'submitted' && (
        <Stack direction="row" spacing={1.5} sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider', justifyContent: 'flex-end' }}>
          <Button variant="outlined" color="error" size="large" onClick={() => setRejecting(true)} disabled={Boolean(busy)}>
            Reject
          </Button>
          <Button variant="contained" size="large" onClick={() => decide('approve')} loading={busy === 'approve'} disabled={Boolean(busy)}>
            Approve & send quote
          </Button>
        </Stack>
      )}

      <Dialog open={rejecting} onClose={busy ? undefined : () => setRejecting(false)} maxWidth="sm" fullWidth aria-labelledby="reject-title">
        <DialogTitle id="reject-title" sx={{ fontWeight: 700 }}>
          Reject {order?.id}?
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {order?.dealer.name} will see this reason on the order.
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }}>
            {REJECTION_REASONS.map((r) => (
              <Chip key={r} label={r} onClick={() => setReason(r)} variant={reason === r ? 'filled' : 'outlined'} color={reason === r ? 'secondary' : 'default'} />
            ))}
          </Stack>
          <TextField
            label="Reason"
            required
            fullWidth
            multiline
            minRows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 300 } }}
            helperText={`${reason.trim().length} / 300`}
            autoFocus
          />
          {actionError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {actionError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejecting(false)} disabled={Boolean(busy)}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={() => decide('reject')} disabled={!reasonOk || Boolean(busy)} loading={busy === 'reject'}>
            Reject order
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  )
}
