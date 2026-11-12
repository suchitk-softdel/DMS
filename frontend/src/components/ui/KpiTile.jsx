import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

// `delta` is a percentage change, e.g. 4.2 or -1.5.
export default function KpiTile({ label, value, delta, caption, icon }) {
  const hasDelta = typeof delta === 'number'
  const isPositive = hasDelta && delta >= 0
  const DeltaIcon = isPositive ? TrendingUpIcon : TrendingDownIcon

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          {icon && <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>}
        </Stack>
        <Typography variant="h4" component="p" sx={{ mt: 1 }}>
          {value}
        </Typography>
        {(hasDelta || caption) && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 1, alignItems: 'center' }}>
            {hasDelta && (
              <Stack
                direction="row"
                spacing={0.25}
                sx={{ alignItems: 'center', color: isPositive ? 'success.main' : 'error.main' }}
              >
                <DeltaIcon fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {isPositive ? '+' : ''}
                  {delta}%
                </Typography>
              </Stack>
            )}
            {caption && (
              <Typography variant="body2" color="text.secondary">
                {caption}
              </Typography>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}
