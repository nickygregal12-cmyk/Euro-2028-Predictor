import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

/**
 * Shared home for client-side tooling that should wrap the React tree once.
 *
 * No existing Supabase read is migrated merely by adding this provider. New or
 * deliberately migrated server-state reads can opt into TanStack Query with a
 * single cache and predictable defaults instead of creating per-feature caches.
 */
export function ClientToolingProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
