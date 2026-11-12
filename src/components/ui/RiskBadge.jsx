import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import Chip from '@mui/material/Chip'
import { riskColors } from '@/theme/theme'

export default function RiskBadge({ level, size = 'small' }) {
  const label = level ? `${level.charAt(0).toUpperCase()}${level.slice(1)} risk` : 'Unknown risk'

  return (
    <Chip
      size={size}
      variant="outlined"
      color={riskColors[level] ?? 'default'}
      icon={<FiberManualRecordIcon />}
      label={label}
    />
  )
}
