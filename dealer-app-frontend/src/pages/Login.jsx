import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useDispatch, useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import PageLoader from '@/components/common/PageLoader'
import PasswordField from '@/components/ui/PasswordField'
import { env } from '@/config/env'
import AuthLayout from '@/layouts/AuthLayout'
import { usePermissions } from '@/lib/rbac'
import {
  clearAuthError,
  login,
  selectAuthError,
  selectAuthStatus,
} from '@/store/slices/authSlice'

// Shown to help testers; remove once real authentication exists.
const DEMO_ACCOUNTS = [
  { email: 'principal@demo.com', label: 'Dealer' },
  { email: 'manufacturer@demo.com', label: 'Manufacturer' },
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
    <AuthLayout>
      <Typography variant="h4" component="h1" sx={{ color: 'brand.navy', fontWeight: 700 }}>
        Welcome back
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 4 }}>
        Sign in to your account
      </Typography>

      <Stack component="form" spacing={2.5} onSubmit={handleSubmit} noValidate>
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
        <PasswordField
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
          fullWidth
          loading={status === 'loading'}
          disabled={!email || !password}
          sx={{ py: 1.5, borderRadius: 2 }}
        >
          Sign in
        </Button>
      </Stack>

      {env.showDemoAccounts && (
        <Box sx={{ mt: 4 }}>
          <Divider>
            <Typography variant="caption" color="text.secondary">
              Demo accounts · password {DEMO_PASSWORD}
            </Typography>
          </Divider>
          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: 'wrap' }}>
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                variant="outlined"
                color="secondary"
                size="small"
                fullWidth
                onClick={() => fillDemoAccount(account.email)}
                title={account.email}
                sx={{ borderRadius: 5, flex: '1 1 0', minWidth: { xs: 'calc(50% - 8px)', sm: 0 } }}
              >
                {account.label}
              </Button>
            ))}
          </Stack>
        </Box>
      )}
    </AuthLayout>
  )
}
