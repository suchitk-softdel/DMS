import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

export default function ComingSoon({ title, note = 'This module is under construction.' }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 4, md: 6 } }}>
      <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <ConstructionOutlinedIcon color="action" sx={{ fontSize: 56 }} />
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 520 }}>
          {note}
        </Typography>
      </Stack>
    </Paper>
  )
}
