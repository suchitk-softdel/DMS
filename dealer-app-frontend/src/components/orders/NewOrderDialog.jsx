import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useEffect, useMemo, useState } from 'react'
import { CATEGORY_LABELS } from '@/components/orders/orderLabels'
import { formatCurrency } from '@/lib/format'
import { createOrder, getCustomers, getProducts } from '@/services/dataService'

const MAX_QUANTITY = 500
// Row keys; a counter works everywhere (crypto.randomUUID needs HTTPS outside localhost).
let lineCounter = 0
const emptyLine = () => ({ key: (lineCounter += 1), product: null, quantity: 1 })

/**
 * New quote or order (FR-ORD-1): customer, product lines at list price,
 * then "Save as draft" or "Submit". Prices come from the catalogue; the
 * backend recalculates the total.
 *
 * type: 'quote' | 'order' (initial choice). onCreated(order) after saving.
 * Render it only while open (`{open && <NewOrderDialog open ... />}`), so every
 * new quote starts with an empty form.
 */
export default function NewOrderDialog({ open, type: initialType = 'quote', onClose, onCreated }) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [type, setType] = useState(initialType)
  const [customer, setCustomer] = useState(null)
  const [lines, setLines] = useState([emptyLine()])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [saving, setSaving] = useState(null) // 'draft' | 'submitted' while saving
  const [error, setError] = useState(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open || products.length) return
    getProducts().then(setProducts).catch((e) => setError(e.message))
  }, [open, products.length])

  // Customer search, a moment after typing stops.
  useEffect(() => {
    if (!open) return undefined
    const timer = setTimeout(() => {
      getCustomers({ search: customerSearch.trim() || undefined, limit: 50 })
        .then(setCustomers)
        .catch((e) => setError(e.message))
    }, 250)
    return () => clearTimeout(timer)
  }, [open, customerSearch])

  const usedProducts = useMemo(() => new Set(lines.map((l) => l.product?.id).filter(Boolean)), [lines])
  const total = lines.reduce((sum, l) => sum + (l.product ? l.product.unitPrice * (Number(l.quantity) || 0) : 0), 0)
  const quantityError = (q) => !Number.isInteger(Number(q)) || Number(q) < 1 || Number(q) > MAX_QUANTITY
  const problems = [
    !customer && 'Choose a customer.',
    !lines.some((l) => l.product) && 'Add at least one product.',
    lines.some((l) => l.product && quantityError(l.quantity)) && `Quantities must be whole numbers from 1 to ${MAX_QUANTITY}.`,
  ].filter(Boolean)

  const updateLine = (key, change) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...change } : l)))
  const noun = type === 'quote' ? 'quote' : 'order request'
  // Orders are requests with quantities only; the manufacturer quotes the prices.
  const showPrices = type === 'quote'

  const save = async (status) => {
    setTouched(true)
    if (problems.length) return
    setSaving(status)
    setError(null)
    try {
      const order = await createOrder({
        type,
        customerId: customer.id,
        status,
        items: lines.filter((l) => l.product).map((l) => ({ productId: l.product.id, quantity: Number(l.quantity) })),
      })
      onCreated(order)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullScreen={fullScreen} maxWidth="md" fullWidth aria-labelledby="new-order-title">
      <DialogTitle id="new-order-title" sx={{ fontWeight: 700 }}>
        New {noun}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <ToggleButtonGroup exclusive size="small" value={type} onChange={(_, v) => v && setType(v)} aria-label="Type">
            <ToggleButton value="quote" sx={{ px: 3 }}>
              Quote
            </ToggleButton>
            <ToggleButton value="order" sx={{ px: 3 }}>
              Order
            </ToggleButton>
          </ToggleButtonGroup>

          <Autocomplete
            options={customers}
            value={customer}
            onChange={(_, value) => setCustomer(value)}
            onInputChange={(_, value, reason) => reason === 'input' && setCustomerSearch(value)}
            getOptionLabel={(c) => c.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(x) => x}
            renderOption={({ key: _key, ...props }, c) => (
              <li key={c.id} {...props}>
                <Box>
                  <Typography>{c.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {c.type === 'commercial' ? 'Commercial' : 'Residential'} · {c.city}
                  </Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Customer"
                required
                error={touched && !customer}
                helperText={touched && !customer ? 'Choose a customer.' : 'Type to search your customers'}
              />
            )}
          />

          <Box>
            <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Products</Typography>
            <Stack spacing={2}>
              {lines.map((line) => (
                <Stack key={line.key} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'flex-start' } }}>
                  <Autocomplete
                    sx={{ flexGrow: 1 }}
                    options={products}
                    value={line.product}
                    onChange={(_, value) => updateLine(line.key, { product: value })}
                    groupBy={(p) => CATEGORY_LABELS[p.category] ?? p.category}
                    getOptionLabel={(p) => `${p.sku} — ${p.name}`}
                    getOptionDisabled={(p) => usedProducts.has(p.id) && p.id !== line.product?.id}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    renderOption={({ key: _key, ...props }, p) => (
                      <li key={p.id} {...props}>
                        <Stack direction="row" sx={{ width: '100%', justifyContent: 'space-between', gap: 2 }}>
                          <span>
                            <strong>{p.sku}</strong> {p.name}
                          </span>
                          {showPrices && (
                            <Typography component="span" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                              {formatCurrency(p.unitPrice)}
                            </Typography>
                          )}
                        </Stack>
                      </li>
                    )}
                    renderInput={(params) => <TextField {...params} label="Product" size="small" />}
                  />
                  <TextField
                    label="Qty"
                    type="number"
                    size="small"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    error={Boolean(line.product) && quantityError(line.quantity)}
                    slotProps={{ htmlInput: { min: 1, max: MAX_QUANTITY, step: 1 } }}
                    sx={{ width: { sm: 100 } }}
                  />
                  {showPrices && (
                    <Typography sx={{ minWidth: 110, textAlign: { sm: 'right' }, pt: { sm: 1 }, fontWeight: 600 }}>
                      {line.product ? formatCurrency(line.product.unitPrice * (Number(line.quantity) || 0)) : '—'}
                    </Typography>
                  )}
                  <IconButton
                    aria-label="Remove product"
                    onClick={() => setLines((all) => (all.length > 1 ? all.filter((l) => l.key !== line.key) : [emptyLine()]))}
                    sx={{ alignSelf: { xs: 'flex-end', sm: 'flex-start' } }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
            <Button startIcon={<AddIcon />} onClick={() => setLines((all) => [...all, emptyLine()])} sx={{ mt: 1.5 }}>
              Add product
            </Button>
          </Box>

          {showPrices ? (
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', borderTop: 1, borderColor: 'divider', pt: 2 }}>
              <Typography color="text.secondary">Total at list price</Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 700 }}>{formatCurrency(total, { decimals: 2 })}</Typography>
            </Stack>
          ) : (
            <Alert severity="info">
              Send the quantities you need. The manufacturer approves the request and sends you a quote with catalogue prices to accept.
            </Alert>
          )}

          {touched && problems.length > 0 && <Alert severity="warning">{problems.join(' ')}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} disabled={Boolean(saving)}>
          Cancel
        </Button>
        <Button variant="outlined" onClick={() => save('draft')} loading={saving === 'draft'} disabled={Boolean(saving)}>
          Save as draft
        </Button>
        <Button variant="contained" onClick={() => save('submitted')} loading={saving === 'submitted'} disabled={Boolean(saving)}>
          {type === 'quote' ? 'Send to customer' : 'Send request'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
