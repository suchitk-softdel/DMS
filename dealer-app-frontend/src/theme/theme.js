import { createTheme } from '@mui/material/styles'

// Colors from the Dealer App UI Design Concept. Use these through the theme
// palette (e.g. 'primary.main', 'brand.navy') rather than hard-coding hex values.
export const brandColors = Object.freeze({
  navy: '#161B4B', // navigation rail, headings, dark panels
  navyLight: '#1F2766', // filled navy buttons and chips
  teal: '#00A896', // primary actions, active nav item, positive trends
  tealDark: '#047F8C', // AI insight cards
  orange: '#F2A541', // pending / warning
  red: '#D9475A', // risk / negative trends
  slate: '#4A5468', // neutral accents
})

const headingFont = 'Arial, "Helvetica Neue", Helvetica, sans-serif'

// Soft shadow under white cards, as in the UI Design Concept.
export const cardShadow = '0 2px 8px rgba(22, 27, 75, 0.08)'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brandColors.teal, dark: brandColors.tealDark, contrastText: '#ffffff' },
    secondary: { main: brandColors.navy, light: brandColors.navyLight, contrastText: '#ffffff' },
    success: { main: brandColors.teal, contrastText: '#ffffff' },
    warning: { main: brandColors.orange, contrastText: '#ffffff' },
    error: { main: brandColors.red, contrastText: '#ffffff' },
    brand: brandColors,
    text: { primary: '#1B1F3B', secondary: '#4A5068' },
    divider: '#DCDFE8',
    background: { default: '#F3F4F8', paper: '#ffffff' },
  },
  shape: { borderRadius: 8 },
  typography: {
    // UI Design Concept: Calibri for body text, Arial bold for titles and big numbers.
    // Carlito is a free metric-compatible Calibri for machines without it.
    fontFamily: 'Calibri, Carlito, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fontSize: 15,
    h1: { fontFamily: headingFont, fontWeight: 700, letterSpacing: '-0.01em' },
    h2: { fontFamily: headingFont, fontWeight: 700 },
    h3: { fontFamily: headingFont, fontWeight: 700 },
    h4: { fontFamily: headingFont, fontWeight: 700 },
    h5: { fontFamily: headingFont, fontWeight: 700 },
    h6: { fontFamily: headingFont, fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { boxShadow: cardShadow } },
    },
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
