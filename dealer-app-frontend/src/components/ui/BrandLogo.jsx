import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// The logo mark: a teal tile with a white "D", the same artwork as the
// browser-tab icon (public/favicon.svg).
function LogoMark({ size }) {
  return (
    <Box component="svg" viewBox="0 0 64 64" aria-hidden sx={{ width: size, height: size, flexShrink: 0, display: 'block' }}>
      <defs>
        <linearGradient id="dealers-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00A896" />
          <stop offset="1" stopColor="#047F8C" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#dealers-logo-bg)" />
      <path
        fill="#FFFFFF"
        fillRule="evenodd"
        d="M18 14h14c10.5 0 18 7.6 18 18s-7.5 18-18 18H18zm8 8v20h6c5.7 0 9.8-4.2 9.8-10S37.7 22 32 22z"
      />
    </Box>
  )
}

// Logo mark with the product name. `tone="light"` is for dark backgrounds
// (navigation rail, sign-in brand panel).
export default function BrandLogo({ tone = 'dark', size = 'medium', showSubtitle = true }) {
  const markSize = size === 'large' ? 46 : 38
  const textColor = tone === 'light' ? 'common.white' : 'brand.navy'

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <LogoMark size={markSize} />
      <Box>
        <Typography
          component="span"
          sx={{
            display: 'block',
            color: textColor,
            fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
            fontWeight: 700,
            fontSize: size === 'large' ? 24 : 19,
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
          }}
        >
          Dealers App
        </Typography>
        {showSubtitle && (
          <Typography
            component="span"
            sx={{ display: 'block', mt: 0.25, fontSize: 12.5, color: textColor, opacity: tone === 'light' ? 0.65 : 0.6 }}
          >
            Intelligent Dealer Platform
          </Typography>
        )}
      </Box>
    </Box>
  )
}
