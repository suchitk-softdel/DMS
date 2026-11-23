import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { keyframes } from '@mui/material/styles'
import { DASH } from '@/constants/dashboardColors'
import { useLiveStatus } from '@/lib/live'

const pulse = keyframes`0% { box-shadow: 0 0 0 0 rgba(18, 165, 148, 0.5) } 70% { box-shadow: 0 0 0 7px rgba(18, 165, 148, 0) } 100% { box-shadow: 0 0 0 0 rgba(18, 165, 148, 0) }`

const LABELS = {
  live: { text: 'Live', tip: 'This screen updates by itself when warranty data changes.', color: DASH.teal },
  connecting: { text: 'Connecting…', tip: 'Reconnecting to live updates.', color: DASH.amber },
  off: { text: 'Offline', tip: 'Live updates are off; refresh the page to see changes.', color: '#9aa0b0' },
}

// Small "● Live" indicator for screens that update themselves (live.js).
export default function LiveBadge() {
  const status = useLiveStatus()
  const { text, tip, color } = LABELS[status]
  return (
    <Tooltip title={tip} arrow>
      <Box
        role="status"
        aria-label={`Live updates: ${text}`}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, borderRadius: 999, bgcolor: '#fff', border: `1px solid ${DASH.border}` }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: color,
            ...(status === 'live' && { animation: `${pulse} 2s infinite`, '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }),
          }}
        />
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: DASH.navy }}>{text}</Typography>
      </Box>
    </Tooltip>
  )
}
