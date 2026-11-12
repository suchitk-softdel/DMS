import { Component } from 'react'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { env } from '@/config/env'

// Catches render errors in its subtree so a single broken page shows a
// friendly message instead of unmounting the whole app.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // TODO: forward to an error-monitoring service once one is chosen.
    console.error('Unhandled render error:', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8, px: 2 }}>
        <Paper variant="outlined" sx={{ p: 4, maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <Stack spacing={2} sx={{ alignItems: 'center' }}>
            <ErrorOutlineIcon color="error" sx={{ fontSize: 48 }} />
            <Typography variant="h6">Something went wrong</Typography>
            <Typography color="text.secondary">
              This part of the page couldn&apos;t be displayed. Reloading usually fixes it.
            </Typography>
            {env.isDev && (
              <Typography
                variant="body2"
                component="pre"
                sx={{ color: 'error.main', whiteSpace: 'pre-wrap', textAlign: 'left', m: 0 }}
              >
                {error.message}
              </Typography>
            )}
            <Button variant="contained" onClick={this.handleReload}>
              Reload page
            </Button>
          </Stack>
        </Paper>
      </Box>
    )
  }
}
