import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'

const MIN_REASON = 3

/**
 * Asks for a reason before a "no" (e.g. declining a quote). Quick reasons
 * fill the text box; the reason is required. onConfirm(reason) when saved.
 */
export default function ReasonDialog({ open, title, message, reasons = [], confirmLabel, busy = false, error = null, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  const ok = reason.trim().length >= MIN_REASON

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="sm" fullWidth aria-labelledby="reason-dialog-title">
      <DialogTitle id="reason-dialog-title" sx={{ fontWeight: 700 }}>
        {title}
      </DialogTitle>
      <DialogContent>
        {message && (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {message}
          </Typography>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }}>
          {reasons.map((r) => (
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
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={() => onConfirm(reason.trim())} disabled={!ok || busy} loading={busy}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
