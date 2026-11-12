import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

export default function EmptyState({
  title = 'No data yet',
  message,
  icon = <InboxOutlinedIcon color="action" sx={{ fontSize: 48 }} />,
  action,
  minHeight = 200,
}) {
  return (
    <Stack
      spacing={1}
      sx={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight, p: 3 }}
    >
      {icon}
      <Typography variant="subtitle1" component="p" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {message && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {message}
        </Typography>
      )}
      {action}
    </Stack>
  )
}
