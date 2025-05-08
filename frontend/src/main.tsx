import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from './components/theme-provider'
import { Toaster } from './components/ui/sonner'
import './index.css'
import { store } from './store'
import router from './routes'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
        <RouterProvider router={router} />
        <Toaster />
      </ThemeProvider>
    </Provider>
  </StrictMode>,
)
