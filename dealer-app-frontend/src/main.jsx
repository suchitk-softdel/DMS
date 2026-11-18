import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import App from '@/App'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import ToastProvider from '@/components/common/ToastProvider'
import { store } from '@/store/store'
import { theme } from '@/theme/theme'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <ErrorBoundary>
            <ToastProvider>
              <App />
            </ToastProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </StrictMode>,
)
