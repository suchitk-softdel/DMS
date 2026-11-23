import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/format'
import { getNextSerialNumber, getUnregisteredUnits, registerWarranty } from '@/services/dataService'

// Today + years (warranty end date shown before saving).
const yearsFromToday = (years) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + years)
  return d
}

/**
 * Register Warranty (FR-WAR-1): the dealer picks an equipment unit from a
 * fulfilled order; nothing else is typed. The serial number (next SN number
 * from the database, shown as soon as a unit is picked) and the install date
 * (today) are set by the system and are read-only. The warranty runs from
 * today (1 year by default, per product). The backend checks the unit again.
 *
 * onRegistered(registration) after saving. Render it only while open, so the
 * form starts empty every time.
 */
export default function RegisterWarrantyDialog({ onClose, onRegistered }) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [units, setUnits] = useState(null) // null while loading
  const [unit, setUnit] = useState(null)
  const [serial, setSerial] = useState('') // next SN number, shown once a unit is picked
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    getUnregisteredUnits()
      .then(setUnits)
      .catch((e) => {
        setUnits([])
        setError(e.message)
      })
  }, [])

  // Picking a unit fills in the serial number it will get.
  const pickUnit = (value) => {
    setUnit(value)
    setSerial('')
    if (value) getNextSerialNumber().then((r) => setSerial(r.serialNumber)).catch((e) => setError(e.message))
  }

  const problems = [!unit && 'Choose the unit to register.'].filter(Boolean)

  const save = async () => {
    setTouched(true)
    if (problems.length) return
    setSaving(true)
    setError(null)
    try {
      const registration = await registerWarranty({ orderItemId: unit.orderItemId })
      onRegistered(registration)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const years = unit?.product.warrantyYears ?? 1

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth aria-labelledby="register-warranty-title">
      <DialogTitle id="register-warranty-title" sx={{ fontWeight: 700 }}>
        Register warranty
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Typography color="text.secondary">
            Pick an installed unit from a fulfilled order. The serial number and install date are filled in automatically, and the warranty starts today.
          </Typography>

          {units !== null && units.length === 0 && !error ? (
            <Alert severity="info">
              No units are waiting for registration. Equipment units appear here once their order is fulfilled.
            </Alert>
          ) : (
            <Autocomplete
              options={units ?? []}
              loading={units === null}
              value={unit}
              onChange={(_, value) => pickUnit(value)}
              getOptionLabel={(u) => `${u.orderId} · ${u.product.sku} — ${u.product.name}`}
              isOptionEqualToValue={(a, b) => a.orderItemId === b.orderItemId}
              renderOption={({ key: _key, ...props }, u) => (
                <li key={u.orderItemId} {...props}>
                  <Box>
                    <Typography sx={{ fontSize: 15 }}>
                      <strong>{u.product.sku}</strong> {u.product.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {u.orderId} · fulfilled {formatDate(u.fulfilledAt)} · {u.registered} of {u.quantity} registered
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Unit (order · product)"
                  required
                  error={touched && !unit}
                  helperText={unit ? `${unit.quantity - unit.registered} of ${unit.quantity} units left to register on ${unit.orderId}` : ' '}
                />
              )}
            />
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Serial number"
              fullWidth
              value={unit ? serial || 'Loading…' : ''}
              placeholder="Shown when you pick a unit"
              helperText="Assigned automatically"
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { readOnly: true, 'aria-readonly': true },
                input: { sx: { fontWeight: 700, bgcolor: 'action.hover' } },
              }}
            />
            <TextField
              label="Install date"
              fullWidth
              value={formatDate(new Date())}
              helperText={`Today · warranty until ${formatDate(yearsFromToday(years))} (${years} year${years === 1 ? '' : 's'})`}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { readOnly: true, 'aria-readonly': true },
                input: { sx: { fontWeight: 700, bgcolor: 'action.hover' } },
              }}
            />
          </Stack>

          {touched && problems.length > 0 && <Alert severity="warning">{problems[0]}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} loading={saving} disabled={units?.length === 0}>
          Register
        </Button>
      </DialogActions>
    </Dialog>
  )
}
