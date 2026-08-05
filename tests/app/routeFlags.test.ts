import { afterEach, describe, expect, it, vi } from 'vitest'
import { isNextUi, journeyImplementation } from '../../src/app/routeFlags'

/**
 * The route-level migration flag, and specifically that it fails closed.
 *
 * §13.4 makes rollback a release gate: a flag switch must restore the prior
 * journey. That guarantee is only worth something if the DEFAULT is the prior
 * journey — a flag that reads as "on" when unset, misspelled, or set to
 * `'True'`, `'1'` or `'yes'` would expose an unfinished surface to players
 * through a typo, and nothing would report it as an error.
 *
 * So the off branch is tested as carefully as the on branch, which is also why
 * `journeyImplementation` is a function rather than a constant evaluated at
 * module load: a constant cannot be tested in both states.
 */

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('route-level migration flags', () => {
  it('serves the legacy journey when the flag is unset', () => {
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', undefined as unknown as string)
    expect(journeyImplementation('seasonMatchPredictor')).toBe('legacy')
    expect(isNextUi('seasonMatchPredictor')).toBe(false)
  })

  it('serves the next journey only on the exact string "true"', () => {
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', 'true')
    expect(journeyImplementation('seasonMatchPredictor')).toBe('next')
  })

  it('tolerates surrounding whitespace, which an env file makes easy to add', () => {
    vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', '  true  ')
    expect(journeyImplementation('seasonMatchPredictor')).toBe('next')
  })

  it.each(['True', 'TRUE', '1', 'yes', 'on', 'enabled', '', 'false', 'ture'])(
    'refuses to switch on for %j',
    (value) => {
      vi.stubEnv('VITE_UI_SEASON_MATCH_PREDICTOR', value)
      expect(journeyImplementation('seasonMatchPredictor')).toBe('legacy')
    },
  )
})
