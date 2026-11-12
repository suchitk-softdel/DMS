import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

export default function PageLoader({ fullScreen = false }) {
  return (
    <Box
      role="status"
      aria-label="Loading"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: fullScreen ? '100vh' : 240,
      }}
    >
      <CircularProgress />
    </Box>
  )
}
