import MonitorHeartOutlined from '@mui/icons-material/MonitorHeartOutlined'
import PaidOutlined from '@mui/icons-material/PaidOutlined'
import PublicOutlined from '@mui/icons-material/PublicOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import ActivityTimeline from '@/components/patterns/ActivityTimeline'
import AsyncContent from '@/components/patterns/AsyncContent'
import EmptyState from '@/components/patterns/EmptyState'
import KpiGrid from '@/components/patterns/KpiGrid'
import LineChart from '@/components/patterns/LineChart'
import PageHeader from '@/components/ui/PageHeader'
import SectionTitle from '@/components/ui/SectionTitle'
import { COPILOT_PATH, MODULE_PATHS } from '@/constants/modules'
import { toTimelineItems } from '@/lib/activity'
import { formatCurrency, formatPercent } from '@/lib/format'
import { useAsyncData } from '@/lib/useAsyncData'
import { getDealer360 } from '@/services/dataService'

// Dealer 360 / My Performance, SRS v1.0 section 3.3 (FR-D360-1 to 5), laid out
// as in the UI Design Concept. All figures come from the backend; the Health
// Score weights are set per manufacturer in the database (FR-D360-6).

const WINDOWS = [6, 12, 24]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const STATUS_LABELS = { active: null, pending: 'Pending', onHold: 'On hold' }

const signedTrend = (value, suffix) => ({
  direction: value >= 0 ? 'up' : 'down',
  tone: value >= 0 ? 'positive' : 'negative',
  text: `${Math.abs(value)}${suffix}`,
})
const monthName = (key) => MONTHS[Number(key.slice(5, 7)) - 1]
const monthYear = (key) => `${monthName(key)} ${key.slice(0, 4)}`
const joinedLabel = (date) => {
  const d = new Date(date)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

// FR-D360-1: Revenue, Growth %, Health Score and Territory Coverage.
// `trend` (monthly revenue) feeds the small line on the Revenue tile.
function buildKpis({ revenue, growth, healthScore, territoryCoverage }, dealer, trend) {
  const isNew = revenue.changePct === null
  return [
    {
      key: 'revenue',
      label: 'Revenue (12 months)',
      value: formatCurrency(revenue.value, { compact: true }),
      accent: 'primary.main',
      icon: PaidOutlined,
      // Last 12 complete months (the current month is unfinished).
      sparkline: trend.filter((p) => !p.partial).slice(-12).map((p) => p.revenue),
      trend: isNew ? { text: 'Less than 2 years of history' } : signedTrend(revenue.changePct, '% vs previous 12 months'),
    },
    {
      key: 'growth',
      label: 'Growth',
      icon: TrendingUpOutlined,
      value: isNew ? 'New' : formatPercent(growth.value, { signed: true }),
      accent: 'secondary.main',
      trend: isNew
        ? { text: `Joined ${joinedLabel(dealer.createdAt)}` }
        : growth.changeThisMonth === null || growth.changeThisMonth === 0
          ? { text: 'No change this month' }
          : signedTrend(growth.changeThisMonth, ' pts this month'),
    },
    {
      key: 'health',
      label: 'Health Score',
      value: healthScore.value === null ? '—' : `${healthScore.value} / 100`,
      accent: 'brand.tealDark',
      icon: MonitorHeartOutlined,
      trend:
        healthScore.changeThisMonth === null || healthScore.changeThisMonth === 0
          ? { text: 'No change this month' }
          : signedTrend(healthScore.changeThisMonth, ' pts this month'),
    },
    {
      key: 'coverage',
      label: 'Territory Coverage',
      icon: PublicOutlined,
      value: formatPercent(territoryCoverage.value, { fromRatio: true, decimals: 0 }),
      accent: 'warning.main',
      trend: { text: 'of assigned territory served' },
    },
  ]
}

// FR-D360-2: revenue trend with a 6 / 12 / 24-month window.
function RevenueTrend({ trend }) {
  const [months, setMonths] = useState(12)
  const shown = trend.slice(-months)
  const points = shown.map((p) => ({
    key: p.month,
    // Short month; the year is added in January and on the first point.
    label: months === 24 && (p.month.endsWith('-01') || p === shown[0]) ? `${monthName(p.month)} ${p.month.slice(2, 4)}` : monthName(p.month),
    tooltipLabel: monthYear(p.month),
    value: p.revenue,
    compare: p.lastYear,
    partial: p.partial,
  }))
  const total = shown.reduce((sum, p) => sum + (p.revenue ?? 0), 0)

  return (
    <Card component="section" sx={{ height: '100%', px: { xs: 2.5, md: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 1.5 }}>
        <Box>
          <SectionTitle sx={{ mb: 0.5 }}>Revenue Trend</SectionTitle>
          <Typography variant="body2" color="text.secondary">
            {formatCurrency(total)} from {monthYear(shown[0].month)} to {monthYear(shown[shown.length - 1].month)}
            {shown[shown.length - 1].partial ? ' (to date)' : ''} · fulfilled orders
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={months}
          onChange={(_, value) => value && setMonths(value)}
          aria-label="Months shown"
        >
          {WINDOWS.map((m) => (
            <ToggleButton key={m} value={m} sx={{ px: 1.75 }}>
              {m}M
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      <Box sx={{ mt: 2.5 }}>
        <LineChart
          points={points}
          height={280}
          seriesLabel="Revenue"
          compareLabel="Same month last year"
          formatValue={(v, { exact } = {}) => formatCurrency(v, { compact: !exact })}
          ariaLabel={`Monthly revenue for the last ${months} months, ${formatCurrency(total)} in total.`}
        />
      </Box>
    </Card>
  )
}

const scoreColor = (score) => (score >= 70 ? 'primary' : score >= 40 ? 'warning' : 'error')

// FR-D360-3: explainable Health Score, one bar per weighted component.
function HealthBreakdown({ health }) {
  const scored = health.components.filter((c) => c.score !== null)
  const totalWeight = scored.reduce((sum, c) => sum + c.weight, 0) || 1

  return (
    <Card component="section" sx={{ height: '100%', px: { xs: 2.5, md: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <SectionTitle sx={{ mb: 0.5 }}>Health Score Breakdown</SectionTitle>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Overall {health.score ?? '—'} / 100, the weighted average of the components below
      </Typography>
      <Stack spacing={2.75}>
        {health.components.map((c) => (
          <Box key={c.key}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
              <Typography sx={{ fontWeight: 600 }}>
                {c.label}
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  {c.score === null ? 'not scored' : `${Math.round((c.weight / totalWeight) * 100)}% weight`}
                </Typography>
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{c.score ?? '—'}</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={c.score ?? 0}
              color={c.score === null ? 'inherit' : scoreColor(c.score)}
              aria-label={`${c.label}: ${c.score ?? 'not scored'} out of 100`}
              sx={{ height: 10, borderRadius: 5, bgcolor: 'grey.100' }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {c.evidence}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Card>
  )
}

// FR-D360-4: recommendations tied to Health Score components, with evidence.
function Recommendations({ items }) {
  return (
    <Card component="section" sx={{ height: '100%', px: { xs: 2.5, md: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <SectionTitle sx={{ mb: 0 }}>AI Recommendations</SectionTitle>
        <Button component={RouterLink} to={COPILOT_PATH} size="small">
          Ask Copilot →
        </Button>
      </Stack>
      {items.length === 0 ? (
        <EmptyState title="Nothing to act on" message="Every Health Score component is in good shape." />
      ) : (
        <Stack component="ol" spacing={2.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {items.map((rec, index) => (
            <Stack component="li" key={rec.key} direction="row" spacing={2}>
              <Box
                aria-hidden
                sx={{
                  width: 34,
                  height: 34,
                  flexShrink: 0,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: 'common.white',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                }}
              >
                {index + 1}
              </Box>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{rec.title}</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {rec.detail}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontStyle: 'italic' }}>
                  Evidence: {rec.evidence.join(' · ')}
                </Typography>
                <Stack direction="row" spacing={1.5} sx={{ mt: 1, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                  <Typography variant="body2" sx={{ color: 'brand.tealDark', fontWeight: 600 }}>
                    {rec.component.label} · {rec.component.score ?? '—'} / 100
                  </Typography>
                  {rec.action && (
                    <Button component={RouterLink} to={MODULE_PATHS[rec.action.module]} size="small" variant="outlined">
                      {rec.action.label}
                    </Button>
                  )}
                </Stack>
              </Box>
            </Stack>
          ))}
        </Stack>
      )}
    </Card>
  )
}

export default function Dealer360() {
  const { data, loading, error, reload } = useAsyncData(getDealer360)
  const dealer = data?.dealer
  const status = dealer ? STATUS_LABELS[dealer.status] : null
  const subtitle = dealer
    ? [dealer.name, dealer.region, `${dealer.tier} Tier`, `${dealer.city}, ${dealer.state}`, status].filter(Boolean).join('  ·  ')
    : ''
  const timeline = toTimelineItems(data?.timeline)

  return (
    <>
      <PageHeader title="My Dealer 360" subtitle={subtitle} />

      <AsyncContent
        loading={loading}
        error={error}
        onRetry={reload}
        skeleton="dashboard"
        empty={Boolean(data) && !data.kpis}
        emptyTitle="No performance data"
        emptyMessage="Dealer 360 needs the backend: start dealer-app-backend and set VITE_USE_MOCK_DATA=false."
      >
        {data?.kpis && (
          <Stack spacing={3.5}>
            <KpiGrid items={buildKpis(data.kpis, dealer, data.trend)} columns={4} spacing={3.5} />

            <Grid container spacing={3.5}>
              <Grid size={{ xs: 12, lg: 7 }}>
                <RevenueTrend trend={data.trend} />
              </Grid>
              <Grid size={{ xs: 12, lg: 5 }}>
                <HealthBreakdown health={data.health} />
              </Grid>
              <Grid size={{ xs: 12, lg: 7 }}>
                <Recommendations items={data.recommendations} />
              </Grid>
              <Grid size={{ xs: 12, lg: 5 }}>
                <Card component="section" sx={{ height: '100%', px: { xs: 2.5, md: 4 }, py: { xs: 2.5, md: 3.5 } }}>
                  <SectionTitle sx={{ mb: 1 }}>Dealer Timeline</SectionTitle>
                  {timeline.length > 0 ? (
                    <ActivityTimeline items={timeline} />
                  ) : (
                    <EmptyState title="No events yet" message="Orders, claims and training will show here." />
                  )}
                </Card>
              </Grid>
            </Grid>
          </Stack>
        )}
      </AsyncContent>
    </>
  )
}
