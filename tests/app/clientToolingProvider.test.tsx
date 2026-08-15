import { useQuery } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClientToolingProvider } from '../../src/app/ClientToolingProvider'

function QueryProbe() {
  const query = useQuery({
    queryKey: ['client-tooling-provider-probe'],
    queryFn: async () => 'query-ready',
  })

  return <span>{query.data ?? 'loading'}</span>
}

describe('ClientToolingProvider', () => {
  it('provides a working TanStack Query client when a feature opts in', async () => {
    render(
      <ClientToolingProvider>
        <QueryProbe />
      </ClientToolingProvider>,
    )

    expect(await screen.findByText('query-ready')).toBeInTheDocument()
  })
})
