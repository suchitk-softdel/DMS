import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { useMemo, useState } from 'react'
import { CATEGORY_LABELS } from '@/components/orders/orderLabels'
import AsyncContent from '@/components/patterns/AsyncContent'
import FilterBar from '@/components/patterns/FilterBar'
import DataTable from '@/components/ui/DataTable'
import PageHeader from '@/components/ui/PageHeader'
import { formatCurrency, formatNumber } from '@/lib/format'
import { useAsyncData } from '@/lib/useAsyncData'
import { getInventory } from '@/services/dataService'

// SRS 3.5, reduced by project decision: the dealer's product list with current
// stock. Not connected to orders (no reorder from this screen).

const STOCK_STATUS = {
  out: { label: 'Out of stock', color: 'error' },
  low: { label: 'Low stock', color: 'warning' },
  ok: { label: 'In stock', color: 'success' },
}

// Out of stock: none on hand. Low stock: at or below the reorder point.
const stockStatus = (row) => (row.onHand === 0 ? 'out' : row.onHand <= row.reorderPoint ? 'low' : 'ok')

const ALL = 'all'
const categoryOptions = [{ value: ALL, label: 'All categories' }, ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))]
const statusOptions = [{ value: ALL, label: 'All stock levels' }, ...Object.entries(STOCK_STATUS).map(([value, { label }]) => ({ value, label }))]

const columns = [
  {
    field: 'product',
    headerName: 'Product',
    render: (row) => (
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{row.product.sku}</Typography>
        <Typography variant="body2" color="text.secondary">
          {row.product.name}
        </Typography>
      </Box>
    ),
  },
  { field: 'category', headerName: 'Category', render: (row) => CATEGORY_LABELS[row.product.category] ?? row.product.category },
  { field: 'price', headerName: 'Price', align: 'right', render: (row) => formatCurrency(row.product.unitPrice, { decimals: 2 }) },
  { field: 'onHand', headerName: 'On hand', align: 'right', render: (row) => formatNumber(row.onHand) },
  { field: 'onOrder', headerName: 'On order', align: 'right', render: (row) => formatNumber(row.onOrder) },
  { field: 'reorderPoint', headerName: 'Reorder point', align: 'right', render: (row) => formatNumber(row.reorderPoint) },
  {
    field: 'status',
    headerName: 'Stock',
    render: (row) => {
      const { label, color } = STOCK_STATUS[row.status]
      return <Chip size="small" label={label} color={color} variant="outlined" />
    },
  },
]

export default function Inventory() {
  const { data, loading, error, reload } = useAsyncData(getInventory)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL)
  const [status, setStatus] = useState(ALL)

  const rows = useMemo(() => (data ?? []).map((row) => ({ ...row, status: stockStatus(row) })), [data])
  const counts = useMemo(() => {
    const result = { out: 0, low: 0, ok: 0 }
    for (const row of rows) result[row.status] += 1
    return result
  }, [rows])

  const term = search.trim().toLowerCase()
  const shown = rows.filter(
    (row) =>
      (category === ALL || row.product.category === category) &&
      (status === ALL || row.status === status) &&
      (!term || row.product.sku.toLowerCase().includes(term) || row.product.name.toLowerCase().includes(term)),
  )

  const subtitle = data ? `${rows.length} products  ·  ${counts.low} low stock  ·  ${counts.out} out of stock` : ''
  const filtered = term || category !== ALL || status !== ALL

  return (
    <>
      <PageHeader title="Inventory" subtitle={subtitle} />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by SKU or product name"
        selects={[
          { key: 'category', label: 'Category', value: category, options: categoryOptions, onChange: setCategory },
          { key: 'status', label: 'Stock', value: status, options: statusOptions, onChange: setStatus },
        ]}
        onReset={
          filtered
            ? () => {
                setSearch('')
                setCategory(ALL)
                setStatus(ALL)
              }
            : undefined
        }
      />
      <AsyncContent loading={loading} error={error} onRetry={reload}>
        <DataTable
          columns={columns}
          rows={shown}
          getRowId={(row) => row.product.id}
          emptyMessage="No products match these filters."
        />
      </AsyncContent>
    </>
  )
}
