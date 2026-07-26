import { describe, expect, it } from 'vitest'
import {
  matchCentreLocation,
  matchCentreReturnLocation,
} from '../../../src/domain/tournament/matchCentreNavigation'

describe('Match Centre navigation', () => {
  it('builds the canonical route and preserves the full return destination', () => {
    expect(
      matchCentreLocation('M 01', {
        pathname: '/groups',
        search: '?view=date',
        hash: '#matchday-1',
      }),
    ).toEqual({
      pathname: '/match/M%2001',
      state: {
        returnTo: {
          pathname: '/groups',
          search: '?view=date',
          hash: '#matchday-1',
        },
      },
    })
  })

  it('fails closed when a match reference is missing', () => {
    expect(() => matchCentreLocation('   ', { pathname: '/groups' })).toThrow(
      'Match Centre navigation requires a match reference',
    )
  })

  it('restores a valid return location from router state', () => {
    expect(
      matchCentreReturnLocation({
        returnTo: {
          pathname: '/results',
          search: '?round=group',
          hash: '#M01',
        },
      }),
    ).toEqual({
      pathname: '/results',
      search: '?round=group',
      hash: '#M01',
    })
  })

  it('rejects malformed or external return destinations', () => {
    expect(
      matchCentreReturnLocation({
        returnTo: {
          pathname: 'https://example.com',
          search: 'bad',
          hash: 'bad',
        },
      }),
    ).toEqual({ pathname: '/' })
  })

  it('uses an explicit safe fallback for direct entries and refreshes', () => {
    expect(matchCentreReturnLocation(null, { pathname: '/groups' })).toEqual({
      pathname: '/groups',
    })
  })
})
