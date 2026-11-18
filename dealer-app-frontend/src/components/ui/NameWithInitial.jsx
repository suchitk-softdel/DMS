import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// Soft, stable colours so the same name always gets the same colour.
const TINTS = [
  ['#E3F6F3', '#047F8C'],
  ['#E8EAF6', '#1F2766'],
  ['#FDF1E1', '#B26B0B'],
  ['#FBE7EA', '#B23246'],
  ['#E9F2FB', '#2D5F9A'],
  ['#EFEAF8', '#5B3F99'],
]
const tintFor = (name) => TINTS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TINTS.length]

/**
 * Name with a small round initial, for table cells.
 * secondary: optional grey line under the name (e.g. city).
 */
export default function NameWithInitial({ name = '', secondary }) {
  const [bg, fg] = tintFor(name)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      <Avatar aria-hidden sx={{ width: 32, height: 32, fontSize: 13.5, fontWeight: 700, bgcolor: bg, color: fg }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 15, lineHeight: 1.3 }} noWrap>
          {name}
        </Typography>
        {secondary && (
          <Typography variant="body2" color="text.secondary" noWrap>
            {secondary}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
