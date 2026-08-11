import { describe, expect, it } from 'vitest'
import {
  draftFromPreferences,
  isOnboardingStep,
  nextStep,
  previousStep,
  resumeStep,
  ONBOARDING_STEPS,
} from '../../../src/features/onboarding/onboardingResume'
import { EMPTY_DRAFT } from '../../../src/features/onboarding/onboardingDraft'
import {
  mapPlayerPreferences,
  storedOnboardingStep,
} from '../../../src/services/supabase/playerPreferencesModel'
import type { HubCompetition } from '../../../src/features/hub/competitionCatalogue'

/**
 * Resuming onboarding — the half that makes persisting it worth anything.
 *
 * Writing progress and then starting from step one on the next sign-in would be
 * strictly worse than not writing it: the player answers the same questions
 * again and cannot tell why. These assertions pin that both halves come back —
 * the step AND what was already chosen — and that a step this build no longer
 * has cannot strand anybody.
 */

function competition(name: string, tournamentId: string): HubCompetition {
  return {
    competitionSlug: name.toLowerCase().replace(/\s+/g, '-'),
    seasonSlug: '2026-27',
    seasonRowName: `${name} 2026/27`,
    tournamentId,
    name,
    seasonLabel: '2026/27',
    status: 'live',
    summary: 'A summary.',
    games: [],
  }
}

const CATALOGUE = [
  competition('Premier League', 'season-epl'),
  competition('Scottish Premiership', 'season-spfl'),
]

describe('resumeStep', () => {
  it('resumes at the step the server recorded, through the stored vocabulary', () => {
    // THE ASSERTION THIS REPLACES FED THE JOURNEY'S OWN NAMES STRAIGHT INTO THE
    // DECODER, which is the mistake that shipped: `profiles.onboarding_step`
    // accepts four values and the journey names its steps differently, so three
    // of every four writes were a CHECK violation the server answered 400 and
    // the surface swallowed. A test that supplies journey names as stored
    // values can never catch it, because it agrees with the bug. These are the
    // values the column actually holds.
    for (const step of ONBOARDING_STEPS) {
      const stored = storedOnboardingStep(step)
      expect(stored, `no stored value for the "${step}" step`).not.toBeNull()
      expect(resumeStep(mapPlayerPreferences({ onboarding: { step: stored } }))).toBe(step)
    }
  })

  it('maps every journey step onto a value the column accepts, and no two onto one', () => {
    const stored = ONBOARDING_STEPS.map((step) => storedOnboardingStep(step))
    // The four the contract 157 CHECK constraint allows, verbatim.
    expect(new Set(stored)).toEqual(new Set(['competition', 'games', 'identity', 'done']))
    expect(new Set(stored).size, 'two steps share a stored value and cannot round-trip').toBe(
      ONBOARDING_STEPS.length,
    )
  })

  it('starts at the beginning for a player the server has never seen', () => {
    expect(resumeStep(null)).toBe('competitions')
    expect(resumeStep(mapPlayerPreferences({}))).toBe('competitions')
  })

  it('starts at the beginning for a step this build no longer has', () => {
    // A stored value the map does not know reads as "never started", which is
    // the only safe reading: a removed step must not leave every player who
    // stopped on it looking at nothing.
    expect(resumeStep(mapPlayerPreferences({ onboarding: { step: 'favourite-colour' } }))).toBe(
      'competitions',
    )
  })

  it('recognises exactly the steps it knows about', () => {
    expect(isOnboardingStep('games')).toBe(true)
    expect(isOnboardingStep('nonsense')).toBe(false)
    expect(isOnboardingStep(null)).toBe(false)
  })
})

describe('draftFromPreferences', () => {
  it('carries every stored follow and its favourite club back into the draft', () => {
    const preferences = mapPlayerPreferences({
      follows: [
        { tournament_id: 'season-epl', favourite_team_id: 'team-arsenal' },
        { tournament_id: 'season-spfl', favourite_team_id: null },
      ],
    })

    const draft = draftFromPreferences(preferences, CATALOGUE)

    expect(draft.followed).toEqual([
      'Premier League 2026/27',
      'Scottish Premiership 2026/27',
    ])
    expect(draft.favourites['Premier League 2026/27']).toBe('team-arsenal')
    expect(draft.favourites['Scottish Premiership 2026/27']).toBeNull()
  })

  it('resumes no game choices, because a joined game is a server fact and not a pending one', () => {
    const draft = draftFromPreferences(
      mapPlayerPreferences({ follows: [{ tournament_id: 'season-epl' }] }),
      CATALOGUE,
    )

    expect(draft.games).toEqual({})
  })

  it('drops a follow the catalogue no longer carries, and deletes nothing', () => {
    const preferences = mapPlayerPreferences({
      follows: [
        { tournament_id: 'season-epl' },
        { tournament_id: 'season-retired-league' },
      ],
    })

    const draft = draftFromPreferences(preferences, CATALOGUE)

    // Not offered, because it is not on screen. Still stored: nothing here
    // writes, so the preference survives the season being unpublished.
    expect(draft.followed).toEqual(['Premier League 2026/27'])
    expect(preferences.follows).toHaveLength(2)
  })

  it('produces the empty draft when preferences could not be read', () => {
    expect(draftFromPreferences(null, CATALOGUE)).toEqual(EMPTY_DRAFT)
  })
})

describe('step order', () => {
  it('moves forward and back through the declared sequence, and stops at both ends', () => {
    expect(previousStep('competitions')).toBeNull()
    expect(nextStep('competitions')).toBe('clubs')
    expect(nextStep('clubs')).toBe('games')
    expect(nextStep('games')).toBe('review')
    expect(nextStep('review')).toBeNull()
    expect(previousStep('review')).toBe('games')
  })
})
