import PointOfSaleOutlined from '@mui/icons-material/PointOfSaleOutlined'
import SearchRounded from '@mui/icons-material/SearchRounded'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Grid from '@mui/material/Grid'
import InputAdornment from '@mui/material/InputAdornment'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import AsyncContent from '@/components/patterns/AsyncContent'
import SectionCard from '@/components/patterns/SectionCard'
import DataTable from '@/components/ui/DataTable'
import PageHeader from '@/components/ui/PageHeader'
import { DASH } from '@/constants/dashboardColors'
import { formatCurrency, formatDate } from '@/lib/format'
import { useToast } from '@/lib/toast'
import { useAsyncData } from '@/lib/useAsyncData'
import { getPlaceOrders, placeOrder } from '@/services/dataService'

// Place Orders: the dealer sells products from its own stock to customers.
//   - only products with stock can be sold, never more than is available
//   - the selling price must be higher than the base price (the
//     manufacturer's price for the product)
//   - a sale takes the units off stock
// The backend checks the same rules (POST /place-orders).

const money = (value) => formatCurrency(value, { decimals: 2 })

const STOCK = {
  ok: { label: 'In stock', color: 'success' },
  low: { label: 'Low stock', color: 'warning' },
  out: { label: 'Out of stock', color: 'default' },
}

function Figure({ label, value }) {
  return (
    <Box sx={{ bgcolor: DASH.boxGrey, borderRadius: '10px', p: 1.5, height: '100%' }}>
      <Typography sx={{ fontSize: 12.5, color: DASH.muted, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 700, fontSize: 18, color: DASH.navy }}>{value}</Typography>
    </Box>
  )
}

// Quantity and selling price for one product, with the total and profit
// worked out as the dealer types. onSold(sale) after the order is placed.
function SellDialog({ product, onSold, onClose }) {
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState(product.lastSellingPrice ? String(product.lastSellingPrice) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const qty = Number(quantity)
  const sellingPrice = Number(price)
  const qtyError =
    quantity === '' ? null : !Number.isInteger(qty) || qty < 1 ? 'Enter a whole number of 1 or more.' : qty > product.available ? `Only ${product.available} available.` : null
  const priceError =
    price === '' ? null : !(sellingPrice > product.basePrice) ? `Must be higher than the base price (${money(product.basePrice)}).` : null
  const valid = quantity !== '' && price !== '' && !qtyError && !priceError

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      onSold(await placeOrder({ productId: product.productId, quantity: qty, sellingPrice }))
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth aria-labelledby="sell-dialog-title">
      <DialogTitle id="sell-dialog-title" sx={{ pb: 0.5 }}>
        <Typography component="span" sx={{ display: 'block', fontWeight: 700, fontSize: 20 }}>
          Sell {product.sku}
        </Typography>
        <Typography component="span" sx={{ display: 'block', fontSize: 14, color: 'text.secondary' }}>
          {product.name}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={1.25} sx={{ my: 1.5 }}>
          <Grid size={6}>
            <Figure label="Available" value={product.available} />
          </Grid>
          <Grid size={6}>
            <Figure label="Base price" value={money(product.basePrice)} />
          </Grid>
        </Grid>
        <Stack spacing={2}>
          <TextField
            label="Quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={Boolean(qtyError)}
            helperText={qtyError ?? `1 to ${product.available}`}
            slotProps={{ htmlInput: { min: 1, max: product.available, step: 1 } }}
            autoFocus
          />
          <TextField
            label="Selling price per unit"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={Boolean(priceError)}
            helperText={priceError ?? `Higher than ${money(product.basePrice)}`}
            slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> }, htmlInput: { min: 0, step: 0.01 } }}
          />
        </Stack>
        {valid && (
          <Grid container spacing={1.25} sx={{ mt: 2 }}>
            <Grid size={6}>
              <Figure label="Order total" value={money(qty * sellingPrice)} />
            </Grid>
            <Grid size={6}>
              <Figure label="Your profit" value={money(qty * (sellingPrice - product.basePrice))} />
            </Grid>
          </Grid>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={!valid} loading={busy}>
          Place order
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function PlaceOrders() {
  const toast = useToast()
  const { data, loading, error, reload, refresh } = useAsyncData(getPlaceOrders)
  const [search, setSearch] = useState('')
  const [selling, setSelling] = useState(null)

  const term = search.trim().toLowerCase()
  const products = (data?.products ?? []).filter((p) => !term || p.sku.toLowerCase().includes(term) || p.name.toLowerCase().includes(term))
  const availableCount = (data?.products ?? []).filter((p) => p.available > 0).length

  const onSold = (sale) => {
    setSelling(null)
    toast(`Sold ${sale.quantity} × ${sale.product.sku} for ${money(sale.total)}.`)
    refresh()
  }

  const productColumns = [
    {
      field: 'product',
      headerName: 'Product',
      render: (p) => (
        <Box sx={{ opacity: p.available ? 1 : 0.55 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{p.sku}</Typography>
          <Typography variant="body2" color="text.secondary">
            {p.name}
          </Typography>
        </Box>
      ),
    },
    { field: 'available', headerName: 'Available', align: 'right' },
    { field: 'basePrice', headerName: 'Base price', align: 'right', render: (p) => money(p.basePrice) },
    {
      field: 'lastSellingPrice',
      headerName: 'Last selling price',
      align: 'right',
      render: (p) => (p.lastSellingPrice ? money(p.lastSellingPrice) : '—'),
    },
    { field: 'status', headerName: 'Status', render: (p) => <Chip size="small" label={STOCK[p.status].label} color={STOCK[p.status].color} /> },
    {
      field: 'sell',
      headerName: '',
      align: 'right',
      render: (p) =>
        p.available > 0 ? (
          <Button variant="contained" size="small" onClick={() => setSelling(p)}>
            Sell
          </Button>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Not available
          </Typography>
        ),
    },
  ]

  const saleColumns = [
    { field: 'createdAt', headerName: 'Date', render: (s) => formatDate(s.createdAt) },
    {
      field: 'product',
      headerName: 'Product',
      render: (s) => (
        <>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{s.product.sku}</Typography>
          <Typography variant="body2" color="text.secondary">
            {s.product.name}
          </Typography>
        </>
      ),
    },
    { field: 'quantity', headerName: 'Qty', align: 'right' },
    { field: 'sellingPrice', headerName: 'Selling price', align: 'right', render: (s) => money(s.sellingPrice) },
    { field: 'total', headerName: 'Total', align: 'right', render: (s) => money(s.total) },
    { field: 'profit', headerName: 'Profit', align: 'right', render: (s) => <Box sx={{ color: 'success.main', fontWeight: 600 }}>{money(s.profit)}</Box> },
    { field: 'soldBy', headerName: 'Sold by', render: (s) => s.soldBy ?? '—' },
  ]

  return (
    <>
      <PageHeader title="Place Orders" subtitle="Sell products from your stock to your customers" />
      <AsyncContent loading={loading} error={error} onRetry={reload} skeleton="dashboard">
        {data && (
          <Stack spacing={3}>
            <SectionCard
              title="Products"
              subtitle={`${availableCount} of ${data.products.length} products available to sell. Sell above the base price.`}
              actions={
                <TextField
                  size="small"
                  placeholder="Search SKU or name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': 'Search products' } }}
                  sx={{ mt: 1, width: { xs: 180, sm: 240 } }}
                />
              }
            >
              <DataTable dense columns={productColumns} rows={products} getRowId={(p) => p.productId} emptyMessage="No products match your search." />
            </SectionCard>

            <SectionCard title="Recent sales" subtitle="Your latest orders placed here">
              {data.recent.length === 0 ? (
                <Stack spacing={1} sx={{ alignItems: 'center', py: 3, color: 'text.secondary' }}>
                  <PointOfSaleOutlined />
                  <Typography>No sales yet. Pick a product above and click Sell.</Typography>
                </Stack>
              ) : (
                <DataTable dense columns={saleColumns} rows={data.recent} />
              )}
            </SectionCard>
          </Stack>
        )}
      </AsyncContent>

      {selling && <SellDialog key={selling.productId} product={selling} onSold={onSold} onClose={() => setSelling(null)} />}
    </>
  )
}
