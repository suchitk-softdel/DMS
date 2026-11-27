import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined'
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined'
import HandshakeOutlined from '@mui/icons-material/HandshakeOutlined'
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded'
import TimerOutlined from '@mui/icons-material/TimerOutlined'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import KpiGrid from '@/components/patterns/KpiGrid'
import { DASH } from '@/constants/dashboardColors'
import { formatCurrency } from '@/lib/format'

// Insights at the top of the manufacturer's Order Details: coloured strips for
// what needs action now, then 4 insight cards (mostly the last 90 days).
//   summary:  GET /manufacturer/orders/summary (orders waiting for approval)
//   insights: GET /manufacturer/orders/insights
//   onQueue(queue): show that list in the table below

const money = (value) => formatCurrency(value, { compact: true })
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const days = (n) => plural(n, 'day')

const TONES = {
  urgent: { bg: DASH.redLight, border: DASH.red, icon: DASH.red, text: DASH.redDark },
  action: { bg: DASH.amberLight, border: DASH.amber, icon: DASH.amber, text: DASH.amberDark },
}

function Strip({ tone, icon: Icon, children, action, onAction }) {
  const t = TONES[tone]
  return (
    <Box
      role={tone === 'urgent' ? 'alert' : 'status'}
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, pl: 2, pr: 1, borderRadius: '12px', bgcolor: t.bg, borderLeft: `4px solid ${t.border}`, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}
    >
      <Icon sx={{ color: t.icon, flexShrink: 0 }} />
      <Typography sx={{ flexGrow: 1, color: t.text, fontWeight: 600, py: 0.75 }}>{children}</Typography>
      <Button onClick={onAction} sx={{ minHeight: 44, px: 2.5, flexShrink: 0, fontWeight: 700, color: t.text }}>
        {action}
      </Button>
    </Box>
  )
}

export default function OrderDeskInsights({ summary, insights, error, onQueue }) {
  if (error) return <Alert severity="error">Order insights: {error.message}</Alert>
  if (!summary || !insights) return <KpiGrid loading columns={4} skeletonCount={4} />

  const { pending } = summary
  const { quotes, approval, answers, topDealer, days: period, staleDays } = insights

  const strips = []
  if (pending.count) {
    strips.push(
      <Strip key="pending" tone={pending.oldestDays > 2 ? 'urgent' : 'action'} icon={WarningAmberRounded} action="Review" onAction={() => onQueue('pending')}>
        {pending.count === 1 ? '1 order is' : `${pending.count} orders are`} waiting for your approval ({money(pending.value)})
        {pending.oldestDays ? ` · the oldest for ${days(pending.oldestDays)}` : ''}.
      </Strip>,
    )
  }
  if (quotes.stale.count) {
    strips.push(
      <Strip key="quotes" tone="action" icon={HourglassTopRounded} action="Show quotes" onAction={() => onQueue('approved')}>
        {quotes.stale.count === 1 ? '1 quote has' : `${quotes.stale.count} quotes have`} waited more than {days(staleDays)} for the dealer ({money(quotes.stale.value)})
        {quotes.oldest ? ` · oldest ${quotes.oldest.id} from ${quotes.oldest.dealer}, ${days(quotes.oldest.days)}` : ''}. Worth a follow-up call.
      </Strip>,
    )
  }

  const approvalRate = approval.decided ? Math.round((approval.approved / approval.decided) * 100) : null
  const acceptRate = answers.total ? Math.round((answers.accepted / answers.total) * 100) : null

  const tiles = [
    {
      key: 'speed',
      label: 'Approval speed',
      value: approval.avgDays === null ? '—' : `${approval.avgDays} days`,
      accent: DASH.teal,
      icon: TimerOutlined,
      trend: {
        text: approval.decided ? `Average from order to decision · ${plural(approval.decided, 'decision')}, last ${period} days` : `No decisions in the last ${period} days`,
        tone: approval.avgDays !== null && approval.avgDays > 2 ? 'warning' : 'neutral',
      },
    },
    {
      key: 'rate',
      label: 'Approved',
      value: approvalRate === null ? '—' : `${approvalRate}%`,
      accent: DASH.green,
      icon: FactCheckOutlined,
      trend: {
        text: approval.rejected
          ? `${approval.rejected} rejected${approval.topReason ? ` · most often “${approval.topReason.reason}”` : ''}`
          : approval.decided
            ? 'None rejected'
            : '—',
      },
    },
    {
      key: 'answers',
      label: 'Quotes accepted',
      value: acceptRate === null ? '—' : `${acceptRate}%`,
      accent: DASH.amber,
      icon: HandshakeOutlined,
      trend: { text: answers.total ? `${answers.accepted} accepted · ${answers.declined} declined by dealers, last ${period} days` : `No dealer answers in the last ${period} days` },
    },
    {
      key: 'top',
      label: 'Top dealer',
      // The amount is the big figure; the dealer's name (often long) goes in the line below.
      value: topDealer ? money(topDealer.value) : '—',
      accent: DASH.navy,
      icon: EmojiEventsOutlined,
      trend: { text: topDealer ? `${topDealer.name} · ${topDealer.share}% of confirmed orders, last ${period} days` : `No confirmed orders in the last ${period} days` },
    },
  ]

  return (
    <Stack spacing={2}>
      {strips.length > 0 && <Stack spacing={1.25}>{strips}</Stack>}
      <KpiGrid items={tiles} columns={4} spacing={2.5} />
    </Stack>
  )
}
