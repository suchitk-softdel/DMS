import StarRoundedIcon from '@mui/icons-material/StarRounded'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

// Copilot month chart: each month's bar (this period) next to the same month
// a year earlier (lighter), light gridlines with short values ($250K, $1M),
// the month still running striped ("to date") and the best month starred.
// chart: { points: [{ key, label, year, value, display, previous, previousDisplay,
//          changePct, partial }], best, currentLabel, previousLabel, format }

// Colours with at least 3:1 contrast on white (WCAG AA for graphics).
const CHART_COLORS = { current: '#047F8C', previous: '#858DA3', grid: '#E3E6ED' }
const STRIPES = `repeating-linear-gradient(135deg, ${CHART_COLORS.current} 0 4px, #7FC4CB 4px 8px)`

// $1.2M, $250K, $950; plain numbers as 1.2K.
function shortValue(value, format) {
  const sign = format === 'money' ? '$' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${sign}${+(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 2)}M`
  if (abs >= 1_000) return `${sign}${+(value / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}K`
  return `${sign}${Math.round(value)}`
}

// A round top for the axis and 4 gridlines: 1, 2, 2.5 or 5 x 10^n per step.
function axisTicks(max) {
  if (max <= 0) return [0, 1]
  const rough = max / 4
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough)
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step)
}

const tipFor = (p, chart) => {
  const vs = p.previous !== null && p.changePct !== null ? ` (${p.changePct > 0 ? '+' : ''}${p.changePct}% vs ${p.year - 1})` : ''
  return `${p.label} ${p.year}: ${p.display}${vs}${p.partial ? ' · to date' : ''}${p.key === chart.best ? ' · best month' : ''}`
}

function Swatch({ background, label }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 12, height: 12, borderRadius: '3px', background }} />
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{label}</Typography>
    </Stack>
  )
}

export default function MonthChart({ chart, height = 170 }) {
  const { points, format } = chart
  const showPrevious = Boolean(chart.previousLabel)
  const ticks = axisTicks(Math.max(...points.map((p) => Math.max(p.value, p.previous ?? 0)), 0))
  const top = ticks.at(-1)
  const best = points.find((p) => p.key === chart.best)
  const partial = points.find((p) => p.partial)
  const multiYear = new Set(points.map((p) => p.year)).size > 1

  return (
    <Box sx={{ mt: 2 }}>
      {/* Legend */}
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', rowGap: 0.5, mb: 1.25 }}>
        <Swatch background={CHART_COLORS.current} label={chart.currentLabel} />
        {showPrevious && <Swatch background={CHART_COLORS.previous} label={chart.previousLabel} />}
        {partial && <Swatch background={STRIPES} label={`${partial.label} to date`} />}
        {best && (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <StarRoundedIcon sx={{ fontSize: 15, color: '#B7791F' }} aria-hidden />
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
              Best: {best.label} {best.year} ({shortValue(best.value, format)})
            </Typography>
          </Stack>
        )}
      </Stack>

      <Box sx={{ display: 'flex' }}>
        {/* Y axis labels */}
        <Box sx={{ position: 'relative', width: 44, flexShrink: 0, height }} aria-hidden>
          {ticks.map((tick) => (
            <Typography
              key={tick}
              sx={{ position: 'absolute', right: 6, bottom: `${(tick / top) * 100}%`, transform: 'translateY(50%)', fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}
            >
              {shortValue(tick, format)}
            </Typography>
          ))}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Plot: gridlines, then one group of bars per month */}
          <Box sx={{ position: 'relative', height }}>
            {ticks.map((tick) => (
              <Box
                key={tick}
                aria-hidden
                sx={{ position: 'absolute', left: 0, right: 0, bottom: `${(tick / top) * 100}%`, borderTop: 1, borderColor: tick === 0 ? 'divider' : CHART_COLORS.grid }}
              />
            ))}
            <Stack direction="row" role="list" aria-label="Monthly values" sx={{ position: 'absolute', inset: 0, gap: 0.5 }}>
              {points.map((p) => (
                <Tooltip key={p.key} title={tipFor(p, chart)} arrow placement="top">
                  <Box
                    role="listitem"
                    tabIndex={0}
                    aria-label={tipFor(p, chart)}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      height: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      gap: '2px',
                      position: 'relative',
                      borderRadius: 0.5,
                      outline: 'none',
                      '&:hover, &:focus-visible': { bgcolor: 'action.hover' },
                      '&:focus-visible': { boxShadow: (t) => `0 0 0 2px ${t.palette.primary.main}` },
                    }}
                  >
                    {showPrevious && (
                      <Box sx={{ flex: 1, maxWidth: 14, height: `${((p.previous ?? 0) / top) * 100}%`, bgcolor: CHART_COLORS.previous, borderRadius: '3px 3px 0 0' }} />
                    )}
                    <Box
                      sx={{
                        flex: 1,
                        maxWidth: 14,
                        height: `${(p.value / top) * 100}%`,
                        minHeight: p.value > 0 ? 2 : 0,
                        background: p.partial ? STRIPES : CHART_COLORS.current,
                        borderRadius: '3px 3px 0 0',
                      }}
                    />
                    {p.key === chart.best && (
                      <StarRoundedIcon
                        aria-hidden
                        sx={{ position: 'absolute', bottom: `calc(${(Math.max(p.value, p.previous ?? 0) / top) * 100}% + 2px)`, fontSize: 15, color: '#B7791F' }}
                      />
                    )}
                  </Box>
                </Tooltip>
              ))}
            </Stack>
          </Box>

          {/* X axis: short month names (the year under January when the chart spans years) */}
          <Stack direction="row" sx={{ gap: 0.5, mt: 0.5 }} aria-hidden>
            {points.map((p, i) => (
              <Box key={p.key} sx={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3 }}>{p.label}</Typography>
                {multiYear && (i === 0 || p.label === 'Jan') && (
                  <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.2 }}>{p.year}</Typography>
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
