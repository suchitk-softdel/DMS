import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded'
import FactoryOutlined from '@mui/icons-material/FactoryOutlined'
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined'
import PendingActionsOutlined from '@mui/icons-material/PendingActionsOutlined'
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined'
import SearchRounded from '@mui/icons-material/SearchRounded'
import TrendingDownRounded from '@mui/icons-material/TrendingDownRounded'
import TrendingFlatRounded from '@mui/icons-material/TrendingFlatRounded'
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORY_LABELS } from '@/components/orders/orderLabels'
import AsyncContent from '@/components/patterns/AsyncContent'
import { ColumnChart, ColumnLabels, HBarChart } from '@/components/patterns/BarCharts'
import KpiGrid from '@/components/patterns/KpiGrid'
import SectionCard from '@/components/patterns/SectionCard'
import PageHeader from '@/components/ui/PageHeader'
import { DASH } from '@/constants/dashboardColors'
import { MODULE_PATHS, MODULES } from '@/constants/modules'
import { formatCurrency, formatNumber } from '@/lib/format'
import { useAsyncData } from '@/lib/useAsyncData'
import { getInventoryOverview } from '@/services/dataService'

// Inventory dashboard (SRS 3.5) in three tabs:
//   Overview - one stock alert, 4 operational cards, pricing summary, product insights
//   Stock    - category pills, stock-on-hand list (sort, search, filter) + product details
//   Sales    - units / revenue and top sellers for a chosen period:
//              current month (so far), or the last 3 / 6 / 12 complete months
// Read only; all figures come from the backend (GET /inventory/overview).
// "Recent" = the last 3 complete months. Links between tabs: "View" opens a
// product in the Stock tab; cards and insights open Stock with a filter set.

// Page colours from the inventory design (shared with Orders).
const C = DASH

const ALL = 'all'
const STOCK_FILTERS = [
  { value: ALL, label: 'All levels' },
  { value: 'attention', label: 'Low or out' },
  { value: 'ok', label: 'Healthy' },
  { value: 'notSelling', label: 'Not selling' },
]
const matchesStock = (p, filter) =>
  filter === ALL ||
  (filter === 'attention' && p.status !== 'ok') ||
  (filter === 'ok' && p.status === 'ok') ||
  (filter === 'notSelling' && p.unitsSold === 0 && p.onHand > 0)

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthShort = (key) => MONTH_SHORT[Number(key.slice(5, 7)) - 1]
const monthLabel = (key) => `${monthShort(key)} ${key.slice(0, 4)}`
const daysInMonth = (key) => new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).getUTCDate()
// $2.49M, $745.3K, $27.5K, $950 (short money for cards and pills).
const money = (value) =>
  value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(2)}M` : value >= 1_000 ? `$${(value / 1_000).toFixed(1)}K` : formatCurrency(value)
const moneyShort = money
const pctText = (value) => `${value > 0 ? '+' : ''}${Math.round(value)}%`

// Short product type + size for plain-language notes, e.g. "Heat Pump, 3 Ton".
const TYPE_LABEL = {
  airConditioner: 'Air Conditioner',
  heatPump: 'Heat Pump',
  furnace: 'Gas Furnace',
  airHandler: 'Air Handler',
  thermostat: 'Controls',
  indoorAirQuality: 'Air Quality',
  parts: 'Part',
}
const shortType = (product) => {
  const size = product.name.match(/\d+(?:\.\d+)? Ton|\d+k BTU|\d+ Zones?/)?.[0]
  return `${TYPE_LABEL[product.category] ?? product.category}${size ? `, ${size}` : ''}`
}

// One plain-language line about a product's last 3 months.
function trendNote(p, months) {
  const first = p.monthly[0].units
  const last = p.monthly.at(-1).units
  const lastMonth = monthShort(months.at(-1))
  if (last === 0 && first > 0) return `none sold in ${lastMonth}`
  if (first === 0 && last === 0) {
    const sold = p.monthly.filter((m) => m.units > 0)
    return `sold only in ${sold.map((m) => monthShort(m.month)).join(' and ')}`
  }
  if (first === 0) return `new: ${last} sold in ${lastMonth}`
  if (first === last) return `steady at ${last} a month`
  return `${last > first ? 'up' : 'down'} from ${first} to ${last} a month`
}

// Days of stock left at last month's selling rate (null if it did not sell).
function daysOfStock(p, months) {
  const lastMonth = months.at(-1)
  const perDay = p.monthly.at(-1).units / daysInMonth(lastMonth)
  return perDay > 0 ? Math.floor(p.onHand / perDay) : null
}

// Small "A | B | C" switch, 44px tall.
function Switch({ value, onChange, options, label }) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      onChange={(_, next) => next && onChange(next)}
      aria-label={label}
      sx={{
        '& .MuiToggleButton-root': { minHeight: 44, px: 1.75, textTransform: 'none', fontWeight: 600, fontSize: 14, color: C.muted, borderColor: C.border },
        '& .MuiToggleButton-root.Mui-selected': { bgcolor: C.teal, color: '#fff', '&:hover': { bgcolor: C.tealDark } },
      }}
    >
      {options.map((o) => (
        <ToggleButton key={o.value} value={o.value}>
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}

// White card in the design's style (1px border, rounded).
const cardSx = { border: `1px solid ${C.border}`, borderRadius: '12px', boxShadow: 'none' }

// ---------------------------------------------------------------------------
// Tab 1: Overview
// ---------------------------------------------------------------------------

// The most urgent stock problem: the best seller (or another seller) running
// out soon with nothing on order. Null when nothing is urgent.
function stockAlert(products, months, bestSellerId) {
  const candidates = products
    .filter((p) => p.onOrder === 0 && p.unitsSold > 0)
    .map((p) => ({ p, days: daysOfStock(p, months) }))
    .filter(({ days }) => days !== null && days <= 30)
  if (!candidates.length) return null
  const best = candidates.find(({ p }) => p.product.id === bestSellerId)
  const pick = best ?? candidates.sort((a, b) => a.days - b.days)[0]
  return { ...pick, isBestSeller: Boolean(best) }
}

function AlertBar({ alert, onView }) {
  const { p, days, isBestSeller } = alert
  return (
    <Box
      role="alert"
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, pl: 2, borderRadius: '12px', bgcolor: '#fdecee', border: `1px solid ${C.red}33`, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}
    >
      <WarningAmberRounded sx={{ color: C.red, flexShrink: 0 }} />
      <Typography sx={{ flexGrow: 1, color: C.redDark, fontWeight: 600 }}>
        {isBestSeller ? 'Best seller ' : ''}
        <strong>{p.product.sku}</strong> has about {days} day{days === 1 ? '' : 's'} of stock left and nothing on order.
      </Typography>
      <Button variant="contained" onClick={() => onView(p.product.id)} sx={{ minHeight: 44, px: 3, bgcolor: C.navy, '&:hover': { bgcolor: '#2a2f63' }, flexShrink: 0 }}>
        View
      </Button>
    </Box>
  )
}

function operationalTiles({ products, orders, manufacturer, pricing }, onLow, onOrders) {
  const attention = products.filter((p) => p.status !== 'ok')
  const uncovered = attention.filter((p) => p.onOrder === 0).length
  const open = orders.awaitingApproval + orders.quotesToAccept + orders.toFulfil
  const openParts = [
    orders.awaitingApproval && `${orders.awaitingApproval} awaiting approval`,
    orders.quotesToAccept && `${orders.quotesToAccept} quote${orders.quotesToAccept === 1 ? '' : 's'} to accept`,
    orders.toFulfil && `${orders.toFulfil} to receive`,
  ].filter(Boolean)
  return [
    {
      key: 'low',
      label: 'Low / out of stock',
      value: String(attention.length),
      accent: C.red,
      icon: ReportProblemOutlined,
      onClick: onLow,
      trend: { text: uncovered === attention.length ? 'Nothing on order' : `${uncovered} with nothing on order`, tone: uncovered ? 'negative' : 'positive' },
    },
    {
      key: 'incoming',
      label: 'Incoming stock',
      value: `${formatNumber(orders.unitsOnOrder)} units`,
      accent: C.green,
      icon: LocalShippingOutlined,
      onClick: onOrders,
      trend: { text: `${orders.productsOnOrder} products · ${moneyShort(pricing.incomingValue)}` },
    },
    {
      key: 'orders',
      label: 'Open orders',
      value: String(open),
      accent: C.amber,
      icon: PendingActionsOutlined,
      onClick: onOrders,
      trend: { text: openParts.join(' · ') || 'None open' },
    },
    {
      key: 'approval',
      label: 'Avg. approval time',
      value: orders.avgApprovalDays === null ? '—' : `${orders.avgApprovalDays.toFixed(1)} days`,
      accent: C.navy,
      icon: FactoryOutlined,
      trend: { text: `${orders.decidedLast90Days} orders, last 90 days${manufacturer ? ` · ${manufacturer.name}` : ''}` },
    },
  ]
}

function Figure({ label, value, note }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{label}</Typography>
      <Typography sx={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: { xs: 24, md: 28 }, color: C.navy, lineHeight: 1.25 }}>{value}</Typography>
      <Typography sx={{ fontSize: 13.5, color: C.muted }}>{note}</Typography>
    </Box>
  )
}

function PricingSummary({ pricing }) {
  return (
    <SectionCard title="Pricing summary" sx={cardSx}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Figure label="Stock value" value={money(pricing.stockValue)} note={`${money(pricing.stockCost)} at base price`} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Figure label="Potential margin" value={money(pricing.potentialMargin)} note={`${pricing.marginPct}%`} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Figure label="Incoming" value={money(pricing.incomingValue)} note="at base price" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Figure
            label="Selling price range"
            value={`${formatCurrency(pricing.lowestPrice)} – ${formatCurrency(pricing.highestPrice)}`}
            note={`average ${formatCurrency(pricing.averagePrice)}`}
          />
        </Grid>
      </Grid>
    </SectionCard>
  )
}

// hint: short note in brackets after the value, on how it is worked out.
function InsightRow({ label, value, hint, action, onClick }) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', py: 0.75 }}>
      <Typography sx={{ width: { xs: 110, sm: 150 }, flexShrink: 0, fontWeight: 600, color: C.muted, fontSize: 14 }}>{label}</Typography>
      <Typography sx={{ flexGrow: 1, fontWeight: 700, color: C.navy, minWidth: 0 }}>
        {value}
        {hint && (
          <Typography component="span" sx={{ ml: 0.75, fontWeight: 400, fontSize: 13, color: C.muted }}>
            ({hint})
          </Typography>
        )}
      </Typography>
      {onClick && (
        <Button onClick={onClick} sx={{ minHeight: 44, minWidth: 72, color: C.tealDark, fontWeight: 700, flexShrink: 0 }}>
          {action} →
        </Button>
      )}
    </Stack>
  )
}

function ProductInsights({ insights, onView }) {
  const { bestSeller, fastestGrowing } = insights
  return (
    <SectionCard title="Product insights" subtitle="Last 3 complete months" sx={cardSx}>
      <Stack divider={<Divider flexItem sx={{ borderColor: C.border }} />}>
        <InsightRow
          label="Best seller"
          value={bestSeller ? `${bestSeller.sku} · ${formatNumber(bestSeller.units)} units` : 'No sales yet'}
          hint={bestSeller ? 'total of the 3 months' : undefined}
          action="View"
          onClick={bestSeller ? () => onView(bestSeller.id) : undefined}
        />
        <InsightRow
          label="Fastest growing"
          value={fastestGrowing ? `${fastestGrowing.sku} · ${fastestGrowing.fromUnits} → ${fastestGrowing.toUnits} a month` : 'No product grew'}
          hint={fastestGrowing ? 'first month vs last month' : undefined}
          action="View"
          onClick={fastestGrowing ? () => onView(fastestGrowing.id) : undefined}
        />
      </Stack>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Tab 2: Stock
// ---------------------------------------------------------------------------

function CategoryPills({ products, category, onCategory }) {
  const values = products.reduce((acc, p) => {
    acc[p.product.category] = (acc[p.product.category] ?? 0) + p.onHand * p.product.unitPrice
    return acc
  }, {})
  const pills = [{ value: ALL, label: 'All' }, ...Object.entries(values).sort((a, b) => b[1] - a[1]).map(([key, v]) => ({ value: key, label: `${CATEGORY_LABELS[key] ?? key} · ${moneyShort(v)}` }))]
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }} role="group" aria-label="Filter by category">
      {pills.map((pill) => {
        const active = category === pill.value
        return (
          <Chip
            key={pill.value}
            label={pill.label}
            clickable
            onClick={() => onCategory(pill.value)}
            aria-pressed={active}
            sx={{
              height: 44,
              px: 0.75,
              borderRadius: 22,
              fontWeight: 600,
              fontSize: 14,
              bgcolor: active ? C.teal : '#fff',
              color: active ? '#fff' : C.navy,
              border: `1px solid ${active ? C.teal : C.border}`,
              '&:hover': { bgcolor: active ? C.tealDark : '#f0faf8' },
            }}
          />
        )
      })}
    </Stack>
  )
}

const SORTS = {
  most: { label: 'Most', compare: (a, b) => b.onHand - a.onHand },
  least: { label: 'Least', compare: (a, b) => a.onHand - b.onHand },
  az: { label: 'A–Z', compare: (a, b) => a.product.sku.localeCompare(b.product.sku) },
}

function StockList({ products, category, stockFilter, onStockFilter, selectedId, onSelect }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('most')
  const term = search.trim().toLowerCase()
  const rows = products
    .filter(
      (p) =>
        (category === ALL || p.product.category === category) &&
        matchesStock(p, stockFilter) &&
        (!term || p.product.sku.toLowerCase().includes(term) || p.product.name.toLowerCase().includes(term)),
    )
    .sort(SORTS[sort].compare)
    .map((p) => ({
      key: p.product.id,
      label: p.product.sku,
      sublabel: p.product.name,
      value: p.onHand,
      color: p.status === 'ok' ? C.teal : C.red,
      flag:
        p.status === 'ok' ? (
          <Box sx={{ width: 18 }} />
        ) : (
          <Box
            component={p.status === 'out' ? ErrorOutlineRounded : WarningAmberRounded}
            titleAccess={p.status === 'out' ? 'Out of stock' : 'Low stock'}
            sx={{ fontSize: 18, color: C.red }}
          />
        ),
      tip: {
        title: `${p.product.sku} · ${p.product.name}`,
        lines: [`On hand: ${p.onHand}`, `Reorder point: ${p.reorderPoint}`, `On order: ${p.onOrder}`, p.status === 'ok' ? 'Healthy' : p.status === 'out' ? 'Out of stock' : 'Low stock'],
      },
    }))

  return (
    <SectionCard
      title="Stock on hand"
      subtitle={`${rows.length} of ${products.length} products`}
      sx={cardSx}
      actions={
        <Box sx={{ mt: 0.5 }}>
          <Switch label="Sort" value={sort} onChange={setSort} options={Object.entries(SORTS).map(([value, s]) => ({ value, label: s.label }))} />
        </Box>
      }
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          placeholder="Search SKU or name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, '& .MuiInputBase-root': { minHeight: 44 } }}
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
            },
            htmlInput: { 'aria-label': 'Search SKU or name' },
          }}
        />
        <TextField select size="small" label="Stock" value={stockFilter} onChange={(e) => onStockFilter(e.target.value)} sx={{ minWidth: 160, '& .MuiInputBase-root': { minHeight: 44 } }}>
          {STOCK_FILTERS.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      {rows.length ? (
        <HBarChart key={`${category}|${stockFilter}|${sort}`} rows={rows} onRowClick={onSelect} selectedKey={selectedId} tooltips={false} maxHeight={520} formatValue={formatNumber} ariaLabel="Stock on hand by product" />
      ) : (
        <Typography sx={{ py: 5, textAlign: 'center', color: C.muted }}>No products match.</Typography>
      )}
    </SectionCard>
  )
}

function GreyBox({ label, value }) {
  return (
    <Box sx={{ bgcolor: C.boxGrey, borderRadius: '10px', p: 1.5, height: '100%' }}>
      <Typography sx={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 18, color: C.navy }}>{value}</Typography>
    </Box>
  )
}

// Simple summary of the product picked in the Stock on hand list.
function ProductDetails({ item, months }) {
  return (
    <SectionCard title="Product details" sx={cardSx}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 20, color: C.navy }}>{item.product.sku}</Typography>
        {item.status !== 'ok' && (
          <Chip
            size="small"
            icon={item.status === 'out' ? <ErrorOutlineRounded /> : <WarningAmberRounded />}
            label={item.status === 'out' ? 'Out of stock' : 'Low stock'}
            sx={{
              fontWeight: 700,
              bgcolor: item.status === 'out' ? '#fdecee' : '#fdf3e2',
              color: item.status === 'out' ? C.redDark : '#8a5a12',
              '& .MuiChip-icon': { color: item.status === 'out' ? C.red : C.amber },
            }}
          />
        )}
      </Stack>
      <Typography sx={{ color: C.muted, mb: 2 }}>{item.product.name}</Typography>
      <Grid container spacing={1.25}>
        <Grid size={4}>
          <GreyBox label="On hand" value={formatNumber(item.onHand)} />
        </Grid>
        <Grid size={4}>
          <GreyBox label="On order" value={formatNumber(item.onOrder)} />
        </Grid>
        <Grid size={4}>
          <GreyBox label="Price per unit" value={formatCurrency(item.product.unitPrice)} />
        </Grid>
      </Grid>
      <Typography sx={{ fontSize: 14, color: C.muted, mt: 2 }}>
        Sold <strong>{formatNumber(item.unitsSold)}</strong> units in {monthShort(months[0])} – {monthShort(months.at(-1))}
      </Typography>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Tab 3: Sales
// ---------------------------------------------------------------------------

// Period switch for the Sales tab. 'current' = this month so far (not over
// yet); the others = that many COMPLETE months, ending last month.
const PERIODS = [
  { value: 'current', label: 'Current month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
]
const sumOf = (list, key) => list.reduce((t, m) => t + m[key], 0)

// Sales figures for one period, cut from the backend's 12 months + current
// month (salesMonths / product.sales, oldest first, current month last).
function salesForPeriod(data, period) {
  const last = data.salesMonths.length - 1 // index of the current month
  const [from, to] = period === 'current' ? [last, last + 1] : [last - Number(period), last]
  const months = data.salesMonths.slice(from, to)
  const products = data.products.map((p) => {
    const monthly = p.sales.slice(from, to)
    const first = monthly[0].units
    return {
      ...p,
      monthly,
      unitsSold: sumOf(monthly, 'units'),
      revenue: sumOf(monthly, 'revenue'),
      // Last month of the period compared with the first (none for one month).
      unitsChangePct: months.length > 1 && first > 0 ? ((monthly.at(-1).units - first) / first) * 100 : null,
    }
  })
  const monthly = months.map((month, i) => ({ month, units: sumOf(products.map((p) => p.monthly[i]), 'units'), revenue: sumOf(products.map((p) => p.monthly[i]), 'revenue') }))
  // Last complete month, to put "this month so far" in context.
  const previous = { month: data.salesMonths[last - 1], units: sumOf(data.products.map((p) => p.sales[last - 1]), 'units'), revenue: sumOf(data.products.map((p) => p.sales[last - 1]), 'revenue') }
  return { period, isCurrent: period === 'current', months, products, monthly, previous }
}

// "Aug – Oct 2026" or "1 – 25 Nov 2026 (so far)".
function periodText(view, asOf) {
  if (view.isCurrent) return `1 – ${new Date(asOf).getUTCDate()} ${monthLabel(view.months[0])}, so far`
  return `${monthShort(view.months[0])} ${view.months[0].slice(0, 4)} – ${monthLabel(view.months.at(-1))}`
}

function SalesSummary({ view, asOf }) {
  const [measure, setMeasure] = useState('units')
  const isUnits = measure === 'units'
  const valueOf = (m) => (isUnits ? m.units : m.revenue)
  const fmt = (v) => (isUnits ? formatNumber(v) : moneyShort(v))
  const { monthly, isCurrent, previous } = view
  const count = monthly.length
  const dense = count > 6
  // Current month: last month next to this month so far, for comparison.
  const chartMonths = isCurrent ? [previous, ...monthly] : monthly
  const isPartial = (m) => isCurrent && m.month === view.months[0]
  const units = sumOf(monthly, 'units')
  const revenue = sumOf(monthly, 'revenue')
  return (
    <SectionCard
      title={isCurrent ? 'Current month' : `Last ${count} months`}
      subtitle={`${isUnits ? 'Units sold' : 'Revenue'}, all products · ${periodText(view, asOf)}`}
      sx={cardSx}
      actions={
        <Box sx={{ mt: 0.5 }}>
          <Switch
            label="Measure"
            value={measure}
            onChange={setMeasure}
            options={[
              { value: 'units', label: 'Units' },
              { value: 'revenue', label: 'Revenue' },
            ]}
          />
        </Box>
      }
    >
      <ColumnChart
        key={`${measure}-${view.period}`}
        height={220}
        dense={dense}
        ariaLabel={`${isUnits ? 'Units sold' : 'Revenue'} by month`}
        bars={chartMonths.map((m) => ({
          key: m.month,
          value: valueOf(m),
          // 12 columns are too narrow for money labels: hover shows them.
          display: dense && !isUnits ? '' : fmt(valueOf(m)),
          tip: { title: `${monthLabel(m.month)}${isPartial(m) ? ' (so far)' : ''}`, lines: [`Units: ${formatNumber(m.units)}`, `Revenue: ${formatCurrency(m.revenue)}`] },
        }))}
      />
      {/* Month labels, with the change from the month before (3 and 6 months only;
          a month that is not over yet is not compared). */}
      <Box sx={{ display: 'flex', gap: dense ? 0.75 : 2, mt: 1 }}>
        {chartMonths.map((m, i) => {
          const prev = chartMonths[i - 1]
          const change = !dense && !isCurrent && prev && valueOf(prev) > 0 ? ((valueOf(m) - valueOf(prev)) / valueOf(prev)) * 100 : null
          return (
            <Box key={m.month} sx={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
              <Typography sx={{ fontSize: dense ? 11.5 : 14, fontWeight: 600, color: C.navy }}>{monthShort(m.month)}</Typography>
              {!dense && (
                <Typography sx={{ fontSize: 13, fontWeight: 700, minHeight: 20, color: change === null ? C.muted : change >= 0 ? C.tealDark : C.redDark }}>
                  {isPartial(m) ? 'so far' : change === null ? '' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(change))}%`}
                </Typography>
              )}
            </Box>
          )
        })}
      </Box>
      {isCurrent && (
        <Typography sx={{ fontSize: 13, color: C.muted, mt: 1.5 }}>
          {monthShort(view.months[0])} is not over yet; {monthShort(previous.month)} is shown for comparison.
        </Typography>
      )}
      <Divider sx={{ my: 2.5, borderColor: C.border }} />
      <Grid container spacing={2}>
        <Grid size={6}>
          <Figure
            label={isCurrent ? 'Units so far' : `Units, ${count} months`}
            value={formatNumber(units)}
            note={isCurrent ? `${monthShort(view.months[0])} to date` : `about ${Math.round(units / count)} a month`}
          />
        </Grid>
        <Grid size={6}>
          <Figure
            label={isCurrent ? 'Revenue so far' : `Revenue, ${count} months`}
            value={money(revenue)}
            note={isCurrent ? `${monthShort(view.months[0])} to date` : `about ${money(revenue / count)} a month`}
          />
        </Grid>
      </Grid>
    </SectionCard>
  )
}

// Top sellers: products that sold, most units first.
const topSellers = (list) => list.filter((p) => p.unitsSold > 0).sort((a, b) => b.unitsSold - a.unitsSold)

function TrendIcon({ pct }) {
  if (pct === null) return <Typography sx={{ fontSize: 13.5, color: C.muted }}>new</Typography>
  const Icon = pct > 0 ? TrendingUpRounded : pct < 0 ? TrendingDownRounded : TrendingFlatRounded
  const color = pct > 0 ? C.tealDark : pct < 0 ? C.redDark : C.muted
  return (
    <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', justifyContent: 'flex-end', color }}>
      <Icon sx={{ fontSize: 18 }} />
      <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{pctText(pct)}</Typography>
    </Stack>
  )
}

function ProductTrends({ view, asOf, onView }) {
  const { products, months, isCurrent } = view
  const list = topSellers([...products]).slice(0, 8)
  return (
    <SectionCard
      title="Top sellers"
      subtitle={`${periodText(view, asOf)} · click a product to open it`}
      sx={cardSx}
    >
      {list.length === 0 && <Typography sx={{ py: 4, textAlign: 'center', color: C.muted }}>{isCurrent ? 'No sales yet in the current month.' : 'No sales in these months.'}</Typography>}
      <Stack divider={<Divider flexItem sx={{ borderColor: C.border }} />}>
        {list.map((p, index) => (
          <Box
            key={p.product.id}
            role="button"
            tabIndex={0}
            aria-label={`Open ${p.product.sku} in Stock`}
            onClick={() => onView(p.product.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onView(p.product.id))}
            sx={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr 56px 72px',
              alignItems: 'center',
              columnGap: 1.5,
              minHeight: 56,
              px: 1,
              mx: -1,
              borderRadius: '8px',
              cursor: 'pointer',
              outline: 'none',
              '&:hover, &:focus-visible': { bgcolor: '#f0faf8' },
            }}
          >
            <Typography sx={{ fontWeight: 700, color: C.muted }}>{index + 1}</Typography>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 700, color: C.navy }}>
                {p.product.sku}
              </Typography>
              <Typography noWrap sx={{ fontSize: 13, color: C.muted }}>
                {shortType(p.product)} · {isCurrent ? `${money(p.revenue)} so far` : trendNote(p, months)}
              </Typography>
            </Box>
            <Typography sx={{ textAlign: 'right', fontWeight: 700, color: C.navy, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(p.unitsSold)}</Typography>
            {isCurrent ? <span /> : <TrendIcon pct={p.unitsChangePct} />}
          </Box>
        ))}
      </Stack>
      <Typography sx={{ fontSize: 12.5, color: C.muted, mt: 1.5 }}>
        {isCurrent
          ? 'Units sold in the current month so far.'
          : `Units sold in the ${months.length} months; % = ${monthShort(months.at(-1))} compared with ${monthShort(months[0])}.`}
      </Typography>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------


export default function Inventory() {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useAsyncData(getInventoryOverview)
  // ?tab=sales opens a tab directly (e.g. the Copilot's "Open sales report").
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(() => (['overview', 'stock', 'sales'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview'))
  const [selectedId, setSelectedId] = useState(null)
  const [category, setCategory] = useState(ALL)
  const [stockFilter, setStockFilter] = useState(ALL)
  const [salesPeriod, setSalesPeriod] = useState('3')
  const salesView = useMemo(() => (data?.salesMonths ? salesForPeriod(data, salesPeriod) : null), [data, salesPeriod])

  const products = useMemo(() => data?.products ?? [], [data])
  const selected = useMemo(() => {
    if (!products.length) return null
    const id = selectedId ?? data?.insights.bestSeller?.id
    return products.find((p) => p.product.id === id) ?? products[0]
  }, [products, selectedId, data])
  const alert = useMemo(() => (data ? stockAlert(products, data.months, data.insights.bestSeller?.id) : null), [data, products])

  const goTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  // "View": open a product in the Stock tab (clearing filters that would hide it).
  const viewProduct = (id) => {
    setSelectedId(id)
    setCategory(ALL)
    setStockFilter(ALL)
    setTab('stock')
    goTop()
  }
  // Open the Stock tab with a stock filter set.
  const showStock = (filter) => {
    setStockFilter(filter)
    setCategory(ALL)
    setTab('stock')
    goTop()
  }

  return (
    <>
      <PageHeader title="Inventory" subtitle={data?.manufacturer?.name ?? ''} />
      <AsyncContent loading={loading} error={error} onRetry={reload} skeleton="dashboard">
        {data && selected && (
          <>
            <Tabs
              value={tab}
              onChange={(_, value) => setTab(value)}
              aria-label="Inventory views"
              sx={{
                mb: 3,
                borderBottom: `1px solid ${C.border}`,
                '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontWeight: 700, fontSize: 15, color: C.muted },
                '& .MuiTab-root.Mui-selected': { color: C.navy },
                '& .MuiTabs-indicator': { bgcolor: C.teal, height: 3 },
              }}
            >
              <Tab value="overview" label="Overview" />
              <Tab value="stock" label="Stock" />
              <Tab value="sales" label="Sales" />
            </Tabs>

            {tab === 'overview' && (
              <Stack spacing={3}>
                {alert && <AlertBar alert={alert} onView={viewProduct} />}
                <KpiGrid items={operationalTiles(data, () => showStock('attention'), () => navigate(MODULE_PATHS[MODULES.ORDERS]))} columns={4} spacing={2.5} />
                <PricingSummary pricing={data.pricing} />
                <ProductInsights insights={data.insights} onView={viewProduct} />
              </Stack>
            )}

            {tab === 'stock' && (
              <Stack spacing={2.5}>
                <CategoryPills products={products} category={category} onCategory={setCategory} />
                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, md: 7 }}>
                    <StockList
                      products={products}
                      category={category}
                      stockFilter={stockFilter}
                      onStockFilter={setStockFilter}
                      selectedId={selected.product.id}
                      onSelect={setSelectedId}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 5 }}>
                    <ProductDetails item={selected} months={data.months} />
                  </Grid>
                </Grid>
              </Stack>
            )}

            {tab === 'sales' && salesView && (
              <Stack spacing={2.5}>
                <Box sx={{ overflowX: 'auto' }}>
                  <Switch label="Sales period" value={salesPeriod} onChange={setSalesPeriod} options={PERIODS} />
                </Box>
                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, md: 5 }}>
                    <SalesSummary view={salesView} asOf={data.asOf} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 7 }}>
                    <ProductTrends view={salesView} asOf={data.asOf} onView={viewProduct} />
                  </Grid>
                </Grid>
              </Stack>
            )}
          </>
        )}
      </AsyncContent>
    </>
  )
}

