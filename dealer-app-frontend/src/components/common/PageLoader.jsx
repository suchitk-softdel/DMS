import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import ContentSkeleton from '@/components/common/ContentSkeleton'

// Full screen (app start, sign-in): a spinner. Inside the app shell (a page
// is loading): placeholder shapes in the page layout.
export default function PageLoader({ fullScreen = false }) {
  if (!fullScreen) return <ContentSkeleton variant="dashboard" />
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
