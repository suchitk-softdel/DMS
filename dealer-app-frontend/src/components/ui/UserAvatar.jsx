import Avatar from '@mui/material/Avatar'

// Round avatar with the first letter of the name, as in the UI design.
// color: theme color for the background, e.g. 'secondary.main', 'primary.main'.
export default function UserAvatar({ name = '', color = 'secondary.main', size = 48, sx }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <Avatar
      aria-hidden
      sx={{ width: size, height: size, bgcolor: color, color: 'common.white', fontWeight: 700, fontSize: size * 0.4, ...sx }}
    >
      {initial}
    </Avatar>
  )
}
