import Chip from '@mui/material/Chip'
import { statusColors } from '@/theme/theme'

// "onHold" -> "On hold"
function humanize(value = '') {
  const spaced = value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export default function StatusChip({ status, label, size = 'small', ...chipProps }) {
  return (
    <Chip
      size={size}
      color={statusColors[status] ?? 'default'}
      label={label ?? humanize(status)}
      {...chipProps}
    />
  )
}
