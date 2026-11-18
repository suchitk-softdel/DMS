import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import ContentSkeleton from '@/components/common/ContentSkeleton'
import EmptyState from '@/components/patterns/EmptyState'

// Switches between loading, error, empty and content, so every data view
// handles all states the same way. While loading it shows grey placeholder
// shapes (`skeleton`: 'block' for panels, 'dashboard' for full pages).
export default function AsyncContent({
  loading = false,
  error = null,
  empty = false,
  emptyTitle,
  emptyMessage,
  onRetry,
  skeleton = 'block',
  children,
}) {
  if (loading) {
    return <ContentSkeleton variant={skeleton} />
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          onRetry && (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          )
        }
      >
        {typeof error === 'string' ? error : (error.message ?? 'Something went wrong.')}
      </Alert>
    )
  }

  if (empty) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />
  }

  return children
}
