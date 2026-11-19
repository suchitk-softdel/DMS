import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { ACCEPTANCE_METHODS } from '@/components/orders/orderLabels'

/**
 * Records the customer's acceptance of a quote: how they accepted (email,
 * phone, signed copy, in person), who accepted, and an optional note. The
 * dealer records it; the customer is the one who decided.
 *
 * onConfirm({ method, contact, note }) is called when saved.
 */
export default function AcceptQuoteDialog({ open, quote, busy = false, error = null, onConfirm, onCancel }) {
  const [method, setMethod] = useState(null)
  const [contact, setContact] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const valid = Boolean(method) && contact.trim().length >= 2

  const save = () => {
    setTouched(true)
    if (valid) onConfirm({ method, contact: contact.trim(), note: note.trim() || undefined })
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="sm" fullWidth aria-labelledby="accept-quote-title">
      <DialogTitle id="accept-quote-title" sx={{ fontWeight: 700 }}>
        Customer accepted {quote?.id}?
      </DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2.5 }}>
          Record how {quote?.customer?.name ?? 'the customer'} accepted this quote. It is saved on the quote as proof.
        </Typography>
        <Stack spacing={2.5}>
          <div>
            <Typography sx={{ fontWeight: 600, mb: 1 }}>
              How did the customer accept? <span aria-hidden>*</span>
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={method}
              onChange={(_, value) => value && setMethod(value)}
              aria-label="How did the customer accept"
              sx={{ flexWrap: 'wrap' }}
            >
              {ACCEPTANCE_METHODS.map((m) => (
                <ToggleButton key={m.value} value={m.value} sx={{ px: 2 }}>
                  {m.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {touched && !method && (
              <Typography variant="body2" color="error.main" sx={{ mt: 0.75 }}>
                Choose how the customer accepted.
              </Typography>
            )}
          </div>
          <TextField
            label="Customer contact"
            required
            fullWidth
            placeholder='e.g. "John Lee, Facilities Manager"'
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            error={touched && contact.trim().length < 2}
            helperText={touched && contact.trim().length < 2 ? 'Enter who accepted the quote.' : 'Name and role of the person who accepted'}
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />
          <TextField
            label="Note (optional)"
            fullWidth
            multiline
            minRows={2}
            placeholder="e.g. Accepted by reply to the quote email"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 300 } }}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} loading={busy} disabled={busy}>
          Save acceptance
        </Button>
      </DialogActions>
    </Dialog>
  )
}
