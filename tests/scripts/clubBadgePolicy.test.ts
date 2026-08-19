import { afterEach, describe, expect, it, vi } from 'vitest'
import { clubBadgePolicy } from '../../src/app/clubBadgePolicy'

/**
 * THE KILL SWITCH, PROVED IN BOTH DIRECTIONS.
 *
 * A switch nobody has turned on is a switch nobody knows works, and the failure
 * mode of a badge switch is not cosmetic: it renders somebody else's registered
 * trade mark and original artistic work. So both branches are exercised here,
 * with the same discipline `routeFlags` records — a function rather than a
 * frozen constant, precisely so the off branch can be tested.
 *
 * FAIL CLOSED IS THE POINT. Unset, misspelled, `'TRUE'`, `'1'`, `'yes'` — every
 * one of them is off, because the failure of a mis-set flag here should be "the
 * product looks like it did yesterday" and never "the product is displaying
 * assets whose rights nobody established".
 */

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the global switch', () => {
  it('is off when unset', () => {
    vi.stubEnv('VITE_UI_OFFICIAL_BADGES', '')
    expect(clubBadgePolicy().enabled).toBe(false)
  })

  it('is off for anything that is not the word "true"', () => {
    for (const value of ['TRUE', 'True', '1', 'yes', 'on', 'false']) {
      vi.stubEnv('VITE_UI_OFFICIAL_BADGES', value)
      expect(clubBadgePolicy().enabled, value).toBe(false)
    }
  })

  it('tolerates surrounding whitespace, exactly as routeFlags does', () => {
    // Not a looser rule invented here: `src/app/routeFlags.ts` trims and
    // compares to `'true'`, and two flag readers with two different notions of
    // what "true" is would be worse than either one.
    vi.stubEnv('VITE_UI_OFFICIAL_BADGES', ' true ')
    expect(clubBadgePolicy().enabled).toBe(true)
  })

  it('takes everything else with it when it is off', () => {
    // A configuration that names approved providers and competitions but leaves
    // the switch off must not half-apply. The policy is the whole answer.
    vi.stubEnv('VITE_UI_OFFICIAL_BADGES', 'false')
    vi.stubEnv('VITE_UI_OFFICIAL_BADGE_SOURCES', 'football-data,sportmonks')
    vi.stubEnv('VITE_UI_OFFICIAL_BADGE_COMPETITIONS', 'season-1')
    const policy = clubBadgePolicy()
    expect(policy.enabled).toBe(false)
    expect(policy.sources).toEqual([])
    expect(policy.competitions).toBeNull()
  })
})

describe('the provider switch', () => {
  it('approves only the providers it names', () => {
    vi.stubEnv('VITE_UI_OFFICIAL_BADGES', 'true')
    vi.stubEnv('VITE_UI_OFFICIAL_BADGE_SOURCES', 'football-data')
    expect(clubBadgePolicy().sources).toEqual(['football-data'])
  })

  it('approves nobody when it is empty, which is the same as the switch being off', () => {
    vi.stubEnv('VITE_UI_OFFICIAL_BADGES', 'true')
    vi.stubEnv('VITE_UI_OFFICIAL_BADGE_SOURCES', '')
    expect(clubBadgePolicy().sources).toEqual([])
  })

  it('ignores a name it does not recognise rather than throwing', () => {
    // A typo must not enable the others by accident and must not take the
    // application down. Not recognised is not approved, which is the same
    // answer as not naming it.
    vi.stubEnv('VITE_UI_OFFICIAL_BADGES', 'true')
    vi.stubEnv('VITE_UI_OFFICIAL_BADGE_SOURCES', 'football-dat,sportmonks,nonsense')
    expect(clubBadgePolicy().sources).toEqual(['sportmonks'])
  })
})

describe('the competition switch', () => {
  it('is "every competition" when unset', () => {
    vi.stubEnv('VITE_UI_OFFICIAL_BADGES', 'true')
    vi.stubEnv('VITE_UI_OFFICIAL_BADGE_COMPETITIONS', '')
    expect(clubBadgePolicy().competitions).toBeNull()
  })

  it('narrows to the ones it names', () => {
    vi.stubEnv('VITE_UI_OFFICIAL_BADGES', 'true')
    vi.stubEnv('VITE_UI_OFFICIAL_BADGE_COMPETITIONS', ' season-a , season-b ')
    expect(clubBadgePolicy().competitions).toEqual(['season-a', 'season-b'])
  })

  it('reads a list of nothing but separators as the narrower answer', () => {
    vi.stubEnv('VITE_UI_OFFICIAL_BADGES', 'true')
    vi.stubEnv('VITE_UI_OFFICIAL_BADGE_COMPETITIONS', ' , , ')
    expect(clubBadgePolicy().competitions).toEqual([])
  })
})
