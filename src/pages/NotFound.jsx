import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import { PUBLIC_PATHS } from '@/constants/modules'
import { usePermissions } from '@/lib/rbac'

export default function NotFound() {
  const { user, homePath } = usePermissions()

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <SearchOffOutlinedIcon color="action" sx={{ fontSize: 64 }} />
        <Typography variant="h4" component="h1">
          Page not found
        </Typography>
        <Typography color="text.secondary">
          The page you are looking for doesn&apos;t exist or has been moved.
        </Typography>
        <Button
          variant="contained"
          component={RouterLink}
          to={user ? homePath : PUBLIC_PATHS.LOGIN}
        >
          {user ? 'Back to home' : 'Go to sign in'}
        </Button>
      </Stack>
    </Box>
  )
}
