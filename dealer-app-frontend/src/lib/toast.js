import { createContext, useContext } from 'react'

// Short confirmation messages ("Order ORD-101 approved") shown as a toast in
// the corner, which closes by itself. Provided by components/common/ToastProvider.
export const ToastContext = createContext(null)

// const toast = useToast(); toast('Saved.') or toast('Could not save.', 'error')
export function useToast() {
  return useContext(ToastContext) ?? (() => {})
}
