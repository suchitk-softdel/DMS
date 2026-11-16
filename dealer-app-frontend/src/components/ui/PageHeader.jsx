import { useEffect } from 'react'
import Stack from '@mui/material/Stack'
import { usePageHeader } from '@/lib/pageHeader'

// Sets the page title and subtitle shown in the top bar. `actions` (buttons,
// filters) are rendered at the top of the page content.
export default function PageHeader({ title, subtitle = '', actions }) {
  const context = usePageHeader()
  const setHeader = context?.setHeader

  useEffect(() => {
    setHeader?.({ title, subtitle })
  }, [setHeader, title, subtitle])

  useEffect(() => {
    if (title) document.title = `${title} · IDEP Dealer App`
  }, [title])

  if (!actions) return null
  return (
    <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', rowGap: 1.5, alignItems: 'center' }}>
      {actions}
    </Stack>
  )
}
