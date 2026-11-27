import MonitorHeartOutlined from '@mui/icons-material/MonitorHeartOutlined'
import PaidOutlined from '@mui/icons-material/PaidOutlined'
import PendingActionsOutlined from '@mui/icons-material/PendingActionsOutlined'
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import { useState } from 'react'
import ActivityTimeline from '@/components/patterns/ActivityTimeline'
import AsyncContent from '@/components/patterns/AsyncContent'
import EmptyState from '@/components/patterns/EmptyState'
import InsightCard from '@/components/patterns/InsightCard'
import KpiGrid from '@/components/patterns/KpiGrid'
import QuickActions from '@/components/patterns/QuickActions'
import PageHeader from '@/components/ui/PageHeader'
import SectionTitle from '@/components/ui/SectionTitle'
import RegisterWarrantyDialog from '@/components/warranty/RegisterWarrantyDialog'
import SubmitClaimDialog from '@/components/warranty/SubmitClaimDialog'
import { COPILOT_PATH, MODULE_PATHS, MODULES } from '@/constants/modules'
import { toTimelineItems } from '@/lib/activity'
import { formatCurrency, formatDate } from '@/lib/format'
import { usePermissions } from '@/lib/rbac'
import { useLiveEvents } from '@/lib/live'
import { useToast } from '@/lib/toast'
import { useAsyncData } from '@/lib/useAsyncData'
import { getHome } from '@/services/dataService'

// Home, SRS v1.0 section 3.1 (FR-HOME-1 to 5), laid out as in the UI Design
// Concept. All figures and the AI insight come from the backend.

// FR-HOME-4. `?action=` lets the target page open the right form directly.
const QUICK_ACTIONS = [
  { key: 'createOrder', label: '+ Create Order', module: MODULES.ORDERS },
  { key: 'registerWarranty', label: 'Register Warranty', module: MODULES.WARRANTY },
  { key: 'submitClaim', label: 'Submit Claim', module: MODULES.WARRANTY },
]
// These two open their form right here on Home instead of going to another page.
const IN_PLACE_FORMS = ['registerWarranty', 'submitClaim']

function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const signedTrend = (value, suffix) => ({
  direction: value >= 0 ? 'up' : 'down',
  tone: value >= 0 ? 'positive' : 'negative',
  text: `${Math.abs(value)}${suffix}`,
})

// Tiles for modules the role can't open are absent from the response.
function buildKpis({ revenueYtd, healthScore, openOrders, pendingClaims }) {
  const tiles = []
  if (revenueYtd) {
    tiles.push({
      key: 'revenue',
      label: 'Revenue (YTD)',
      value: formatCurrency(revenueYtd.value, { compact: true }),
      accent: 'primary.main',
      icon: PaidOutlined,
      sparkline: revenueYtd.trend,
      trend: revenueYtd.changePct === null ? null : signedTrend(revenueYtd.changePct, '% vs last year'),
    })
  }
  if (healthScore) {
    const change = healthScore.changeThisMonth
    tiles.push({
      key: 'health',
      label: 'Health Score',
      value: healthScore.value === null ? '—' : `${healthScore.value} / 100`,
      accent: 'secondary.main',
      icon: MonitorHeartOutlined,
      trend: change === null ? null : change === 0 ? { text: 'No change this month' } : signedTrend(change, ' pts this month'),
    })
  }
  if (openOrders) {
    tiles.push({
      key: 'orders',
      label: 'Open Orders',
      value: openOrders.value,
      accent: 'warning.main',
      icon: PendingActionsOutlined,
      trend: openOrders.awaitingApproval
        ? { text: `${openOrders.awaitingApproval} awaiting approval`, tone: 'negative', direction: 'down' }
        : { text: 'None awaiting approval' },
    })
  }
  if (pendingClaims) {
    tiles.push({
      key: 'claims',
      label: 'Pending Claims',
      value: pendingClaims.value,
      accent: 'error.main',
      icon: ReportProblemOutlined,
      trend: pendingClaims.aging
        ? { text: `${pendingClaims.aging} waiting over ${pendingClaims.agingDays} days`, tone: 'negative' }
        : { text: 'None aging', tone: 'positive' },
    })
  }
  return tiles
}

export default function Home() {
  const { user, can } = usePermissions()
  const { data, loading, error, reload, refresh } = useAsyncData(getHome)
  // Live: Pending Claims and Recent Activity follow warranty changes.
  useLiveEvents(refresh)
  const [form, setForm] = useState(null) // 'registerWarranty' | 'submitClaim' while its form is open
  const toast = useToast()
  const formDone = (message) => {
    setForm(null)
    toast(message)
    reload() // Pending Claims and Recent Activity include it straight away
  }

  const firstName = user?.name?.split(' ')[0] ?? ''
  const dealer = data?.dealer
  const subtitle = dealer?.name ?? ''

  const kpis = data ? buildKpis(data.kpis) : []
  const insight = data?.insight
  const insightActions = insight
    ? [
        ...(can(insight.action.module)
          ? [{ key: 'action', label: insight.action.label, to: `${MODULE_PATHS[insight.action.module]}${insight.action.action ? `?action=${insight.action.action}` : ''}` }]
          : []),
        { key: 'copilot', label: 'Ask Copilot →', to: COPILOT_PATH, primary: true },
      ]
    : []
  const quickActions = QUICK_ACTIONS.filter((action) => can(action.module)).map((action) =>
    IN_PLACE_FORMS.includes(action.key)
      ? { key: action.key, label: action.label, onClick: () => setForm(action.key) }
      : { key: action.key, label: action.label, to: `${MODULE_PATHS[action.module]}?action=${action.key}` },
  )
  const activity = toTimelineItems(data?.activity)

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName}`} subtitle={subtitle} />

      <AsyncContent loading={loading} error={error} onRetry={reload} skeleton="dashboard">
        <Stack spacing={4.5}>
          {kpis.length > 0 && <KpiGrid items={kpis} columns={4} spacing={3.5} />}

          {insight && <InsightCard message={insight.message} evidence={insight.evidence} actions={insightActions} />}

          {quickActions.length > 0 && (
            <Box component="section">
              <SectionTitle>Quick Actions</SectionTitle>
              <QuickActions items={quickActions} />
            </Box>
          )}

          <Card component="section" sx={{ px: { xs: 2.5, md: 4.5 }, py: { xs: 2.5, md: 4 }, minHeight: 380 }}>
            <SectionTitle sx={{ mb: 2 }}>Recent Activity</SectionTitle>
            {activity.length > 0 ? (
              <ActivityTimeline items={activity} />
            ) : (
              <EmptyState title="No recent activity" message="New orders and claims will show here." />
            )}
          </Card>
        </Stack>
      </AsyncContent>

      {form === 'registerWarranty' && (
        <RegisterWarrantyDialog
          onClose={() => setForm(null)}
          onRegistered={(r) => formDone(`Warranty registered · serial number ${r.serialNumber} · covered until ${formatDate(r.warrantyUntil)}`)}
        />
      )}
      {form === 'submitClaim' && (
        <SubmitClaimDialog onClose={() => setForm(null)} onSubmitted={(c) => formDone(`Claim ${c.id} submitted for ${c.serialNumber}`)} />
      )}
    </>
  )
}
