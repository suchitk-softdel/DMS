import { useMemo, useState } from 'react'
import { PageHeaderContext } from '@/lib/pageHeader'

// Holds the current page's title and subtitle for the top bar (see lib/pageHeader.js).
export function PageHeaderProvider({ children }) {
  const [header, setHeader] = useState({ title: '', subtitle: '' })
  const value = useMemo(() => ({ header, setHeader }), [header])
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
}
