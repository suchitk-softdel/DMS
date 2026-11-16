import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { Link as RouterLink } from 'react-router-dom'

/**
 * Shortcut buttons from the UI design.
 * items: [{ key, label, to }]
 * variant: 'outlined' (white buttons in a row, Home) or
 *          'filled' (full-width navy buttons in a column, Copilot).
 */
export default function QuickActions({ items, variant = 'outlined' }) {
  const filled = variant === 'filled'

  return (
    <Stack
      direction={filled ? 'column' : { xs: 'column', sm: 'row' }}
      spacing={filled ? 2 : 3.5}
      sx={filled ? undefined : { flexWrap: 'wrap', rowGap: 2 }}
    >
      {items.map(({ key, label, to }) => (
        <Button
          key={key}
          component={RouterLink}
          to={to}
          sx={{
            height: filled ? 58 : 60,
            px: filled ? 3 : 7,
            borderRadius: 1,
            fontSize: 16,
            justifyContent: filled ? 'flex-start' : 'center',
            ...(filled
              ? { bgcolor: 'secondary.light', color: 'common.white', '&:hover': { bgcolor: 'secondary.main' } }
              : {
                  bgcolor: 'background.paper',
                  color: 'brand.navy',
                  border: 1,
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'background.paper', borderColor: 'brand.navy' },
                }),
          }}
        >
          {label}
        </Button>
      ))}
    </Stack>
  )
}
