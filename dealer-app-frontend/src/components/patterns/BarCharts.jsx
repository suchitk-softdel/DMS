import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha, keyframes } from '@mui/material/styles'

// Simple bar charts drawn with HTML (no chart library), in the app's colours.
// One series each, so one hue (primary); text stays in the text colours.
// Hover (or focus with Tab) any bar to read its exact values.

const BAR_RADIUS = '0 4px 4px 0' // rounded data end, flat at the baseline

// Bars grow from the baseline when they appear (skipped with reduced motion).
const growX = keyframes`from { transform: scaleX(0) } to { transform: scaleX(1) }`
const growY = keyframes`from { transform: scaleY(0) } to { transform: scaleY(1) }`
const grow = (animation, origin, delay = 0) => ({
  transformOrigin: origin,
  animation: `${animation} 600ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms both`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})

// Tooltip body: a title and a few "Label: value" lines.
function TipContent({ title, lines = [] }) {
  return (
    <Box sx={{ py: 0.25 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{title}</Typography>
      {lines.map((line) => (
        <Typography key={line} sx={{ fontSize: 13 }}>
          {line}
        </Typography>
      ))}
    </Box>
  )
}

/**
 * Horizontal bars, one row per item, sorted by the caller.
 * rows: [{ key, label, sublabel?, value, color?, marker?, flag?: ReactNode, tip: { title, lines } }]
 *   color:  bar colour (theme path or hex), default primary; e.g. red when low.
 *   marker: a value drawn as a thin tick on the bar (e.g. the reorder point).
 *   flag:   small status element shown after the value (icon + text, never colour alone).
 * markerLabel: legend text for the tick.
 * onRowClick(key): optional; makes each row a button (click or Enter).
 * selectedKey: the row to highlight (e.g. the product open in the details).
 */
export function HBarChart({ rows, formatValue = String, markerLabel, valueLabel, maxHeight = 560, ariaLabel, onRowClick, selectedKey }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.value, r.marker ?? 0)))
  return (
    <Box>
      <Stack direction="row" spacing={2.5} sx={{ mb: 1.5, alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
        {valueLabel && (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 14, height: 10, borderRadius: '0 3px 3px 0', bgcolor: 'primary.main' }} />
            <Typography variant="caption" color="text.secondary">
              {valueLabel}
            </Typography>
          </Stack>
        )}
        {markerLabel && (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 2, height: 14, bgcolor: 'text.primary' }} />
            <Typography variant="caption" color="text.secondary">
              {markerLabel}
            </Typography>
          </Stack>
        )}
      </Stack>
      <Box role="list" aria-label={ariaLabel} sx={{ maxHeight, overflowY: 'auto', pr: 0.5 }}>
        {rows.map((row, index) => (
          <Tooltip key={row.key} title={<TipContent {...row.tip} />} placement="top-start" arrow disableInteractive>
            <Box
              role={onRowClick ? 'button' : 'listitem'}
              tabIndex={0}
              aria-label={`${row.tip.title}: ${row.tip.lines.join(', ')}`}
              aria-current={row.key === selectedKey ? 'true' : undefined}
              onClick={onRowClick ? () => onRowClick(row.key) : undefined}
              onKeyDown={
                onRowClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onRowClick(row.key)) : undefined
              }
              sx={{
                cursor: onRowClick ? 'pointer' : 'default',
                display: 'grid',
                gridTemplateColumns: { xs: '96px 1fr 88px', sm: '200px 1fr 112px' },
                alignItems: 'center',
                columnGap: 1.5,
                py: 0.6,
                px: 0.5,
                borderRadius: 1,
                outline: 'none',
                bgcolor: row.key === selectedKey ? (t) => alpha(t.palette.primary.main, 0.12) : 'transparent',
                transition: 'background-color 120ms',
                '&:hover, &:focus-visible': { bgcolor: row.key === selectedKey ? undefined : 'action.hover' },
                '&:hover .hbar, &:focus-visible .hbar': { filter: 'brightness(0.9)' },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 600 }}>
                  {row.label}
                </Typography>
                {row.sublabel && (
                  <Typography noWrap variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1.2 }}>
                    {row.sublabel}
                  </Typography>
                )}
              </Box>
              <Box sx={{ position: 'relative', height: 14 }}>
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'action.hover', borderRadius: BAR_RADIUS }} />
                <Box
                  className="hbar"
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${(row.value / max) * 100}%`,
                    minWidth: row.value > 0 ? 3 : 0,
                    bgcolor: row.color ?? 'primary.main',
                    borderRadius: BAR_RADIUS,
                    transition: 'filter 120ms',
                    ...grow(growX, 'left center', Math.min(index, 12) * 25),
                  }}
                />
                {row.marker !== undefined && row.marker !== null && (
                  <Box
                    aria-hidden
                    sx={{ position: 'absolute', top: -3, bottom: -3, width: 2, left: `calc(${(row.marker / max) * 100}% - 1px)`, bgcolor: 'text.primary' }}
                  />
                )}
              </Box>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatValue(row.value)}</Typography>
                {row.flag}
              </Stack>
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Box>
  )
}

/**
 * Vertical columns for a few periods (e.g. the last 3 months), each labelled
 * with its value on top. bars: [{ key, label, value, display, tip: { title, lines } }]
 */
export function ColumnChart({ bars, height = 200, ariaLabel }) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  return (
    <Box role="list" aria-label={ariaLabel} sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, height, pt: 3, borderBottom: 1, borderColor: 'divider' }}>
      {bars.map((bar, index) => (
        <Tooltip key={bar.key} title={<TipContent {...bar.tip} />} placement="top" arrow disableInteractive>
          <Box
            role="listitem"
            tabIndex={0}
            aria-label={`${bar.tip.title}: ${bar.tip.lines.join(', ')}`}
            sx={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', outline: 'none', cursor: 'default', '&:hover .bar, &:focus-visible .bar': { bgcolor: 'primary.dark' } }}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5, fontVariantNumeric: 'tabular-nums' }}>{bar.display}</Typography>
            <Box className="bar" sx={{ width: '100%', maxWidth: 72, height: `${(bar.value / max) * 100}%`, minHeight: bar.value > 0 ? 3 : 0, bgcolor: 'primary.main', borderRadius: '4px 4px 0 0', transition: 'background-color 120ms, height 400ms ease', ...grow(growY, 'center bottom', index * 80) }} />
          </Box>
        </Tooltip>
      ))}
    </Box>
  )
}

// Month labels under a ColumnChart, aligned with its columns.
export function ColumnLabels({ labels }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, mt: 0.75 }}>
      {labels.map((label) => (
        <Typography key={label} variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: 'center' }}>
          {label}
        </Typography>
      ))}
    </Box>
  )
}

/**
 * Tiny inline columns (a product's last few months), no axes.
 * values: [number]; labels: [string] for the tooltip.
 */
export function MiniBars({ values, labels, width = 64, height = 28 }) {
  const max = Math.max(1, ...values)
  return (
    <Tooltip title={<TipContent title="Units sold" lines={values.map((v, i) => `${labels[i]}: ${v}`)} />} arrow disableInteractive>
      <Box tabIndex={0} aria-label={`Units sold: ${values.map((v, i) => `${labels[i]} ${v}`).join(', ')}`} sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', width, height, flexShrink: 0, outline: 'none' }}>
        {values.map((value, i) => (
          // Heights in px (a zero month is a 2px grey baseline, not an empty gap).
          <Box
            key={labels[i]}
            style={{ height: value > 0 ? Math.max(3, Math.round((value / max) * height)) : 2 }}
            sx={{ flex: 1, bgcolor: value > 0 ? 'primary.main' : 'divider', borderRadius: '2px 2px 0 0' }}
          />
        ))}
      </Box>
    </Tooltip>
  )
}
