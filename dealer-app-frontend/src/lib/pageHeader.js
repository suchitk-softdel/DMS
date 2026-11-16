import { createContext, useContext } from 'react'

// The page title and subtitle are shown in the top bar (UI Design Concept),
// but each page decides them. Pages set them with <PageHeader />; the top bar
// reads them with usePageHeader(). The provider is PageHeaderProvider.
export const PageHeaderContext = createContext(null)

export function usePageHeader() {
  return useContext(PageHeaderContext)
}
