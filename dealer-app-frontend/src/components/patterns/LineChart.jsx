import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useEffect, useId, useRef, useState } from 'react'

/**
 * Line chart drawn as SVG (no chart library), sized to its container.
 *
 * points: [{ key, label, tooltipLabel?, value, compare?, partial? }]
 *   value / compare: number, or null for "no data" (the line breaks there).
 *   partial: the period is not over yet; drawn hollow with a dashed segment.
 * seriesLabel / compareLabel: legend names. Without compare values the
 *   second line and its legend entry are left out.
 * formatValue: axis and tooltip formatting, e.g. compact currency.
 *
 * Hover, or focus the chart and use the arrow keys, to read exact values.
 */
export default function LineChart({ points, height = 280, seriesLabel, compareLabel, formatValue = String, ariaLabel }) {
  const theme = useTheme()
  const containerRef = useRef(null)
  const width = useElementWidth(containerRef)
  const [active, setActive] = useState(null)

  const pad = { top: 16, right: 16, bottom: 32, left: 64 }
  const plotWidth = Math.max(0, width - pad.left - pad.right)
  const plotHeight = height - pad.top - pad.bottom
  const hasCompare = points.some((p) => p.compare !== null && p.compare !== undefined)

  const values = points.flatMap((p) => [p.value, hasCompare ? p.compare : null]).filter((v) => v !== null && v !== undefined)
  const max = niceMax(Math.max(0, ...values))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0
  const x = (i) => pad.left + (points.length > 1 ? i * step : plotWidth / 2)
  const y = (v) => pad.top + plotHeight - (max ? (v / max) * plotHeight : 0)
  // Show every n-th month label so labels never overlap (about 56px each).
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotWidth / 56))))

  const colors = {
    line: theme.palette.primary.main,
    compare: theme.palette.grey[400],
    grid: theme.palette.divider,
    text: theme.palette.text.secondary,
    paper: theme.palette.background.paper,
  }

  const onKeyDown = (event) => {
    if (!points.length) return
    if (event.key === 'ArrowRight') setActive((i) => Math.min(points.length - 1, (i ?? -1) + 1))
    else if (event.key === 'ArrowLeft') setActive((i) => Math.max(0, (i ?? points.length) - 1))
    else if (event.key === 'Escape') setActive(null)
    else return
    event.preventDefault()
  }

  const current = active === null ? null : points[active]
  const tooltipLeft = active === null ? 0 : Math.min(Math.max(x(active), 90), Math.max(90, width - 90))

  return (
    <Box>
      <Box ref={containerRef} sx={{ position: 'relative', width: '100%', height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={ariaLabel}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
            onMouseLeave={() => setActive(null)}
            style={{ display: 'block', outline: 'none' }}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke={colors.grid} />
                <text x={pad.left - 10} y={y(tick)} dy="0.35em" textAnchor="end" fontSize="12" fill={colors.text}>
                  {formatValue(tick)}
                </text>
              </g>
            ))}

            {points.map((p, i) =>
              i % labelEvery === 0 || i === points.length - 1 ? (
                <text key={p.key} x={x(i)} y={height - 8} textAnchor="middle" fontSize="12" fill={colors.text}>
                  {p.label}
                </text>
              ) : null,
            )}

            {current && <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + plotHeight} stroke={colors.grid} strokeWidth="2" />}

            <Area points={points} x={x} y={y} baseY={y(0)} color={colors.line} />
            {hasCompare && <Series points={points} field="compare" x={x} y={y} color={colors.compare} width={2} dashed />}
            <Series points={points} field="value" x={x} y={y} color={colors.line} paper={colors.paper} width={3} dots active={active} />

            {/* Hover areas, one per point */}
            {points.map((p, i) => (
              <rect
                key={p.key}
                x={x(i) - step / 2}
                y={pad.top}
                width={Math.max(step, 1)}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
              />
            ))}
          </svg>
        )}

        {current && (
          <Box
            role="status"
            sx={{
              position: 'absolute',
              top: 0,
              left: tooltipLeft,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              bgcolor: 'brand.navy',
              color: 'common.white',
              borderRadius: 1,
              px: 1.5,
              py: 1,
              boxShadow: 3,
              minWidth: 160,
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
              {current.tooltipLabel ?? current.label}
              {current.partial ? ' (to date)' : ''}
            </Typography>
            <Typography sx={{ fontSize: 13 }}>
              {seriesLabel}: {current.value === null ? 'no data' : formatValue(current.value, { exact: true })}
            </Typography>
            {hasCompare && (
              <Typography sx={{ fontSize: 13, opacity: 0.8 }}>
                {compareLabel}: {current.compare === null ? 'no data' : formatValue(current.compare, { exact: true })}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      <Stack direction="row" spacing={3} sx={{ mt: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
        <LegendItem color={colors.line} label={seriesLabel} />
        {hasCompare && <LegendItem color={colors.compare} label={compareLabel} dashed />}
        {points.some((p) => p.partial) && <LegendItem color={colors.line} paper={colors.paper} label="Month to date" hollow />}
      </Stack>
    </Box>
  )
}

// Soft fill under the main line (each unbroken run of values), fading down.
function Area({ points, x, y, baseY, color }) {
  const id = useId()
  const runs = []
  let run = []
  points.forEach((p, i) => {
    if (p.value === null || p.value === undefined) {
      if (run.length) runs.push(run)
      run = []
    } else run.push(i)
  })
  if (run.length) runs.push(run)
  return (
    <g aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {runs
        .filter((r) => r.length > 1)
        .map((r) => (
          <path
            key={r[0]}
            d={`${r.map((i, k) => `${k ? 'L' : 'M'}${x(i)},${y(points[i].value)}`).join(' ')} L${x(r.at(-1))},${baseY} L${x(r[0])},${baseY} Z`}
            fill={`url(#${id})`}
          />
        ))}
    </g>
  )
}

// One line, broken where values are null. The segment into a partial period
// is dashed, and its point is hollow.
function Series({ points, field, x, y, color, paper, width, dashed = false, dots = false, active = null }) {
  const segments = []
  for (let i = 1; i < points.length; i += 1) {
    const [a, b] = [points[i - 1][field], points[i][field]]
    if (a === null || a === undefined || b === null || b === undefined) continue
    segments.push(
      <line
        key={i}
        x1={x(i - 1)}
        y1={y(a)}
        x2={x(i)}
        y2={y(b)}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed || points[i].partial ? '6 6' : undefined}
      />,
    )
  }
  return (
    <g>
      {segments}
      {dots &&
        points.map((p, i) =>
          p[field] === null || p[field] === undefined ? null : (
            <circle
              key={p.key}
              cx={x(i)}
              cy={y(p[field])}
              r={i === active ? 6 : 4}
              fill={p.partial ? paper : color}
              stroke={color}
              strokeWidth={2}
            />
          ),
        )}
    </g>
  )
}

function LegendItem({ color, paper, label, dashed = false, hollow = false }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <svg width="28" height="12" aria-hidden>
        {hollow ? (
          <circle cx="14" cy="6" r="4" fill={paper} stroke={color} strokeWidth="2" />
        ) : (
          <line x1="2" x2="26" y1="6" y2="6" stroke={color} strokeWidth="3" strokeDasharray={dashed ? '5 4' : undefined} />
        )}
      </svg>
      <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{label}</Typography>
    </Stack>
  )
}

// Rounds the axis maximum up to 1, 2, 2.5 or 5 x 10^n so tick labels are round.
function niceMax(value) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value)
  return step * magnitude
}

function useElementWidth(ref) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const update = () => setWidth(element.clientWidth)
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}
