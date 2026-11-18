import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import { useId } from 'react'

const TONE_COLORS = {
  positive: 'brand.tealDark',
  negative: 'error.main',
  warning: 'warning.dark',
  neutral: 'text.secondary',
}

const ARROWS = { up: '▲', down: '▼' }

// 'primary.main' / 'brand.tealDark' -> the colour value from the theme.
function themeColor(theme, path) {
  return path.split('.').reduce((value, key) => value?.[key], theme.palette) ?? path
}

// Small line of recent values (e.g. monthly revenue), no axes.
function Sparkline({ values, color }) {
  const id = useId()
  const points = values.filter((v) => v !== null && v !== undefined)
  if (points.length < 2) return null
  const [w, h, pad] = [84, 32, 3]
  const max = Math.max(...points)
  const min = Math.min(...points)
  const x = (i) => (i / (points.length - 1)) * w
  const y = (v) => pad + (h - pad * 2) * (max === min ? 0.5 : 1 - (v - min) / (max - min))
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
      // Shrinks (down to nothing) before the value is ever cut off.
      sx={{ width: '100%', maxWidth: w, minWidth: 0, flexShrink: 1, height: h, display: 'block', overflow: 'visible', mb: 0.5 }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(points.at(-1))} r="2.8" fill={color} />
    </Box>
  )
}

/**
 * KPI card from the UI design: accent edge, uppercase label, big value, an
 * optional icon and trend line, and an optional small chart of recent values.
 *
 * accent: theme colour, e.g. 'primary.main', 'warning.main'.
 * icon:   MUI icon component shown in a tinted circle.
 * trend:  { text, direction?: 'up' | 'down', tone?: 'positive' | 'negative' | 'warning' | 'neutral' }
 *         Direction and tone are separate because "down" can be good
 *         (e.g. fewer stock-outs).
 * sparkline: recent values, oldest first (e.g. monthly revenue).
 */
export default function KpiTile({ label, value, accent = 'primary.main', icon: Icon, trend, sparkline }) {
  const theme = useTheme()
  const color = themeColor(theme, accent)

  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden', borderLeft: 4, borderLeftColor: accent }}>
      <Box sx={{ px: 3, pt: 2.75, pb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Typography
            component="p"
            sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', pt: 0.5 }}
          >
            {label}
          </Typography>
          {Icon && (
            <Box
              aria-hidden
              sx={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: alpha(color, 0.12), color }}
            >
              <Icon sx={{ fontSize: 21 }} />
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.5, mt: 0.75, minWidth: 0 }}>
          <Typography component="p" variant="h1" sx={{ fontSize: { xs: 32, lg: 36 }, color: 'text.primary', lineHeight: 1.1, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {value}
          </Typography>
          {sparkline && <Sparkline values={sparkline} color={color} />}
        </Box>
        <Typography sx={{ mt: 1.5, minHeight: 22, fontSize: 14.5, fontWeight: 700, color: TONE_COLORS[trend?.tone ?? 'neutral'] }}>
          {trend?.direction && (
            <Box component="span" aria-hidden sx={{ mr: 0.75, fontSize: 12 }}>
              {ARROWS[trend.direction]}
            </Box>
          )}
          {trend?.text}
        </Typography>
      </Box>
    </Card>
  )
}
