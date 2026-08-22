import { describe, expect, it } from 'vitest'
import { shellIntentForHome } from '../../src/vnext/integration/home/VNextHomeScreen'

describe('Home connected navigation intents', () => {
  it('keeps Find a league on the competition Leagues destination', () => {
    expect(
      shellIntentForHome(
        { kind: 'primary-action', action: 'joinLeague' },
        'season-1',
      ),
    ).toEqual({ kind: 'destination', destination: 'leagues', contextId: 'season-1' })
  })

  it('carries the authoritative fixture id to the exact Match Centre seam', () => {
    expect(
      shellIntentForHome(
        { kind: 'match-centre', fixtureId: 'fixture-42' },
        'season-1',
      ),
    ).toEqual({
      kind: 'match-centre',
      contextId: 'season-1',
      fixtureId: 'fixture-42',
    })
  })
})
