import Box from '@mui/material/Box'
import AsyncContent from '@/components/patterns/AsyncContent'
import SectionCard from '@/components/patterns/SectionCard'

// Card frame for a chart. The chart itself is passed as children, so pages
// never depend on which chart library is used.
export default function ChartCard({
  title,
  subtitle,
  actions,
  height = 300,
  loading = false,
  error = null,
  empty = false,
  emptyMessage = 'There is no data for the selected filters.',
  onRetry,
  children,
}) {
  return (
    <SectionCard title={title} subtitle={subtitle} actions={actions}>
      <Box sx={{ height, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <AsyncContent
          loading={loading}
          error={error}
          empty={empty}
          emptyTitle="No data"
          emptyMessage={emptyMessage}
          onRetry={onRetry}
        >
          {children}
        </AsyncContent>
      </Box>
    </SectionCard>
  )
}
