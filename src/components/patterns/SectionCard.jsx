import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Divider from '@mui/material/Divider'

// Titled card used to group a section of a page.
// `disablePadding` is for full-bleed content such as tables.
export default function SectionCard({
  title,
  subtitle,
  actions,
  disablePadding = false,
  children,
  sx,
}) {
  const hasHeader = Boolean(title || subtitle || actions)

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...sx }}>
      {hasHeader && (
        <>
          <CardHeader
            title={title}
            subheader={subtitle}
            action={actions}
            slotProps={{
              title: { variant: 'h6', component: 'h2' },
              subheader: { variant: 'body2' },
            }}
          />
          <Divider />
        </>
      )}
      {disablePadding ? children : <CardContent sx={{ flexGrow: 1 }}>{children}</CardContent>}
    </Card>
  )
}
