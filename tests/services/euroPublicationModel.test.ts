import { describe, expect, it } from 'vitest'
import {
  EURO_PUBLICATION_STATES,
  isEuroPublicationState,
  nextEuroPublicationState,
} from '../../src/services/supabase/euroPublicationModel'

/**
 * The lifecycle this model offers must be the lifecycle Contract 143 permits.
 *
 * The adjacency list below is copied from the migration's own `if not (...)`
 * guard rather than from the ordered array the model uses, so a reordering of
 * that array fails here instead of silently offering a step the server refuses.
 */
const SERVER_ADJACENCY: ReadonlyArray<readonly [from: string, to: string]> = [
  ['hidden', 'prelaunch'],
  ['prelaunch', 'registration-open'],
  ['registration-open', 'live'],
  ['live', 'completed'],
  ['completed', 'archived'],
]

describe('the Euro publication lifecycle model', () => {
  it('offers exactly the transitions the server permits', () => {
    const offered = EURO_PUBLICATION_STATES.flatMap((state) => {
      const next = nextEuroPublicationState(state)
      return next ? [[state, next] as const] : []
    })

    expect(offered).toEqual(SERVER_ADJACENCY)
  })

  it('offers nothing beyond the end of the lifecycle', () => {
    expect(nextEuroPublicationState('archived')).toBeNull()
  })

  it('never offers a step backwards', () => {
    for (const state of EURO_PUBLICATION_STATES) {
      const next = nextEuroPublicationState(state)
      if (!next) continue
      expect(EURO_PUBLICATION_STATES.indexOf(next)).toBeGreaterThan(
        EURO_PUBLICATION_STATES.indexOf(state),
      )
    }
  })

  it('recognises only the six server states', () => {
    for (const state of EURO_PUBLICATION_STATES) {
      expect(isEuroPublicationState(state)).toBe(true)
    }
    for (const value of ['', 'published', 'HIDDEN', null, undefined, 3, {}]) {
      expect(isEuroPublicationState(value)).toBe(false)
    }
  })
})
