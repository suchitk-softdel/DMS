import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import BrandLogo from '@/components/ui/BrandLogo'

// What the app offers, shown on the brand panel (SRS 2.2).
const HIGHLIGHTS = [
  'Daily priorities and KPIs at a glance',
  'A Copilot that helps you ask, decide and act',
  'Orders, inventory, warranty and incentives in one place',
]

// Split screen for sign-in and other pre-login pages: navy brand panel on the
// left (hidden on small screens), the page content on the right.
export default function AuthLayout({ children }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.paper' }}>
      <Box
        component="aside"
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: { md: '42%', lg: '38%' },
          maxWidth: 560,
          p: { md: 5, lg: 7 },
          bgcolor: 'brand.navy',
          color: 'common.white',
        }}
      >
        <BrandLogo tone="light" size="large" />

        <Box>
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: 2, fontWeight: 700 }}>
            Ask · Decide · Act
          </Typography>
          <Typography variant="h4" component="p" sx={{ mt: 1, mb: 4, fontWeight: 700, lineHeight: 1.25 }}>
            Everything your dealership needs, in one place.
          </Typography>
          <Stack spacing={2} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {HIGHLIGHTS.map((text) => (
              <Stack key={text} component="li" direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <CheckCircleOutlineIcon sx={{ color: 'primary.main' }} />
                <Typography sx={{ opacity: 0.9 }}>{text}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          Intelligent Dealer Ecosystem Platform
        </Typography>
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: { xs: 4, md: 6 },
        }}
      >
        {/* On small screens the brand panel is hidden, so show the logo here. */}
        <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 4 }}>
          <BrandLogo />
        </Box>
        <Box sx={{ width: '100%', maxWidth: 400 }}>{children}</Box>
      </Box>
    </Box>
  )
}
