import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

// `value` is a percentage (0-100); values outside the range are clamped.
export default function ProgressBar({ value, label, color = 'primary', showValue = true }) {
  const clamped = Math.min(100, Math.max(0, Number(value) || 0))

  return (
    <Box>
      {(label || showValue) && (
        <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          {showValue && (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {Math.round(clamped)}%
            </Typography>
          )}
        </Stack>
      )}
      <LinearProgress
        variant="determinate"
        value={clamped}
        color={color}
        aria-label={label}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  )
}
