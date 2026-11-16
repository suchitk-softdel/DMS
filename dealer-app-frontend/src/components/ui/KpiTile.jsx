import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'

const TONE_COLORS = {
  positive: 'brand.tealDark',
  negative: 'error.main',
  warning: 'warning.dark',
  neutral: 'text.secondary',
}

const ARROWS = { up: '▲', down: '▼' }

/**
 * KPI card from the UI design: thick colored left edge, uppercase label, big
 * value and an optional trend line.
 *
 * accent: theme color for the left edge, e.g. 'primary.main', 'warning.main'.
 * trend:  { text, direction?: 'up' | 'down', tone?: 'positive' | 'negative' | 'warning' | 'neutral' }
 *         Direction and tone are separate because "down" can be good
 *         (e.g. fewer stock-outs).
 */
export default function KpiTile({ label, value, accent = 'primary.main', trend }) {
  return (
    <Card sx={{ height: '100%', borderLeft: 8, borderLeftColor: accent }}>
      <Box sx={{ px: 3, pt: 3, pb: 2.75 }}>
        <Typography
          component="p"
          sx={{ fontSize: 14, color: 'text.secondary', fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase' }}
        >
          {label}
        </Typography>
        <Typography
          component="p"
          variant="h1"
          sx={{ mt: 1.5, fontSize: { xs: 34, lg: 42 }, color: 'text.primary', lineHeight: 1.1 }}
        >
          {value}
        </Typography>
        <Typography sx={{ mt: 1.75, minHeight: 24, fontSize: 16, fontWeight: 700, color: TONE_COLORS[trend?.tone ?? 'neutral'] }}>
          {trend?.direction && (
            <Box component="span" aria-hidden sx={{ mr: 0.75, fontSize: 14 }}>
              {ARROWS[trend.direction]}
            </Box>
          )}
          {trend?.text}
        </Typography>
      </Box>
    </Card>
  )
}
