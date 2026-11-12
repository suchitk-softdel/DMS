import { useState } from 'react'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useDispatch, useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import PageLoader from '@/components/common/PageLoader'
import { env } from '@/config/env'
import { usePermissions } from '@/lib/rbac'
import {
  clearAuthError,
  login,
  selectAuthError,
  selectAuthStatus,
} from '@/store/slices/authSlice'

// Shown to help testers; remove once real authentication exists.
const DEMO_ACCOUNTS = [
  { email: 'admin@demo.com', label: 'Administrator' },
  { email: 'principal@demo.com', label: 'Dealer Principal' },
  { email: 'sales@demo.com', label: 'Sales Representative' },
  { email: 'tech@demo.com', label: 'Service Technician' },
]
const DEMO_PASSWORD = 'demo123'

export default function Login() {
  const dispatch = useDispatch()
  const status = useSelector(selectAuthStatus)
  const error = useSelector(selectAuthError)
  const { user, rolesStatus, homePath } = usePermissions()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Logged in: wait for roles, then go to the role's first accessible module.
  if (user) {
    return rolesStatus === 'idle' || rolesStatus === 'loading' ? (
      <PageLoader fullScreen />
    ) : (
      <Navigate to={homePath} replace />
    )
  }

  const handleChange = (setter) => (event) => {
    setter(event.target.value)
    if (error) dispatch(clearAuthError())
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    dispatch(login({ email, password }))
  }

  const fillDemoAccount = (demoEmail) => {
    setEmail(demoEmail)
    setPassword(DEMO_PASSWORD)
    if (error) dispatch(clearAuthError())
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 420 }}>
        <Stack spacing={1} sx={{ alignItems: 'center', mb: 3 }}>
          <AcUnitIcon color="primary" sx={{ fontSize: 40 }} />
          <Typography variant="h5" component="h1">
            Dealer App
          </Typography>
          <Typography color="text.secondary">Sign in to your dealer portal</Typography>
        </Stack>

        <Stack component="form" spacing={2} onSubmit={handleSubmit} noValidate>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            fullWidth
            value={email}
            onChange={handleChange(setEmail)}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            fullWidth
            value={password}
            onChange={handleChange(setPassword)}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            loading={status === 'loading'}
            disabled={!email || !password}
          >
            Sign in
          </Button>
        </Stack>

        {env.showDemoAccounts && (
          <>
            <Divider sx={{ my: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Demo accounts (password {DEMO_PASSWORD})
              </Typography>
            </Divider>
            <List dense disablePadding>
              {DEMO_ACCOUNTS.map((account) => (
                <ListItemButton
                  key={account.email}
                  onClick={() => fillDemoAccount(account.email)}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemText primary={account.label} secondary={account.email} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
      </Paper>
    </Box>
  )
}
