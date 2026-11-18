import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'

// Grey placeholder shapes shown while content loads, in the layout the
// content will have, so pages feel faster than with a spinner.
//
// variant: 'dashboard' (KPI tiles + two cards, for full pages)
//          'block'     (a heading and a few lines, for panels and cards)
export default function ContentSkeleton({ variant = 'block' }) {
  if (variant === 'dashboard') {
    return (
      <Stack spacing={3.5} role="status" aria-label="Loading">
        <Grid container spacing={3.5}>
          {[0, 1, 2, 3].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card sx={{ p: 3 }}>
                <Skeleton width="55%" height={18} />
                <Skeleton width="70%" height={46} sx={{ mt: 1 }} />
                <Skeleton width="45%" height={18} sx={{ mt: 1 }} />
              </Card>
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={3.5}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <Card sx={{ p: 3 }}>
              <Skeleton width="30%" height={22} />
              <Skeleton variant="rounded" height={240} sx={{ mt: 2 }} />
            </Card>
          </Grid>
          <Grid size={{ xs: 12, lg: 5 }}>
            <Card sx={{ p: 3 }}>
              <Skeleton width="40%" height={22} />
              {[0, 1, 2, 3].map((i) => (
                <Box key={i} sx={{ mt: 2.5 }}>
                  <Skeleton width="60%" height={18} />
                  <Skeleton variant="rounded" height={10} sx={{ mt: 1 }} />
                </Box>
              ))}
            </Card>
          </Grid>
        </Grid>
      </Stack>
    )
  }

  return (
    <Box role="status" aria-label="Loading" sx={{ py: 1 }}>
      <Skeleton width="40%" height={26} />
      <Skeleton width="90%" height={18} sx={{ mt: 1.5 }} />
      <Skeleton width="75%" height={18} />
      <Skeleton variant="rounded" height={120} sx={{ mt: 2 }} />
      <Skeleton width="60%" height={18} sx={{ mt: 2 }} />
    </Box>
  )
}
