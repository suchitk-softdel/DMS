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

// Soft, layered shadow under white cards: a hairline plus a wide, faint blur,
// so cards lift off the page without looking heavy.
export const cardShadow = '0 1px 2px rgba(22, 27, 75, 0.04), 0 4px 16px rgba(22, 27, 75, 0.06)'
const hoverShadow = '0 2px 4px rgba(22, 27, 75, 0.06), 0 8px 24px rgba(22, 27, 75, 0.10)'
const lineColor = '#E6E8EF' // card borders and table lines, lighter than the divider

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brandColors.teal, dark: brandColors.tealDark, contrastText: '#ffffff' },
    secondary: { main: brandColors.navy, light: brandColors.navyLight, contrastText: '#ffffff' },
    success: { main: brandColors.teal, contrastText: '#ffffff' },
    warning: { main: brandColors.orange, contrastText: '#ffffff' },
    error: { main: brandColors.red, contrastText: '#ffffff' },
    brand: brandColors,
    text: { primary: '#1B1F3B', secondary: '#5A6078' },
    divider: '#DCDFE8',
    background: { default: '#F4F5F9', paper: '#ffffff' },
  },
  shape: { borderRadius: 10 },
  typography: {
    // UI Design Concept: Calibri for body text, Arial bold for titles and big numbers.
    // Carlito is a free metric-compatible Calibri for machines without it.
    fontFamily: 'Calibri, Carlito, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fontSize: 15,
    h1: { fontFamily: headingFont, fontWeight: 700, letterSpacing: '-0.015em' },
    h2: { fontFamily: headingFont, fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontFamily: headingFont, fontWeight: 700 },
    h4: { fontFamily: headingFont, fontWeight: 700 },
    h5: { fontFamily: headingFont, fontWeight: 700 },
    h6: { fontFamily: headingFont, fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Figures line up in tables and tiles (1,111 and 8,888 take the same width).
        body: { fontVariantNumeric: 'tabular-nums', WebkitFontSmoothing: 'antialiased' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8 }, sizeLarge: { paddingTop: 10, paddingBottom: 10 } },
    },
    MuiToggleButton: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600, borderColor: lineColor } },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: { boxShadow: cardShadow, borderColor: lineColor, transition: 'box-shadow 150ms ease' },
      },
    },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10, alignItems: 'center' } } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: brandColors.navy, fontSize: 13, padding: '6px 10px', borderRadius: 6 },
        arrow: { color: brandColors.navy },
      },
    },
    // Tables: quiet uppercase header, light row lines, soft teal hover.
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: lineColor, paddingTop: 14, paddingBottom: 14 },
        head: {
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#6B7088',
          backgroundColor: '#F8F9FB',
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { '&.MuiTableRow-hover:hover': { backgroundColor: 'rgba(0, 168, 150, 0.045)' } },
      },
    },
    MuiTableSortLabel: { styleOverrides: { root: { '&.Mui-active': { color: brandColors.navy } } } },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 5 } } },
  },
})

export { hoverShadow }

// Maps domain status values to MUI palette color names (Chip, LinearProgress, ...).
// Order statuses follow the UI design: Draft grey, Submitted orange, Approved
// teal, Fulfilled navy (FR-ORD-4).
export const statusColors = Object.freeze({
  active: 'success',
  approved: 'success',
  delivered: 'success',
  fulfilled: 'secondary',
  accepted: 'info',
  declined: 'error',
  draft: 'default',
  pending: 'warning',
  onHold: 'warning',
  submitted: 'warning',
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
