import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

/**
 * Colored card for an AI result: label, message, evidence and actions
 * (SRS 6.8: every AI result shows the evidence behind it).
 *
 * tone: 'teal' (default, AI insights) or 'navy' (high-priority callouts).
 * evidence: list of short strings.
 * actions: [{ key, label, to?, onClick?, primary? }] rendered as white pills;
 *          `primary` is filled white, the others are outlined.
 * layout: 'row' puts the actions on the right (Home banner),
 *         'column' puts them below the text (Copilot answer).
 */
export default function InsightCard({
  label = 'AI Insight',
  message,
  evidence = [],
  actions = [],
  tone = 'teal',
  layout = 'row',
}) {
  const row = layout === 'row'

  return (
    <Box
      component="section"
      aria-label={label || 'AI insight'}
      sx={{
        bgcolor: tone === 'navy' ? 'brand.navy' : 'brand.tealDark',
        color: 'common.white',
        borderRadius: 1.5,
        px: { xs: 2.5, md: 4.5 },
        py: { xs: 2.5, md: 4 },
      }}
    >
      <Stack
        direction={row ? { xs: 'column', md: 'row' } : 'column'}
        spacing={row ? { xs: 2.5, md: 4 } : 4}
        sx={{ alignItems: row ? { md: 'center' } : 'flex-start', justifyContent: 'space-between' }}
      >
        <Box sx={{ minWidth: 0 }}>
          {label && (
            <Typography component="p" sx={{ fontSize: 14, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', mb: 2 }}>
              {label}
            </Typography>
          )}
          <Typography sx={{ fontSize: { xs: 17, md: 20 }, lineHeight: 1.5 }}>{message}</Typography>
          {evidence.length > 0 && (
            <Typography sx={{ mt: row ? 1.5 : 5, fontSize: 15, fontStyle: 'italic', opacity: 0.85 }}>
              Evidence: {evidence.join(' · ')}
            </Typography>
          )}
        </Box>
        {actions.length > 0 && (
          <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0, flexWrap: 'wrap', rowGap: 1.5 }}>
            {actions.map(({ key, label: actionLabel, to, onClick, primary }) => (
              <Button
                key={key}
                component={to ? RouterLink : 'button'}
                to={to}
                onClick={onClick}
                sx={{
                  minWidth: 220,
                  height: 56,
                  px: 4,
                  borderRadius: 28,
                  fontSize: 16,
                  ...(primary
                    ? { bgcolor: 'common.white', color: 'brand.tealDark', '&:hover': { bgcolor: 'grey.100' } }
                    : { color: 'common.white', border: '1.5px solid rgba(255, 255, 255, 0.7)', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }),
                }}
              >
                {actionLabel}
              </Button>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
