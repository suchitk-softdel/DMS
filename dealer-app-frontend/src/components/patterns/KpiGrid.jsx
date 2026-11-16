import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'
import KpiTile from '@/components/ui/KpiTile'

/**
 * Responsive row of KpiTiles.
 * items: [{ key?, label, value, accent?, trend? }] (see KpiTile)
 * columns: tiles per row on desktop (1, 2, 3, 4 or 6).
 */
export default function KpiGrid({ items = [], columns = 4, spacing = 2, loading = false, skeletonCount }) {
  const desktopSize = 12 / columns
  const tabletSize = Math.max(desktopSize, 6)
  // Next to the navigation rail, 4 tiles only fit side by side on large screens.
  const size = { xs: 12, sm: tabletSize, lg: desktopSize }

  if (loading) {
    const count = skeletonCount ?? (items.length || columns)
    return (
      <Grid container spacing={spacing}>
        {Array.from({ length: count }, (_, index) => (
          <Grid key={index} size={size}>
            <Skeleton variant="rounded" height={128} />
          </Grid>
        ))}
      </Grid>
    )
  }

  return (
    <Grid container spacing={spacing}>
      {items.map(({ key, ...tile }) => (
        <Grid key={key ?? tile.label} size={size}>
          <KpiTile {...tile} />
        </Grid>
      ))}
    </Grid>
  )
}
