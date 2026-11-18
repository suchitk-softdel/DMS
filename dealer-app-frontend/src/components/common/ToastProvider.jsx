import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import { useCallback, useState } from 'react'
import { ToastContext } from '@/lib/toast'

const AUTO_HIDE_MS = 4500

// Shows one toast at a time in the bottom-right corner; a new message
// replaces the current one.
export default function ToastProvider({ children }) {
  const [toast, setToast] = useState(null) // { key, message, severity }
  const [open, setOpen] = useState(false)

  const show = useCallback((message, severity = 'success') => {
    setToast({ key: Date.now(), message, severity })
    setOpen(true)
  }, [])

  const close = (_event, reason) => {
    if (reason !== 'clickaway') setOpen(false)
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <Snackbar
        key={toast?.key}
        open={open}
        autoHideDuration={AUTO_HIDE_MS}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast ? (
          <Alert
            onClose={close}
            severity={toast.severity}
            variant="filled"
            sx={{ minWidth: 300, boxShadow: '0 8px 24px rgba(22, 27, 75, 0.18)', fontSize: 15 }}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  )
}
