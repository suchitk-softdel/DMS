import Typography from '@mui/material/Typography'

// Small teal uppercase heading used for sections and card titles
// ("QUICK ACTIONS", "RECENT ACTIVITY").
export default function SectionTitle({ children, component = 'h2', sx }) {
  return (
    <Typography
      component={component}
      sx={{
        color: 'brand.tealDark',
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        mb: 2.5,
        ...sx,
      }}
    >
      {children}
    </Typography>
  )
}
