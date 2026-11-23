import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined'
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded'
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined'
import PendingActionsOutlined from '@mui/icons-material/PendingActionsOutlined'
import RequestQuoteOutlined from '@mui/icons-material/RequestQuoteOutlined'
import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import KpiGrid from '@/components/patterns/KpiGrid'
import { DASH } from '@/constants/dashboardColors'
import { formatNumber } from '@/lib/format'

// Key order insights at the top of the Orders screen: coloured strips for what
// needs attention, then 4 insight cards. Built from GET /orders/summary.

// $1.26M, $387.0K, $950
const money = (value) =>
  value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(2)}M` : value >= 1_000 ? `$${(value / 1_000).toFixed(1)}K` : `$${Math.round(value)}`
const plural = (n, word) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`
const days = (n) => `${n} day${n === 1 ? '' : 's'}`

// A quote waiting longer than this is called out in red.
const QUOTE_URGENT_DAYS = 7

const STRIP_TONES = {
  urgent: { bg: DASH.redLight, border: DASH.red, icon: DASH.red, text: DASH.redDark },
  action: { bg: DASH.amberLight, border: DASH.amber, icon: DASH.amber, text: DASH.amberDark },
  info: { bg: DASH.navyLight, border: DASH.navy, icon: DASH.navy, text: DASH.navy },
  good: { bg: DASH.tealLight, border: DASH.teal, icon: DASH.tealDark, text: DASH.tealDark },
}

// One coloured strip: icon, message, and a button.
function Strip({ tone, icon: Icon, children, action, onAction }) {
  const t = STRIP_TONES[tone]
  return (
    <Box
      role={tone === 'urgent' ? 'alert' : 'status'}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
        pl: 2,
        pr: 1,
        borderRadius: '12px',
        bgcolor: t.bg,
        borderLeft: `4px solid ${t.border}`,
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
      }}
    >
      <Icon sx={{ color: t.icon, flexShrink: 0 }} />
      <Typography sx={{ flexGrow: 1, color: t.text, fontWeight: 600, py: 0.75 }}>{children}</Typography>
      {action && (
        <Button
          onClick={onAction}
          variant={tone === 'urgent' ? 'contained' : 'text'}
          sx={{
            minHeight: 44,
            px: 2.5,
            flexShrink: 0,
            fontWeight: 700,
            ...(tone === 'urgent' ? { bgcolor: DASH.navy, '&:hover': { bgcolor: '#2a2f63' } } : { color: t.text }),
          }}
        >
          {action}
        </Button>
      )}
    </Box>
  )
}

/**
 * summary: GET /orders/summary (with `insights`).
 * onStatus(status): show orders with that exact status in the table.
 * onStage(stage):  show a status group (e.g. 'open').
 * activeStatus / activeStage: the current table filter (selected card outline).
 */
export default function OrderInsights({ summary, onStatus, onStage, activeStatus, activeStage }) {
  const { quotes, waiting, toReceive, last30, approval } = summary.insights
  const quoteUrgent = quotes.oldest && quotes.oldest.days > QUOTE_URGENT_DAYS
  const change = last30.previousValue > 0 ? Math.round(((last30.value - last30.previousValue) / last30.previousValue) * 100) : null

  const tiles = [
    {
      key: 'open',
      label: 'Open orders',
      value: String(summary.openOrders),
      accent: DASH.navy,
      icon: PendingActionsOutlined,
      onClick: () => onStage(activeStage === 'open' && !activeStatus ? 'all' : 'open'),
      selected: activeStage === 'open' && !activeStatus,
      trend: {
        text:
          [quotes.count && `${quotes.count} quoted`, waiting.count && `${waiting.count} with manufacturer`, toReceive.count && `${toReceive.count} to receive`]
            .filter(Boolean)
            .join(' · ') || 'Nothing open',
      },
    },
    {
      key: 'quotes',
      label: 'Quotes to accept',
      value: String(quotes.count),
      accent: DASH.amber,
      icon: RequestQuoteOutlined,
      onClick: () => onStatus(activeStatus === 'approved' ? null : 'approved'),
      selected: activeStatus === 'approved',
      trend: quotes.count
        ? { text: `${money(quotes.value)} · oldest ${days(quotes.oldest.days)}`, tone: quoteUrgent ? 'negative' : 'warning' }
        : { text: 'Nothing waiting for you', tone: 'positive' },
    },
    {
      key: 'last30',
      label: 'Ordered, last 30 days',
      value: money(last30.value),
      accent: DASH.teal,
      icon: ShoppingCartOutlined,
      trend:
        change === null
          ? { text: plural(last30.count, 'order') }
          : { text: `${plural(last30.count, 'order')} · ${Math.abs(change)}% vs previous 30 days`, direction: change >= 0 ? 'up' : 'down', tone: 'neutral' },
    },
    {
      key: 'approval',
      label: 'Manufacturer approval',
      value: approval.rate === null ? '—' : `${Math.round(approval.rate * 100)}%`,
      accent: DASH.green,
      icon: FactCheckOutlined,
      trend: {
        text:
          approval.decided === 0
            ? 'No decisions in the last 90 days'
            : `${approval.avgDays.toFixed(1)} days on average · ${plural(approval.decided, 'order')}, last 90 days${approval.rejected ? ` · ${approval.rejected} rejected` : ''}`,
      },
    },
  ]

  const strips = []
  if (quotes.count) {
    strips.push(
      <Strip key="quotes" tone={quoteUrgent ? 'urgent' : 'action'} icon={WarningAmberRounded} action="Review quotes" onAction={() => onStatus('approved')}>
        {quotes.count === 1 ? '1 manufacturer quote' : `${quotes.count} manufacturer quotes`} ({money(quotes.value)}) {quotes.count === 1 ? 'is' : 'are'} waiting for
        you to accept or decline. The oldest, <strong>{quotes.oldest.id}</strong>, has waited {days(quotes.oldest.days)}.
      </Strip>,
    )
  }
  if (waiting.count) {
    strips.push(
      <Strip key="waiting" tone="info" icon={HourglassTopRounded} action="Show" onAction={() => onStatus('submitted')}>
        {waiting.count === 1 ? '1 order request is' : `${waiting.count} order requests are`} with the manufacturer
        {waiting.oldest.days > 0 ? ` · the oldest for ${days(waiting.oldest.days)}` : ''}
        {approval.avgDays !== null ? ` (they usually answer in ${approval.avgDays.toFixed(1)} days)` : ''}.
      </Strip>,
    )
  }
  if (toReceive.count) {
    strips.push(
      <Strip key="receive" tone="good" icon={Inventory2Outlined} action="Show" onAction={() => onStatus('accepted')}>
        {toReceive.count === 1 ? '1 accepted order' : `${toReceive.count} accepted orders`} ({money(toReceive.value)}) to receive. Mark{' '}
        {toReceive.count === 1 ? 'it' : 'them'} fulfilled when the goods arrive.
      </Strip>,
    )
  }

  return (
    <Stack spacing={2}>
      {strips.length > 0 && <Stack spacing={1.25}>{strips}</Stack>}
      <KpiGrid items={tiles} columns={4} spacing={2.5} />
    </Stack>
  )
}
