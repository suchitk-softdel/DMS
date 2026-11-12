import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import PageLoader from '@/components/common/PageLoader'
import EmptyState from '@/components/patterns/EmptyState'

// Switches between loading, error, empty and content, so every data view
// handles all states the same way.
export default function AsyncContent({
  loading = false,
  error = null,
  empty = false,
  emptyTitle,
  emptyMessage,
  onRetry,
  children,
}) {
  if (loading) {
    return <PageLoader />
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
