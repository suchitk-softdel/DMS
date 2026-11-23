import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import InputAdornment from '@mui/material/InputAdornment'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useEffect, useState } from 'react'
import { CATEGORY_LABELS } from '@/components/orders/orderLabels'
import { formatCurrency, formatDate } from '@/lib/format'
import { getProducts, getRegistrations, submitClaim } from '@/services/dataService'

const SEARCH_DELAY_MS = 300
const MIN_DESCRIPTION = 5
// Only serialised equipment has warranty registrations (and so claims).
const EQUIPMENT_CATEGORIES = ['airConditioner', 'heatPump', 'furnace', 'airHandler']

// Warranty status of a unit, shown next to its serial number in the list.
function UnitStatus({ unit }) {
  if (unit.openClaimId) return <Chip size="small" color="warning" label={`Open claim ${unit.openClaimId}`} />
  if (unit.expired) return <Chip size="small" color="error" variant="outlined" label={`Expired ${formatDate(unit.warrantyUntil)}`} />
  return <Chip size="small" color="success" variant="outlined" label={`Covered until ${formatDate(unit.warrantyUntil)}`} />
}

/**
 * Submit Claim (FR-WAR-1), in two steps: first the product (SKU and name), then
 * the serial number of that product's registered unit, then the amount and what
 * went wrong. The backend refuses the claim when the warranty has expired, when
 * the unit already has an open claim or when the amount is more than the
 * product's price, and that message is shown here.
 *
 * onSubmitted(claim) after saving. Render it only while open.
 */
export default function SubmitClaimDialog({ onClose, onSubmitted }) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [products, setProducts] = useState([])
  const [product, setProduct] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ key: null, units: [] })
  const [unit, setUnit] = useState(null)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [touched, setTouched] = useState(false)

  // Row 1: equipment products from the catalogue.
  useEffect(() => {
    getProducts()
      .then((all) => setProducts(all.filter((p) => EQUIPMENT_CATEGORIES.includes(p.category))))
      .catch((e) => setError(e.message))
  }, [])

  // Row 2: registered units of the chosen product, searched by serial number.
  const searchKey = product ? `${product.id}|${query}` : null
  useEffect(() => {
    if (!product) return undefined
    let cancelled = false
    const key = `${product.id}|${query}`
    const timer = setTimeout(() => {
      getRegistrations({ productId: product.id, search: query.trim() || undefined, limit: 50 })
        .then((units) => !cancelled && setResults({ key, units }))
        .catch((e) => !cancelled && setError(e.message))
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [product, query])

  const pickProduct = (value) => {
    setProduct(value)
    setUnit(null)
    setQuery('')
    setError(null)
  }

  const amountValue = Number(amount)
  const amountError = amount !== '' && (!Number.isFinite(amountValue) || amountValue < 1)
  const problems = [
    !product && 'Choose the product.',
    !unit && 'Choose the serial number.',
    (amount === '' || amountError) && 'Enter the claim amount.',
    description.trim().length < MIN_DESCRIPTION && 'Describe the problem.',
  ].filter(Boolean)

  const save = async () => {
    setTouched(true)
    if (problems.length) return
    setSaving(true)
    setError(null)
    try {
      const claim = await submitClaim({ registrationId: unit.id, amount: amountValue, description: description.trim() })
      onSubmitted(claim)
    } catch (e) {
      setError(e.message) // e.g. "The warranty for SN… expired on …"
    } finally {
      setSaving(false)
    }
  }

  const loadingUnits = Boolean(product) && results.key !== searchKey
  const units = product && results.key === searchKey ? results.units : []

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

          {/* Row 1: product */}
          <Autocomplete
            options={products}
            value={product}
            onChange={(_, value) => pickProduct(value)}
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

          {/* Row 2: serial number of that product's registered unit */}
          <Autocomplete
            disabled={!product}
            options={units}
            loading={loadingUnits}
            value={unit}
            onChange={(_, value) => {
              setUnit(value)
              setError(null)
            }}
            inputValue={query}
            onInputChange={(_, value, reason) => reason !== 'reset' && setQuery(value)}
            filterOptions={(options) => options} // the backend searches
            getOptionLabel={(u) => u.serialNumber}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            noOptionsText={loadingUnits ? 'Searching…' : 'No registered unit of this product'}
            renderOption={({ key: _key, ...props }, u) => (
              <li key={u.id} {...props}>
                <Stack direction="row" spacing={1.5} sx={{ width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{u.serialNumber}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {u.orderId} · installed {formatDate(u.installDate)}
                    </Typography>
                  </Box>
                  <UnitStatus unit={u} />
                </Stack>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Serial number"
                required
                error={touched && Boolean(product) && !unit}
                placeholder={product ? 'Pick or type the serial number…' : 'Choose the product first'}
              />
            )}
          />

          <TextField
            label="Claim amount"
            required
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amountError || (touched && amount === '')}
            helperText={product ? `Up to ${formatCurrency(product.unitPrice)} (the product's price)` : ' '}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
              htmlInput: { min: 1, step: 1 },
            }}
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
