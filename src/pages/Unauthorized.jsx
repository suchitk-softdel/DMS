import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import { PUBLIC_PATHS } from '@/constants/modules'
import { usePermissions } from '@/lib/rbac'

export default function Unauthorized() {
  const { homePath } = usePermissions()
  const hasHome = homePath !== PUBLIC_PATHS.UNAUTHORIZED

  return (
    <Paper variant="outlined" sx={{ p: { xs: 4, md: 6 } }}>
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <LockOutlinedIcon color="warning" sx={{ fontSize: 56 }} />
        <Typography variant="h5" component="h1">
          Access denied
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
          {hasHome
            ? 'Your role does not have access to this page. Contact your administrator if you believe this is a mistake.'
            : 'Your role has not been granted access to any module yet. Contact your administrator.'}
        </Typography>
        {hasHome && (
          <Button variant="contained" component={RouterLink} to={homePath}>
            Go to my home page
          </Button>
        )}
      </Stack>
    </Paper>
  )
}
