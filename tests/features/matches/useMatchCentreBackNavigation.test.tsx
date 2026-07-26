import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { useMatchCentreBackNavigation } from '../../../src/features/matches/useMatchCentreBackNavigation'

function MatchCentreBackHarness() {
  const onBack = useMatchCentreBackNavigation()
  return <button onClick={onBack}>Back</button>
}

function LocationProbe() {
  const location = useLocation()
  return <output>{`${location.pathname}${location.search}${location.hash}`}</output>
}

describe('useMatchCentreBackNavigation', () => {
  it('returns to the explicit originating route with query and hash intact', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/matches/M01',
            state: {
              returnTo: {
                pathname: '/groups',
                search: '?view=date',
                hash: '#matchday-2',
              },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/matches/:matchRef" element={<MatchCentreBackHarness />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('/groups?view=date#matchday-2')).toBeInTheDocument()
  })

  it('falls back to Home for a refreshed deep link without navigation state', () => {
    render(
      <MemoryRouter initialEntries={['/matches/M01']}>
        <Routes>
          <Route path="/matches/:matchRef" element={<MatchCentreBackHarness />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('/')).toBeInTheDocument()
  })

  it('rejects an external return destination and falls back to Home', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/matches/M01',
            state: { returnTo: { pathname: 'https://example.com/phishing' } },
          },
        ]}
      >
        <Routes>
          <Route path="/matches/:matchRef" element={<MatchCentreBackHarness />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('/')).toBeInTheDocument()
  })
})
