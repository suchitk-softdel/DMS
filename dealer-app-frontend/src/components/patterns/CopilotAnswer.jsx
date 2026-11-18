import { useEffect, useState } from 'react'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import { MODULE_PATHS } from '@/constants/modules'

const WORD_DELAY_MS = 28

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

function toCsv(table) {
  const cell = (value) => `"${String(value).replaceAll('"', '""')}"`
  return [table.columns, ...table.rows].map((row) => row.map(cell).join(',')).join('\r\n')
}

function answerAsText(answer) {
  const lines = [answer.text]
  if (answer.table) {
    lines.push('', answer.table.columns.join('\t'), ...answer.table.rows.map((row) => row.join('\t')))
  }
  if (answer.evidence?.length) lines.push('', `Based on: ${answer.evidence.join(' · ')}`)
  return lines.join('\n')
}

function Highlight({ highlight }) {
  const { value, caption, change } = highlight
  const color = change?.direction === 'up' ? 'success.main' : change?.direction === 'down' ? 'error.main' : 'text.secondary'
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: { xs: 30, md: 36 }, fontWeight: 700, lineHeight: 1.15, color: 'text.primary' }}>{value}</Typography>
      <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{caption}</Typography>
      {change && (
        <Typography sx={{ mt: 0.5, fontSize: 15, fontWeight: 600, color }}>
          {change.direction === 'up' ? '▲' : change.direction === 'down' ? '▼' : '●'} {change.percent}{' '}
          <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>
            vs {change.vs}
          </Box>
        </Typography>
      )}
    </Box>
  )
}

// Simple bar chart (no chart library). The highest bar is darker.
function BarChart({ points }) {
  const max = Math.max(...points.map((p) => p.value), 1)
  const best = points.reduce((a, b) => (b.value > a.value ? b : a), points[0])
  return (
    <Box sx={{ mt: 2.5 }} role="img" aria-label={`Bar chart: ${points.map((p) => `${p.label} ${p.display}`).join(', ')}`}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-end', height: 170, pb: 0.5, borderBottom: 1, borderColor: 'divider' }}>
        {points.map((point) => (
          <Tooltip key={point.label} title={`${point.label}: ${point.display}`} arrow>
            <Box
              sx={{
                flex: 1,
                minWidth: 8,
                height: `${Math.max(2, (point.value / max) * 100)}%`,
                bgcolor: point === best ? 'primary.dark' : 'primary.main',
                opacity: point === best ? 1 : 0.55,
                borderRadius: '4px 4px 0 0',
                transition: 'opacity 0.15s',
                '&:hover': { opacity: 1 },
              }}
            />
          </Tooltip>
        ))}
      </Stack>
      <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }}>
        {points.map((point, index) => (
          <Typography
            key={point.label}
            sx={{ flex: 1, minWidth: 8, fontSize: 11, color: 'text.secondary', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden' }}
          >
            {/* "Jan" plus the year on the first bar and every January */}
            {index === 0 || point.label.startsWith('Jan') ? point.label.replace(' ', " '").replace(/'20(\d\d)$/, "'$1") : point.label.slice(0, 3)}
          </Typography>
        ))}
      </Stack>
    </Box>
  )
}

function AnswerTable({ table }) {
  const shareIndex = table.shares ? table.columns.length - 1 : -1
  return (
    <TableContainer sx={{ mt: 2.5, border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 380 }}>
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
                        <Box sx={{ width: 80, height: 6, borderRadius: 3, bgcolor: 'grey.200', overflow: 'hidden' }}>
                          <Box sx={{ width: `${Math.min(100, table.shares[r] * 100)}%`, height: '100%', bgcolor: 'primary.main' }} />
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

/**
 * One Copilot reply (SRS 3.2): how the question was understood (tags), the
 * key number, the answer text (typed word by word when new), a chart or
 * table, the evidence (FR-COP-3), actions (FR-COP-4) and follow-ups (FR-COP-5).
 */
export default function CopilotAnswer({ answer, onAsk, error = false, animate = false, onShown }) {
  const { highlight, chart, table, evidence = [], tags = [], actions = [], suggestions = [], corrections = [] } = answer
  const typed = useTypewriter(answer.text, animate, onShown)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answerAsText(answer))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked by the browser; nothing else to do.
    }
  }

  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(table)], { type: 'text/csv;charset=utf-8' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: 'copilot-answer.csv' })
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
      <Box
        aria-hidden
        sx={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: error ? 'error.main' : 'primary.main',
          color: 'common.white',
        }}
      >
        {error ? <ErrorOutlineRoundedIcon fontSize="small" /> : <AutoAwesomeRoundedIcon fontSize="small" />}
      </Box>

      <Box
        component="section"
        aria-label="Copilot answer"
        sx={{
          flex: 1,
          minWidth: 0,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderLeft: 4,
          borderLeftColor: error ? 'error.main' : 'primary.main',
          borderRadius: 1.5,
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 2.5 },
        }}
      >
        {tags.length > 0 && (
          <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 0.75 }} aria-label="Understood as">
            {tags.map((tag) => (
              <Chip key={tag} label={tag} size="small" sx={{ bgcolor: 'grey.100', color: 'text.secondary', fontWeight: 600 }} />
            ))}
          </Stack>
        )}

        {highlight && typed.done && <Highlight highlight={highlight} />}

        <Typography sx={{ fontSize: { xs: 16, md: 17 }, lineHeight: 1.6, color: 'text.primary' }}>{typed.text}</Typography>

        {typed.done && (
          <>
            {chart?.points?.length > 1 && <BarChart points={chart.points} />}
            {table && !chart && <AnswerTable table={table} />}

            {(evidence.length > 0 || corrections.length > 0) && (
              <Typography sx={{ mt: 2, fontSize: 13, color: 'text.secondary' }}>
                {evidence.length > 0 && <>Based on: {evidence.join(' · ')}</>}
                {corrections.length > 0 && <>{evidence.length ? ' · ' : ''}Read as: {corrections.join(', ')}</>}
              </Typography>
            )}

            {!error && (
              <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                {actions.map((action) => (
                  <Button
                    key={action.label}
                    component={RouterLink}
                    to={MODULE_PATHS[action.module] ?? '/'}
                    variant="contained"
                    size="small"
                    disableElevation
                    sx={{ borderRadius: 5, px: 2.25 }}
                  >
                    {action.label}
                  </Button>
                ))}
                <Box sx={{ flexGrow: 1 }} />
                <Tooltip title={copied ? 'Copied' : 'Copy answer'}>
                  <IconButton size="small" onClick={copy} aria-label="Copy answer">
                    {copied ? <CheckRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                {table && (
                  <Tooltip title="Download as CSV">
                    <IconButton size="small" onClick={downloadCsv} aria-label="Download as CSV">
                      <DownloadRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            )}

            {suggestions.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
                {suggestions.map((suggestion) => (
                  <Chip
                    key={suggestion}
                    label={suggestion}
                    onClick={() => onAsk(suggestion)}
                    variant="outlined"
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 500 }}
                  />
                ))}
              </Stack>
            )}
          </>
        )}
      </Box>
    </Stack>
  )
}
