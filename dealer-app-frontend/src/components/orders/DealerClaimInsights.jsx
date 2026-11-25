import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded'
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded'
import GppMaybeOutlined from '@mui/icons-material/GppMaybeOutlined'
import PolicyOutlined from '@mui/icons-material/PolicyOutlined'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useState } from 'react'
import { HBarChart } from '@/components/patterns/BarCharts'
import SectionCard from '@/components/patterns/SectionCard'
import { DASH } from '@/constants/dashboardColors'
import { formatDate, formatNumber } from '@/lib/format'
import LiveBadge from '@/components/ui/LiveBadge'
import { describeLiveEvent, useLiveEvents } from '@/lib/live'
import { usePermissions } from '@/lib/rbac'
import { useToast } from '@/lib/toast'
import { useAsyncData } from '@/lib/useAsyncData'
import { getClaimInsights, setDealerInvestigation } from '@/services/dataService'

// Dealer claim insights on the manufacturer's Order Approvals page: a strip
// when dealers show unusual claim activity, a chart of claims per 100
// installed units against the network, the dealers to review with the
// reasons, and a details dialog where a dealer can be flagged for
// investigation. Rules and figures come from GET /manufacturer/claim-insights.

const RISK = {
  high: { label: 'Investigate', icon: ErrorOutlineRounded, color: DASH.red, text: DASH.redDark, bg: DASH.redLight },
  medium: { label: 'Watch', icon: WarningAmberRounded, color: DASH.amber, text: DASH.amberDark, bg: DASH.amberLight },
  normal: { label: 'Normal', icon: CheckCircleOutlineRounded, color: DASH.teal, text: DASH.tealDark, bg: DASH.tealLight },
}

// Risk as icon + text (never colour alone).
function RiskBadge({ risk }) {
  const r = RISK[risk]
  const Icon = r.icon
  return <Chip size="small" icon={<Icon />} label={r.label} sx={{ fontWeight: 700, bgcolor: r.bg, color: r.text, '& .MuiChip-icon': { color: r.color } }} />
}

function GreyBox({ label, value, note }) {
  return (
    <Box sx={{ bgcolor: DASH.boxGrey, borderRadius: '10px', p: 1.5, height: '100%' }}>
      <Typography sx={{ fontSize: 12.5, color: DASH.muted, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 18, color: DASH.navy }}>{value}</Typography>
      {note && <Typography sx={{ fontSize: 12, color: DASH.muted }}>{note}</Typography>}
    </Box>
  )
}

// One dealer in full: why it stands out, figures, investigation, recent claims.
function DealerClaimsDialog({ dealer, network, busy, error, onFlag, onCloseInvestigation, onClose }) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [flagging, setFlagging] = useState(false)
  const [note, setNote] = useState('')

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth aria-labelledby="dealer-claims-title">
      <DialogTitle id="dealer-claims-title" sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, color: DASH.navy }}>{dealer.name}</Typography>
            <Typography sx={{ fontSize: 13.5, color: DASH.muted }}>
              {dealer.region} · {dealer.tier} dealer · warranty claims
            </Typography>
          </Box>
          <RiskBadge risk={dealer.risk} />
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {dealer.investigation && (
          <Box sx={{ p: 1.5, mb: 2, borderRadius: '10px', bgcolor: DASH.navyLight, display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <PolicyOutlined sx={{ color: DASH.navy }} />
            <Box>
              <Typography sx={{ fontWeight: 700, color: DASH.navy }}>Under investigation</Typography>
              <Typography sx={{ fontSize: 13.5, color: DASH.muted }}>
                Since {formatDate(dealer.investigation.since)}
                {dealer.investigation.by ? ` · flagged by ${dealer.investigation.by}` : ''}
                {dealer.investigation.note ? ` · “${dealer.investigation.note}”` : ''}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Key figures: how this dealer compares with the average dealer */}
        <Grid container spacing={1.25} sx={{ mb: 2.5 }}>
          <Grid size={4}>
            <GreyBox label="Claims per 100 units" value={dealer.ratePer100.toFixed(1)} note={`average ${network.ratePer100.toFixed(1)}`} />
          </Grid>
          <Grid size={4}>
            <GreyBox label="Total claims" value={formatNumber(dealer.claims)} note={`${formatNumber(dealer.units)} units sold`} />
          </Grid>
          <Grid size={4}>
            <GreyBox label="Last 90 days" value={formatNumber(dealer.last90)} note="claims" />
          </Grid>
        </Grid>

        {/* Reasons, as a short list of plain headlines */}
        <Typography sx={{ fontWeight: 700, color: DASH.navy, mb: 0.5 }}>{dealer.flags.length ? 'Why it stands out' : 'Looks normal'}</Typography>
        {dealer.flags.length ? (
          <Box component="ul" sx={{ m: 0, pl: 2.5, color: DASH.navy }}>
            {dealer.flags.map((f) => (
              <Typography component="li" key={f.key} sx={{ fontSize: 14.5, py: 0.25 }}>
                {f.label}
              </Typography>
            ))}
          </Box>
        ) : (
          <Typography sx={{ color: DASH.muted }}>No unusual claim patterns compared with other dealers.</Typography>
        )}

        {flagging && (
          <TextField
            label="Note (optional)"
            fullWidth
            multiline
            minRows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Check the last 90 days of claims with the dealer"
            slotProps={{ htmlInput: { maxLength: 300 } }}
            sx={{ mt: 2.5 }}
            autoFocus
          />
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ minHeight: 44 }}>
          Close
        </Button>
        {dealer.investigation ? (
          <Button onClick={onCloseInvestigation} loading={busy} variant="outlined" sx={{ minHeight: 44 }}>
            Close investigation
          </Button>
        ) : flagging ? (
          <Button variant="contained" color="error" onClick={() => onFlag(note.trim() || null)} loading={busy} sx={{ minHeight: 44 }}>
            Confirm flag
          </Button>
        ) : (
          <Button variant="contained" color="error" startIcon={<GppMaybeOutlined />} onClick={() => setFlagging(true)} sx={{ minHeight: 44 }}>
            Flag for investigation
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default function DealerClaimInsights() {
  const toast = useToast()
  const { data: loaded, error: loadError, refresh } = useAsyncData(getClaimInsights)
  const [updated, setUpdated] = useState(null)
  const { user } = usePermissions()
  // Live: a dealer's new claim or registration updates the insights at once.
  useLiveEvents((event) => {
    setUpdated(null)
    refresh()
    if (event.by !== user?.id) {
      const message = describeLiveEvent(event)
      if (message) toast(message, 'info')
    }
  })
  const [openId, setOpenId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const data = updated ?? loaded
  if (loadError) return <Alert severity="error">Claim insights: {loadError.message}</Alert>
  if (!data) return null

  const { dealers, network } = data
  const high = dealers.filter((d) => d.risk === 'high')
  // The banner names only the dealer furthest above the network average.
  const worst = high.reduce((top, d) => (!top || d.rateVsNetwork > top.rateVsNetwork ? d : top), null)
  const toReview = dealers.filter((d) => d.risk !== 'normal' || d.investigation)
  const open = dealers.find((d) => d.id === openId)

  const openDealer = (id) => {
    setError(null)
    setOpenId(id)
  }
  const changeInvestigation = async (dealer, isOpen, note = null) => {
    setBusy(true)
    setError(null)
    try {
      setUpdated(await setDealerInvestigation(dealer.id, isOpen, note))
      toast(isOpen ? `${dealer.name} flagged for investigation.` : `Investigation of ${dealer.name} closed.`)
      setOpenId(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const chartRows = [...dealers]
    .sort((a, b) => b.ratePer100 - a.ratePer100)
    .map((d) => ({
      key: d.id,
      label: d.name,
      sublabel: `${d.claims} claims · ${formatNumber(d.units)} units`,
      value: d.ratePer100,
      marker: network.ratePer100,
      color: RISK[d.risk].color,
      flag: <Box component={RISK[d.risk].icon} titleAccess={RISK[d.risk].label} sx={{ fontSize: 18, color: RISK[d.risk].color }} />,
      tip: { title: d.name, lines: [`${d.ratePer100.toFixed(2)} claims per 100 units (${d.rateVsNetwork.toFixed(1)}× network)`, RISK[d.risk].label, 'Click for details'] },
    }))

  return (
    <>
      <Stack id="claim-insights" spacing={2} sx={{ scrollMarginTop: 96 }}>
        {high.length > 0 && (
          <Box
            role="alert"
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, pl: 2, pr: 1, borderRadius: '12px', bgcolor: DASH.redLight, borderLeft: `4px solid ${DASH.red}`, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}
          >
            <GppMaybeOutlined sx={{ color: DASH.red, flexShrink: 0 }} />
            <Typography sx={{ flexGrow: 1, color: DASH.redDark, fontWeight: 600, py: 0.75 }}>
              {high.length === 1
                ? `1 dealer has too many warranty claims: ${high[0].name}`
                : `${high.length} dealers have too many warranty claims (highest: ${worst.name})`}
            </Typography>
            <Button
              variant="contained"
              onClick={() => document.getElementById('dealers-to-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              sx={{ minHeight: 44, px: 2.5, flexShrink: 0, bgcolor: DASH.navy, '&:hover': { bgcolor: '#2a2f63' } }}
            >
              Review
            </Button>
          </Box>
        )}

        <SectionCard
          title="Dealer claim insights"
          subtitle={`Warranty claims per 100 installed units · network average ${network.ratePer100.toFixed(1)} · ${data.flaggedCount} of ${network.dealers} dealers flagged${data.underInvestigation ? ` · ${data.underInvestigation} under investigation` : ''}`}
          sx={{ border: `1px solid ${DASH.border}`, borderRadius: '12px', boxShadow: 'none' }}
          actions={
            <Box sx={{ mt: 1 }}>
              <LiveBadge />
            </Box>
          }
        >
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Typography sx={{ fontSize: 13.5, color: DASH.muted, mb: 1 }}>
                Claims per 100 units sold. The black line is the average of all dealers.
              </Typography>
              {/* Colour key: what red, amber and green mean */}
              <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', mb: 0.5 }}>
                {Object.values(RISK).map((r) => (
                  <Stack key={r.label} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: r.color }} />
                    <Typography sx={{ fontSize: 13, color: DASH.muted }}>{r.label}</Typography>
                  </Stack>
                ))}
              </Stack>
              <HBarChart
                rows={chartRows}
                onRowClick={openDealer}
                tooltips={false}
                formatValue={(v) => v.toFixed(1)}
                markerLabel={`Average ${network.ratePer100.toFixed(1)}`}
                ariaLabel="Warranty claims per 100 installed units by dealer"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Typography id="dealers-to-review" sx={{ fontWeight: 700, color: DASH.navy, mb: 1, scrollMarginTop: 96 }}>
                Dealers to review
              </Typography>
              {toReview.length === 0 && <Typography sx={{ color: DASH.muted }}>No dealer shows unusual claim activity.</Typography>}
              <Stack spacing={1}>
                {toReview.map((d) => (
                  <Box
                    key={d.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open claim details of ${d.name}`}
                    onClick={() => openDealer(d.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openDealer(d.id))}
                    sx={{
                      p: 1.5,
                      borderRadius: '10px',
                      border: `1px solid ${DASH.border}`,
                      borderLeft: `4px solid ${RISK[d.risk].color}`,
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'background-color 120ms',
                      '&:hover, &:focus-visible': { bgcolor: DASH.boxGrey },
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontWeight: 700, color: DASH.navy, fontSize: 14.5 }}>{d.name}</Typography>
                      <RiskBadge risk={d.risk} />
                    </Stack>
                    <Typography sx={{ fontSize: 13, color: DASH.muted, mt: 0.5 }}>
                      {d.flags.map((f) => f.label).join(' · ') || 'No unusual pattern'}
                      {d.investigation ? ' · under investigation' : ''}
                    </Typography>
                  </Box>
                ))}
              </Stack>
              <Typography sx={{ fontSize: 12, color: DASH.muted, mt: 1.5 }}>
                Compared with the network: claim rate, last-90-day rate, repeat claims on a unit, claims soon after install, claim amounts and rejections.
              </Typography>
            </Grid>
          </Grid>
        </SectionCard>
      </Stack>

      {open && (
        <DealerClaimsDialog
          key={open.id}
          dealer={open}
          network={network}
          busy={busy}
          error={error}
          onFlag={(note) => changeInvestigation(open, true, note)}
          onCloseInvestigation={() => changeInvestigation(open, false)}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  )
}
