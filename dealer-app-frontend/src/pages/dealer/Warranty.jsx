import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AsyncContent from '@/components/patterns/AsyncContent'
import KpiGrid from '@/components/patterns/KpiGrid'
import PageHeader from '@/components/ui/PageHeader'
import { formatCurrency, formatDayMonth, formatPercent } from '@/lib/format'
import { useAsyncData } from '@/lib/useAsyncData'
import { getClaims, getClaimsSummary } from '@/services/dataService'

// Warranty & Claims, SRS v1.0 section 3.7 (FR-WAR-2 to 4), as in the UI Design
// Concept. View only: the dealer tracks its claims; the decision (approve,
// reject, reimburse) is the manufacturer's, so there are no stage buttons.

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
        ? { text: `${summary.aging} aging > ${summary.agingDays} days`, tone: 'negative', direction: 'down' }
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
function ClaimCard({ claim, agingDays }) {
  const aging = WAITING.has(claim.stage) && claim.ageDays > agingDays
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
        ...(aging && { borderColor: 'error.main', borderLeftWidth: 4 }),
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: 14, color: 'brand.navy' }}>{claim.id}</Typography>
      <Typography sx={{ fontSize: 14, flexGrow: 1, textAlign: 'right' }}>{formatCurrency(claim.amount)}</Typography>
      <Typography
        variant="caption"
        title={claim.stage === 'reimbursed' ? 'Paid on' : 'Days in this stage'}
        sx={{ minWidth: 44, textAlign: 'right', color: aging ? 'error.main' : 'text.secondary', fontWeight: aging ? 700 : 400 }}
      >
        {claim.stage === 'reimbursed' ? formatDayMonth(claim.resolvedAt ?? claim.stageChangedAt) : `${claim.ageDays}d`}
      </Typography>
    </Card>
  )
}

// FR-WAR-2: one column per stage.
function BoardColumn({ column, claims, agingDays }) {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.default', height: '100%' }}>
      <Box sx={{ px: 2, py: 1.5, bgcolor: column.color, color: 'common.white' }}>
        <Typography sx={{ fontWeight: 700 }}>
          {column.label} ({claims.length})
        </Typography>
      </Box>
      <Stack spacing={1} sx={{ p: 1.5, maxHeight: 520, overflowY: 'auto' }}>
        {claims.length ? (
          claims.map((claim) => <ClaimCard key={claim.id} claim={claim} agingDays={agingDays} />)
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
  const { data, loading, error, reload } = useAsyncData(loadWarranty)
  const summary = data?.summary

  return (
    <>
      <PageHeader title="Warranty & Claims" subtitle="4-stage pipeline  ·  board view" />
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
