import Box from '@mui/material/Box'
import BrandLogo from '@/components/ui/BrandLogo'

// Split screen for sign-in and other pre-login pages: navy brand panel with
// the logo on the left (hidden on small screens), the page content on the right.
export default function AuthLayout({ children }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.paper' }}>
      <Box
        component="aside"
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: { md: '42%', lg: '38%' },
          maxWidth: 560,
          p: { md: 5, lg: 7 },
          bgcolor: 'brand.navy',
          color: 'common.white',
        }}
      >
        <BrandLogo tone="light" size="large" />
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
