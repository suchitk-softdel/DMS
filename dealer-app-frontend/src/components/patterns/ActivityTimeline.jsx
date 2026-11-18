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
            gridTemplateColumns: withDots ? '12px 72px 1fr' : '72px 1fr',
            columnGap: { xs: 2, md: 3 },
            alignItems: 'center',
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            '&:last-of-type': { borderBottom: 0 },
          }}
        >
          {withDots && (
            <Box aria-hidden sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color ?? 'transparent', boxShadow: '0 0 0 4px rgba(0, 0, 0, 0.04)' }} />
          )}
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.secondary' }}>{date}</Typography>
          <Typography sx={{ fontSize: 15.5, minWidth: 0 }}>
            {text}
            {detail && (
              <Typography component="span" sx={{ ml: 1.25, fontSize: 13.5, color: 'text.secondary', opacity: 0.75 }}>
                {detail}
              </Typography>
            )}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}
