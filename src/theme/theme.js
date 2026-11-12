import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0b4f8a' },
    secondary: { main: '#e0701b' },
    background: { default: '#f5f7fa', paper: '#ffffff' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiPaper: { defaultProps: { elevation: 0 } },
  },
})

// Maps domain status values to MUI palette color names (Chip, LinearProgress, ...).
export const statusColors = Object.freeze({
  active: 'success',
  approved: 'success',
  delivered: 'success',
  pending: 'warning',
  onHold: 'warning',
  submitted: 'info',
  shipped: 'info',
  inactive: 'default',
  rejected: 'error',
  cancelled: 'error',
})

export const riskColors = Object.freeze({
  low: 'success',
  medium: 'warning',
  high: 'error',
})
