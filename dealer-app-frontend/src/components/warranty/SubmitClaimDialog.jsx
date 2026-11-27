import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
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
import { CATEGORY_LABELS } from '@/components/orders/orderLabels'
import { getProducts, getRegistrations, submitClaim } from '@/services/dataService'

const MIN_DESCRIPTION = 5
// Only serialised equipment has warranty registrations (and so claims).
const EQUIPMENT_CATEGORIES = ['airConditioner', 'heatPump', 'furnace', 'airHandler']

/**
 * Submit Claim (FR-WAR-1): the product, the serial number typed by the user,
 * and what went wrong. On submit the claim goes against the registered unit of
 * that product with that serial number. The backend refuses it when the
 * warranty has expired or the unit already has an open claim, and that message
 * is shown here. The form has no amount field; the product's price is sent.
 *
 * onSubmitted(claim) after saving. Render it only while open.
 */
export default function SubmitClaimDialog({ onClose, onSubmitted }) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [products, setProducts] = useState([])
  const [product, setProduct] = useState(null)
  const [serial, setSerial] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [touched, setTouched] = useState(false)

  // Equipment products from the catalogue.
  useEffect(() => {
    getProducts()
      .then((all) => setProducts(all.filter((p) => EQUIPMENT_CATEGORIES.includes(p.category))))
      .catch((e) => setError(e.message))
  }, [])

  const problems = [
    !product && 'Choose the product.',
    !serial.trim() && 'Enter the serial number.',
    description.trim().length < MIN_DESCRIPTION && 'Describe the problem.',
  ].filter(Boolean)

  const save = async () => {
    setTouched(true)
    if (problems.length) return
    setSaving(true)
    setError(null)
    try {
      // The registered unit of the chosen product with exactly this serial number.
      const typed = serial.trim().toUpperCase()
      const units = await getRegistrations({ productId: product.id, search: typed, limit: 50 })
      const unit = units.find((u) => u.serialNumber.toUpperCase() === typed)
      if (!unit) {
        setError(`${typed} is not a registered ${product.sku} unit.`)
        return
      }
      // Expired warranty or an open claim: the backend refuses with its own message.
      const claim = await submitClaim({ registrationId: unit.id, amount: product.unitPrice, description: description.trim() })
      onSubmitted(claim)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth aria-labelledby="submit-claim-title">
      <DialogTitle id="submit-claim-title" sx={{ fontWeight: 700 }}>
        Submit warranty claim
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Typography color="text.secondary">
            Ask the manufacturer to cover a repair on a registered unit that is still under warranty.
          </Typography>

          <Autocomplete
            options={products}
            value={product}
            onChange={(_, value) => {
              setProduct(value)
              setError(null)
            }}
            groupBy={(p) => CATEGORY_LABELS[p.category] ?? p.category}
            getOptionLabel={(p) => `${p.sku} — ${p.name}`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderOption={({ key: _key, ...props }, p) => (
              <li key={p.id} {...props}>
                <span>
                  <strong>{p.sku}</strong> {p.name}
                </span>
              </li>
            )}
            renderInput={(params) => <TextField {...params} label="Product" required error={touched && !product} />}
          />

          <TextField
            label="Serial number"
            required
            value={serial}
            onChange={(e) => {
              setSerial(e.target.value)
              setError(null)
            }}
            error={touched && !serial.trim()}
            placeholder="e.g. SN000123"
            slotProps={{ htmlInput: { maxLength: 40 } }}
          />

          <TextField
            label="What went wrong?"
            required
            multiline
            minRows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={touched && description.trim().length < MIN_DESCRIPTION}
            helperText={`${description.trim().length} / 500`}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />

          {touched && problems.length > 0 && <Alert severity="warning">{problems[0]}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} loading={saving}>
          Submit claim
        </Button>
      </DialogActions>
    </Dialog>
  )
}
