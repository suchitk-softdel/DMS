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
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useEffect, useMemo, useState } from 'react'
import { CATEGORY_LABELS } from '@/components/orders/orderLabels'
import { createOrder, getProducts } from '@/services/dataService'

const MAX_QUANTITY = 500
// Row keys; a counter works everywhere (crypto.randomUUID needs HTTPS outside localhost).
let lineCounter = 0
const emptyLine = () => ({ key: (lineCounter += 1), product: null, quantity: 1 })

/**
 * New order request to the manufacturer (FR-ORD-1): products and quantities
 * only. The manufacturer approves it and quotes catalogue prices; the dealer
 * then accepts the quote. "Save as draft" or "Send request".
 *
 * onCreated(order) after saving. Render it only while open
 * (`{open && <NewOrderDialog open ... />}`), so every request starts empty.
 */
export default function NewOrderDialog({ open, onClose, onCreated }) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [lines, setLines] = useState([emptyLine()])
  const [products, setProducts] = useState([])
  const [saving, setSaving] = useState(null) // 'draft' | 'submitted' while saving
  const [error, setError] = useState(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open || products.length) return
    getProducts().then(setProducts).catch((e) => setError(e.message))
  }, [open, products.length])

  const usedProducts = useMemo(() => new Set(lines.map((l) => l.product?.id).filter(Boolean)), [lines])
  const totalUnits = lines.reduce((sum, l) => sum + (l.product ? Number(l.quantity) || 0 : 0), 0)
  const quantityError = (q) => !Number.isInteger(Number(q)) || Number(q) < 1 || Number(q) > MAX_QUANTITY
  const problems = [
    !lines.some((l) => l.product) && 'Add at least one product.',
    lines.some((l) => l.product && quantityError(l.quantity)) && `Quantities must be whole numbers from 1 to ${MAX_QUANTITY}.`,
  ].filter(Boolean)

  const updateLine = (key, change) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...change } : l)))

  const save = async (status) => {
    setTouched(true)
    if (problems.length) return
    setSaving(status)
    setError(null)
    try {
      const order = await createOrder({
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
        New order request
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
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
                        <span>
                          <strong>{p.sku}</strong> {p.name}
                        </span>
                      </li>
                    )}
                    renderInput={(params) => <TextField {...params} label="Product" size="small" />}
                  />
                  <TextField
                    label="Quantity"
                    type="number"
                    size="small"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    error={Boolean(line.product) && quantityError(line.quantity)}
                    slotProps={{ htmlInput: { min: 1, max: MAX_QUANTITY, step: 1 } }}
                    sx={{ width: { sm: 120 } }}
                  />
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

          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <Typography color="text.secondary">Total quantity</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
              {totalUnits} {totalUnits === 1 ? 'unit' : 'units'}
            </Typography>
          </Stack>

          <Alert severity="info">
            Send the quantities you need. The manufacturer approves the request and sends you a quote with catalogue prices to accept.
          </Alert>
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
          Send request
        </Button>
      </DialogActions>
    </Dialog>
  )
}
