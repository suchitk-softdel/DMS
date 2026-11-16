import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// IDEP logo mark with the product name. `tone="light"` is for dark
// backgrounds (navigation rail, sign-in brand panel).
export default function BrandLogo({ tone = 'dark', size = 'medium', showSubtitle = true }) {
  const markSize = size === 'large' ? 44 : 36
  const textColor = tone === 'light' ? 'common.white' : 'brand.navy'

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        aria-hidden
        sx={{ width: markSize, height: markSize, borderRadius: 1, bgcolor: 'primary.main', flexShrink: 0 }}
      />
      <Box>
        <Typography
          component="span"
          sx={{
            display: 'block',
            color: textColor,
            fontWeight: 700,
            fontSize: size === 'large' ? 28 : 22,
            lineHeight: 1.1,
          }}
        >
          IDEP
        </Typography>
        {showSubtitle && (
          <Typography
            component="span"
            variant="body2"
            sx={{ display: 'block', color: textColor, opacity: tone === 'light' ? 0.8 : 0.7 }}
          >
            Dealer App
          </Typography>
        )}
      </Box>
    </Box>
  )
}
