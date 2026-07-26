import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { useOpenMatchCentre } from '../../../src/features/matches/useOpenMatchCentre'

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/matches?view=date#matchday-2']}>{children}</MemoryRouter>
}

describe('useOpenMatchCentre', () => {
  it('opens the registered route with the full current location as return state', () => {
    const { result } = renderHook(
      () => ({ openMatch: useOpenMatchCentre(), location: useLocation() }),
      { wrapper },
    )

    act(() => result.current.openMatch('M 12'))

    expect(result.current.location.pathname).toBe('/match/M%2012')
    expect(result.current.location.state).toEqual({
      returnTo: {
        pathname: '/matches',
        search: '?view=date',
        hash: '#matchday-2',
      },
    })
  })
})
