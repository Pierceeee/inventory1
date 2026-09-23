import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from '../components/ui/Toast.jsx'
import { SessionProvider } from '../hooks/useSession.jsx'

export function renderWithProviders(ui, { route = '/', path = '*' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <SessionProvider>
          <ToastProvider>
            <Routes>
              <Route path={path} element={ui} />
            </Routes>
          </ToastProvider>
        </SessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
