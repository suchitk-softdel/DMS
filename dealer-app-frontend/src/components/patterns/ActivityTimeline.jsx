import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/**
 * Dated list of events (Home Recent Activity, Dealer 360 timeline).
 * items: [{ key, date (already formatted), text, detail?, color? }]
 * color: theme color for the dot, e.g. 'primary.main'. Omit to hide dots.
 * detail: small grey text after the main text (e.g. an order number).
 */
export default function ActivityTimeline({ items }) {
  const withDots = items.some((item) => item.color)

  return (
    <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {items.map(({ key, date, text, detail, color }) => (
        <Box
          key={key}
          component="li"
          sx={{
            display: 'grid',
            gridTemplateColumns: withDots ? '18px 90px 1fr' : '90px 1fr',
            columnGap: { xs: 2, md: 3 },
            alignItems: 'center',
            py: 1.75,
          }}
        >
          {withDots && (
            <Box aria-hidden sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: color ?? 'transparent' }} />
          )}
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.secondary' }}>{date}</Typography>
          <Typography sx={{ fontSize: 18, minWidth: 0 }}>
            {text}
            {detail && (
              <Typography component="span" sx={{ ml: 1.5, fontSize: 14, color: 'text.disabled' }}>
                {detail}
              </Typography>
            )}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}
