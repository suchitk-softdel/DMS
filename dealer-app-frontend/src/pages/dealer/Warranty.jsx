import AddTaskOutlined from '@mui/icons-material/AddTaskOutlined'
import PostAddOutlined from '@mui/icons-material/PostAddOutlined'
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AsyncContent from '@/components/patterns/AsyncContent'
import KpiGrid from '@/components/patterns/KpiGrid'
import PageHeader from '@/components/ui/PageHeader'
import RegisterWarrantyDialog from '@/components/warranty/RegisterWarrantyDialog'
import SubmitClaimDialog from '@/components/warranty/SubmitClaimDialog'
import { formatCurrency, formatDate, formatDayMonth, formatPercent } from '@/lib/format'
import LiveBadge from '@/components/ui/LiveBadge'
import { describeLiveEvent, useLiveEvents } from '@/lib/live'
import { usePermissions } from '@/lib/rbac'
import { useToast } from '@/lib/toast'
import { useAsyncData } from '@/lib/useAsyncData'
import { getClaims, getClaimsSummary } from '@/services/dataService'

// Warranty & Claims, SRS v1.0 section 3.7 (FR-WAR-1 to 4), as in the UI Design
// Concept. The dealer registers installed units and submits claims (FR-WAR-1);
// the decision (approve, reject, reimburse) is the manufacturer's, so the board
// has no stage buttons.

// Forms that ?action= can open.
const FORMS = ['registerWarranty', 'submitClaim']

const COLUMNS = [
  { stage: 'submitted', label: 'Submitted', color: 'grey.600' },
  { stage: 'underReview', label: 'Under Review', color: 'warning.main' },
  { stage: 'approved', label: 'Approved', color: 'primary.main' },
  { stage: 'reimbursed', label: 'Reimbursed', color: 'brand.navy' },
]
// Stages where the dealer is still waiting for a decision (aging applies).
const WAITING = new Set(['submitted', 'underReview'])

// Claims in one stage. Waiting stages: longest-waiting first, so aging claims
// are on top; the others: newest first (as the API returns them).
const claimsIn = (claims, stage) => {
  const rows = claims.filter((claim) => claim.stage === stage)
  return WAITING.has(stage) ? rows.sort((a, b) => b.ageDays - a.ageDays) : rows
}

const loadWarranty =() => Promise.all([getClaims(), getClaimsSummary()]).then(([claims, summary]) => ({ claims, summary }))

function buildKpis(summary) {
  return [
    {
      key: 'open',
      label: 'Open Claims',
      value: String(summary.openClaims),
      accent: 'warning.main',
      icon: ReportProblemOutlined,
      trend: summary.aging
        ? { text: `${summary.aging} waiting over ${summary.agingDays} days`, tone: 'negative' }
        : { text: 'None aging', tone: 'positive' },
    },
    {
      key: 'resolution',
      label: 'Avg. Resolution',
      value: summary.avgResolutionDays === null ? '—' : `${Math.round(summary.avgResolutionDays)} days`,
      accent: 'primary.main',
      icon: ScheduleOutlined,
      trend: { text: `Filing to decision · last 12 months (${summary.decided} claims)` },
    },
    {
      key: 'approval',
      label: 'Approval Rate',
      value: summary.approvalRate === null ? '—' : formatPercent(summary.approvalRate, { fromRatio: true, decimals: 0 }),
      accent: 'brand.navy',
      icon: TaskAltOutlined,
      trend: { text: `${summary.rejected} rejected · last 12 months` },
    },
  ]
}

// FR-WAR-3: one short line per claim: Claim ID, Amount and Age (days in the
// current stage; paid date once reimbursed). The SKU and product show on hover.
// isNew: arrived through a live update a moment ago (teal outline + "New").
// Every waiting claim is shown in red; the days are bold once it is aging
// (more than agingDays in its stage). Resolved claims have no colour.
function ClaimCard({ claim, agingDays, isNew = false }) {
  const aging = WAITING.has(claim.stage) && claim.ageDays > agingDays
  const color = WAITING.has(claim.stage) ? 'error.main' : null
  return (
    <Card
      variant="outlined"
      title={`${claim.product.sku} · ${claim.product.name}`}
      sx={{
        px: 1.75,
        py: 1.25,
        borderRadius: 1.5,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'baseline',
        gap: 1.5,
        ...(color && { borderColor: color, borderLeftWidth: 4 }),
        ...(isNew && { borderColor: 'primary.main', boxShadow: (t) => `0 0 0 2px ${t.palette.primary.main}33`, transition: 'box-shadow 300ms' }),
      }}
    >
      {isNew && (
        <Typography component="span" sx={{ fontSize: 11, fontWeight: 700, color: 'common.white', bgcolor: 'primary.main', px: 0.75, borderRadius: 1, alignSelf: 'center' }}>
          New
        </Typography>
      )}
      <Typography sx={{ fontWeight: 700, fontSize: 14, color: 'brand.navy' }}>{claim.id}</Typography>
      <Typography sx={{ fontSize: 14, flexGrow: 1, textAlign: 'right' }}>{formatCurrency(claim.amount)}</Typography>
      <Typography
        variant="caption"
        title={claim.stage === 'reimbursed' ? 'Paid on' : 'Days in this stage'}
        sx={{ minWidth: 44, textAlign: 'right', color: color ?? 'text.secondary', fontWeight: aging ? 700 : 600 }}
      >
        {claim.stage === 'reimbursed' ? formatDayMonth(claim.resolvedAt ?? claim.stageChangedAt) : `${claim.ageDays}d`}
      </Typography>
    </Card>
  )
}

// FR-WAR-2: one column per stage.
function BoardColumn({ column, claims, agingDays, newIds = [] }) {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.default', height: '100%' }}>
      <Box sx={{ px: 2, py: 1.5, bgcolor: column.color, color: 'common.white' }}>
        <Typography sx={{ fontWeight: 700 }}>
          {column.label} ({claims.length})
        </Typography>
      </Box>
      <Stack spacing={1} sx={{ p: 1.5, maxHeight: 520, overflowY: 'auto' }}>
        {claims.length ? (
          claims.map((claim) => <ClaimCard key={claim.id} claim={claim} agingDays={agingDays} isNew={newIds.includes(claim.id)} />)
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No claims
          </Typography>
        )}
      </Stack>
    </Box>
  )
}

export default function Warranty() {
  const { data, loading, error, reload, refresh } = useAsyncData(loadWarranty)
  const { user } = usePermissions()
  const [newIds, setNewIds] = useState([]) // claims that just arrived live
  const summary = data?.summary
  const [searchParams, setSearchParams] = useSearchParams()
  // ?action=registerWarranty | submitClaim (e.g. from a Copilot answer) opens that form.
  const [form, setForm] = useState(() => (FORMS.includes(searchParams.get('action')) ? searchParams.get('action') : null))
  const toast = useToast()

  // Remove ?action= once used, so a page refresh does not open the form again.
  useEffect(() => {
    if (searchParams.has('action')) setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  // Live: refresh the board when warranty data changes; tell the user when
  // someone else made the change, and mark a new claim for a few seconds.
  useLiveEvents((event) => {
    refresh()
    if (event.action === 'claim.submitted' && event.id) {
      setNewIds((ids) => [...ids, event.id])
      setTimeout(() => setNewIds((ids) => ids.filter((id) => id !== event.id)), 15_000)
    }
    if (event.by !== user?.id) {
      const message = describeLiveEvent(event)
      if (message) toast(message, 'info')
    }
  })

  const formDone = (message) => {
    setForm(null)
    toast(message)
    reload()
  }

  return (
    <>
      <PageHeader
        title="Warranty & Claims"
        subtitle="4-stage pipeline  ·  board view"
        actions={
          <>
            <Button variant="contained" startIcon={<AddTaskOutlined />} onClick={() => setForm('registerWarranty')}>
              Register Warranty
            </Button>
            <Button variant="outlined" startIcon={<PostAddOutlined />} onClick={() => setForm('submitClaim')} sx={{ bgcolor: 'background.paper' }}>
              Submit Claim
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <LiveBadge />
          </>
        }
      />
      {form === 'registerWarranty' && (
        <RegisterWarrantyDialog
          onClose={() => setForm(null)}
          onRegistered={(r) => formDone(`Warranty registered · serial number ${r.serialNumber} · covered until ${formatDate(r.warrantyUntil)}`)}
        />
      )}
      {form === 'submitClaim' && (
        <SubmitClaimDialog onClose={() => setForm(null)} onSubmitted={(c) => formDone(`Claim ${c.id} submitted for ${c.serialNumber}`)} />
      )}
      <AsyncContent loading={loading} error={error} onRetry={reload} skeleton="dashboard">
        {data && (
          <Stack spacing={3.5}>
            <KpiGrid items={buildKpis(summary)} columns={3} spacing={3.5} />
            <Grid container spacing={2.5}>
              {COLUMNS.map((column) => (
                <Grid key={column.stage} size={{ xs: 12, sm: 6, lg: 3 }}>
                  <BoardColumn
                    column={column}
                    claims={claimsIn(data.claims, column.stage)}
                    agingDays={summary.agingDays}
                    newIds={newIds}
                  />
                </Grid>
              ))}
            </Grid>
          </Stack>
        )}
      </AsyncContent>
    </>
  )
}
