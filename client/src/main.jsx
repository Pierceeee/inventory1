import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import { SessionProvider } from './hooks/useSession.jsx'
// Overpass, self-hosted: the highway-signage face every screen is set in.
import '@fontsource/overpass/400.css'
import '@fontsource/overpass/500.css'
import '@fontsource/overpass/600.css'
import '@fontsource/overpass/700.css'
import './index.css'

const queryClient = new QueryClient({
  // A 403 anywhere (a demotion, a department change, deactivation) means the
  // sidebar and route guards may be stale - refetch /me so they catch up
  // without waiting for its own 60s staleTime.
  queryCache: new QueryCache({
    onError: (error) => {
      if (error?.status === 403) queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  }),
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
