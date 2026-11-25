import { useEffect, useState } from 'react'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Link from '@mui/material/Link'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import MonthChart from '@/components/copilot/MonthChart'
import { MODULE_PATHS, MODULES } from '@/constants/modules'
import { usePermissions } from '@/lib/rbac'
import { getCopilotRecords } from '@/services/dataService'

const WORD_DELAY_MS = 28
// Text colours for the change under the big number (AA contrast on white).
const UP_COLOR = '#047F8C'
const DOWN_COLOR = '#B42F43'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Reveals the text word by word, like a person typing; calls onDone at the end.
function useTypewriter(text, animate, onDone) {
  const words = text.split(' ')
  const skip = !animate || prefersReducedMotion()
  const [shown, setShown] = useState(skip ? words.length : 0)

  useEffect(() => {
    if (skip) return undefined
    if (shown >= words.length) {
      onDone?.()
      return undefined
    }
    const timer = setTimeout(() => setShown((n) => n + 1), WORD_DELAY_MS)
    return () => clearTimeout(timer)
  }, [shown, skip, words.length, onDone])

  return { text: words.slice(0, shown).join(' '), done: shown >= words.length }
}

function toCsv(columns, rows) {
  const cell = (value) => `"${String(value).replaceAll('"', '""')}"`
  return [columns, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
}

function downloadCsv(columns, rows, name) {
  const url = URL.createObjectURL(new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  link.click()
  URL.revokeObjectURL(url)
}

// The chart's months as rows, so a month answer can be downloaded too.
function chartRows(chart) {
  const columns = ['Month', chart.currentLabel, ...(chart.previousLabel ? [chart.previousLabel, 'Change %'] : [])]
  const rows = chart.points.map((p) => [
    `${p.label} ${p.year}${p.partial ? ' (to date)' : ''}`,
    p.display,
    ...(chart.previousLabel ? [p.previousDisplay ?? '', p.changePct ?? ''] : []),
  ])
  return { columns, rows }
}

function answerAsText(answer) {
  const lines = [answer.text]
  if (answer.table) {
    lines.push('', answer.table.columns.join('\t'), ...answer.table.rows.map((row) => row.join('\t')))
  }
  if (answer.evidence?.length) lines.push('', `Based on: ${answer.evidence.join(' · ')}`)
  return lines.join('\n')
}

// The big number once, with the change below it (arrow + colour + words).
function Highlight({ highlight, compact }) {
  const { value, change } = highlight
  const up = change?.direction === 'up'
  const down = change?.direction === 'down'
  const Arrow = up ? ArrowUpwardRoundedIcon : down ? ArrowDownwardRoundedIcon : null
  return (
    <Box sx={{ mb: 1 }}>
      <Typography sx={{ fontSize: compact ? 28 : { xs: 30, md: 36 }, fontWeight: 700, lineHeight: 1.15, color: 'text.primary' }}>{value}</Typography>
      {change && (
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
          {Arrow && <Arrow sx={{ fontSize: 18, color: up ? UP_COLOR : DOWN_COLOR }} aria-hidden />}
          <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: up ? UP_COLOR : down ? DOWN_COLOR : 'text.secondary' }}>
            {up ? 'Up ' : down ? 'Down ' : 'Flat '}
            {change.percent}
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>vs {change.vs}</Typography>
        </Stack>
      )}
    </Box>
  )
}

// One filter chip with a ▾ menu; picking another option re-runs the answer.
function FilterChip({ control, disabled, onChange }) {
  const [anchor, setAnchor] = useState(null)
  const current = control.options.find((o) => o.value === control.value)
  const names = { metric: 'Measure', groupBy: 'Breakdown', period: 'Period' }
  return (
    <>
      <Chip
        size="small"
        label={current?.label ?? control.value}
        deleteIcon={<ArrowDropDownRoundedIcon />}
        onDelete={(e) => setAnchor(e.currentTarget.parentElement)}
        onClick={(e) => setAnchor(e.currentTarget)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-label={`${names[control.key]}: ${current?.label ?? control.value}. Change`}
        sx={{ flexShrink: 0, fontWeight: 600, bgcolor: 'grey.100', color: 'text.primary', '& .MuiChip-deleteIcon': { color: 'text.secondary', mr: 0.25 } }}
      />
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {control.options.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === control.value}
            disabled={option.disabled}
            onClick={() => {
              setAnchor(null)
              if (option.value !== control.value) onChange({ [control.key]: option.value })
            }}
            sx={{ fontSize: 14 }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

function AnswerTable({ table }) {
  const shareIndex = table.shares ? table.columns.length - 1 : -1
  return (
    <TableContainer sx={{ mt: 2, border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 380 }}>
      <Table size="small" stickyHeader aria-label="Answer details">
        <TableHead>
          <TableRow>
            {table.columns.map((column, i) => (
              <TableCell key={column} align={i === 0 ? 'left' : 'right'} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>
                {column}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {table.rows.map((row, r) => (
            <TableRow key={r} hover>
              {row.map((cell, c) => {
                const longText = typeof cell === 'string' && cell.length > 40 && c > 0
                return (
                  <TableCell key={c} align={c === 0 || longText ? 'left' : 'right'} sx={longText ? { minWidth: 240 } : { whiteSpace: 'nowrap' }}>
                    {c === shareIndex ? (
                      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                        <Box sx={{ width: 60, height: 6, borderRadius: 3, bgcolor: 'grey.200', overflow: 'hidden' }}>
                          <Box sx={{ width: `${Math.min(100, table.shares[r] * 100)}%`, height: '100%', bgcolor: 'primary.dark' }} />
                        </Box>
                        <span>{cell}</span>
                      </Stack>
                    ) : (
                      cell
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

// "Based on: N records" opens the records the answer was calculated from.
function RecordsDialog({ context, onClose }) {
  const [state, setState] = useState({ data: null, error: null })
  useEffect(() => {
    let cancelled = false
    getCopilotRecords(context)
      .then((data) => !cancelled && setState({ data, error: null }))
      .catch((error) => !cancelled && setState({ data: null, error }))
    return () => {
      cancelled = true
    }
  }, [context])
  const { data, error } = state

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth aria-labelledby="copilot-records-title">
      <DialogTitle id="copilot-records-title">{data?.title ?? 'Records'}</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {!data && !error && <LinearProgress aria-label="Loading records" />}
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error.message}
          </Alert>
        )}
        {data && (
          <>
            {data.total > data.rows.length && (
              <Typography sx={{ px: 2, pt: 1.5, fontSize: 13, color: 'text.secondary' }}>
                Showing the latest {data.rows.length.toLocaleString('en-US')} of {data.total.toLocaleString('en-US')}.
              </Typography>
            )}
            <TableContainer sx={{ maxHeight: '60vh' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {data.columns.map((column, i) => (
                      <TableCell key={column} align={i < 2 || typeof data.rows[0]?.[i] === 'string' ? 'left' : 'right'} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>
                        {column}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.rows.map((row, r) => (
                    <TableRow key={r} hover>
                      {row.map((cell, c) => (
                        <TableCell key={c} align={typeof cell === 'number' ? 'right' : 'left'} sx={{ whiteSpace: 'nowrap' }}>
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {data.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={data.columns.length} sx={{ color: 'text.secondary' }}>
                        No records in this period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3 }}>
        {data?.rows.length > 0 && (
          <Button startIcon={<DownloadRoundedIcon />} onClick={() => downloadCsv(data.columns, data.rows, 'copilot-records.csv')}>
            Download data
          </Button>
        )}
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * One Copilot reply (SRS 3.2): filter chips (what was asked; change one to
 * re-run), the key number with its change, a short summary that adds to it,
 * a chart or table, the evidence with a link to the records (FR-COP-3),
 * actions (FR-COP-4) and follow-ups (FR-COP-5).
 * onRerun(change): async, re-runs the answer with one filter changed.
 * compact: smaller text and padding, for the narrow Copilot side panel.
 */
export default function CopilotAnswer({ answer, onAsk, onRerun, error = false, animate = false, onShown, compact = false }) {
  const { highlight, chart, table, evidence = [], tags = [], extraTags, controls, records, actions = [], suggestions = [], corrections = [] } = answer
  // With a big number, the card shows the short summary (never the number again).
  const body = highlight && typeof answer.summary === 'string' ? answer.summary : answer.text
  const typed = useTypewriter(body, animate, onShown)
  const [copied, setCopied] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const [rerunError, setRerunError] = useState(null)
  const [showRecords, setShowRecords] = useState(false)
  const { pathname } = useLocation()
  const { can } = usePermissions()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answerAsText(answer))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked by the browser; nothing else to do.
    }
  }

  const download = () => {
    if (table) downloadCsv(table.columns, table.rows, 'copilot-answer.csv')
    else if (chart) {
      const { columns, rows } = chartRows(chart)
      downloadCsv(columns, rows, 'copilot-answer.csv')
    }
  }

  const changeFilter = async (change) => {
    setRerunning(true)
    setRerunError(null)
    try {
      await onRerun(change)
    } catch (e) {
      setRerunError(e.message)
    } finally {
      setRerunning(false)
    }
  }

  // The button under the answer opens the screen for its data. Already on
  // that screen? Then offer the next useful place instead (Dealer 360 ->
  // the sales report on Inventory), or nothing.
  const actionLinks = actions
    .map((action) => {
      const path = MODULE_PATHS[action.module] ?? '/'
      if (path === pathname && !action.action) {
        return action.module === MODULES.DEALER_360 && can(MODULES.INVENTORY)
          ? { label: 'Open sales report', to: `${MODULE_PATHS[MODULES.INVENTORY]}?tab=sales` }
          : null
      }
      return { label: action.label, to: `${path}${action.action ? `?action=${action.action}` : ''}` }
    })
    .filter(Boolean)

  const filterChips = controls && onRerun && !error
  const plainTags = filterChips ? (extraTags ?? []) : tags
  const [recordsItem, ...otherEvidence] = evidence
  const canOpenRecords = records?.count > 0 && answer.context && records.label === recordsItem

  return (
    <Stack direction="row" spacing={compact ? 1 : 1.5} sx={{ alignItems: 'flex-start' }}>
      <Box
        aria-hidden
        sx={{
          width: compact ? 28 : 36,
          height: compact ? 28 : 36,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: error ? 'error.main' : 'primary.main',
          color: 'common.white',
        }}
      >
        {error ? <ErrorOutlineRoundedIcon sx={{ fontSize: compact ? 16 : 20 }} /> : <AutoAwesomeRoundedIcon sx={{ fontSize: compact ? 16 : 20 }} />}
      </Box>

      <Box
        component="section"
        aria-label="Copilot answer"
        aria-busy={rerunning}
        sx={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: error ? 'error.light' : 'divider',
          borderRadius: 1.5,
          px: compact ? 1.75 : { xs: 2, md: 3 },
          py: compact ? 1.5 : { xs: 2, md: 2.5 },
          overflow: 'hidden',
        }}
      >
        {rerunning && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3 }} aria-label="Updating the answer" />}

        {/* What was asked: filter chips (▾ to change) and the other conditions, on one line. */}
        {(filterChips || plainTags.length > 0) && (
          <Stack
            direction="row"
            spacing={0.75}
            aria-label="Understood as"
            sx={{ mb: 1.5, flexWrap: 'nowrap', overflowX: 'auto', pb: 0.25, scrollbarWidth: 'thin' }}
          >
            {filterChips && controls.map((control) => <FilterChip key={control.key} control={control} disabled={rerunning} onChange={changeFilter} />)}
            {plainTags.map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ flexShrink: 0, color: 'text.secondary' }} />
            ))}
          </Stack>
        )}

        <Box sx={{ opacity: rerunning ? 0.5 : 1, transition: 'opacity 120ms' }}>
          {highlight && <Highlight highlight={highlight} compact={compact} />}

          {typed.text && (
            <Typography sx={{ fontSize: compact ? 14.5 : { xs: 16, md: 17 }, lineHeight: 1.6, color: highlight ? 'text.secondary' : 'text.primary' }}>
              {typed.text}
            </Typography>
          )}

          {typed.done && (
            <>
              {chart?.points?.length > 0 && <MonthChart chart={chart} height={compact ? 150 : 180} />}
              {table && !chart && <AnswerTable table={table} />}

              {(evidence.length > 0 || corrections.length > 0) && (
                <Typography sx={{ mt: 2, fontSize: 13, color: 'text.secondary' }}>
                  {evidence.length > 0 && (
                    <>
                      Based on:{' '}
                      {canOpenRecords ? (
                        <Link component="button" type="button" onClick={() => setShowRecords(true)} sx={{ fontSize: 13, verticalAlign: 'baseline', fontWeight: 600 }}>
                          {recordsItem}
                        </Link>
                      ) : (
                        recordsItem
                      )}
                      {otherEvidence.length > 0 && <> · {otherEvidence.join(' · ')}</>}
                    </>
                  )}
                  {corrections.length > 0 && <>{evidence.length ? ' · ' : ''}Read as: {corrections.join(', ')}</>}
                </Typography>
              )}

              {rerunError && (
                <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setRerunError(null)}>
                  {rerunError}
                </Alert>
              )}

              {!error && (
                <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                  {actionLinks.map((action) => (
                    <Button key={action.label} component={RouterLink} to={action.to} variant="contained" size="small" disableElevation sx={{ borderRadius: 5, px: 2 }}>
                      {action.label}
                    </Button>
                  ))}
                  <Box sx={{ flexGrow: 1 }} />
                  <Tooltip title={copied ? 'Copied' : 'Copy answer'}>
                    <IconButton size="small" onClick={copy} aria-label="Copy answer">
                      {copied ? <CheckRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  {(table || chart?.points?.length > 0) && (
                    <Tooltip title="Download data">
                      <IconButton size="small" onClick={download} aria-label="Download data">
                        <DownloadRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              )}

              {suggestions.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
                  {suggestions.slice(0, 3).map((suggestion) => (
                    <Chip
                      key={suggestion}
                      label={suggestion}
                      onClick={() => onAsk(suggestion)}
                      variant="outlined"
                      color="primary"
                      size="small"
                      sx={{ fontWeight: 600, color: 'primary.dark', borderColor: 'primary.dark' }}
                    />
                  ))}
                </Stack>
              )}
            </>
          )}
        </Box>
      </Box>

      {showRecords && <RecordsDialog context={answer.context} onClose={() => setShowRecords(false)} />}
    </Stack>
  )
}
