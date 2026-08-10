import { describe, expect, it } from 'vitest'
import {
  EMPTY_DRAFT,
  applyGamesToAll,
  competitionsWithoutGames,
  gamesFor,
  setFavourite,
  toggleFollowed,
  toggleGame,
  totalGameChoices,
} from '../../../src/features/onboarding/onboardingDraft'

/**
 * The onboarding draft, and the separation it exists to enforce.
 *
 * `Follow ≠ Join game ≠ Favourite` is non-negotiable, and a comment saying so
 * does not fail. These assertions make it a property of the model: selecting a
 * competition adds no game, choosing a favourite touches neither, and bulk
 * application is predictable rather than a union nobody chose.
 */

describe('following a competition joins nothing', () => {
  it('adds no game when a competition is followed', () => {
    const draft = toggleFollowed(EMPTY_DRAFT, 'Premier League 2026/27')
    expect(draft.followed).toEqual(['Premier League 2026/27'])
    expect(totalGameChoices(draft)).toBe(0)
    expect(gamesFor(draft, 'Premier League 2026/27')).toEqual([])
  })

  it('keeps game choices when a competition is unfollowed, and returns them with it', () => {
    // Unfollowing is not a decision about which games the player wanted, and
    // re-following should not cost them the choice again.
    let draft = toggleFollowed(EMPTY_DRAFT, 'A')
    draft = toggleGame(draft, 'A', 'main_predictor')
    draft = toggleFollowed(draft, 'A')

    expect(draft.followed).toEqual([])
    // Not reported while unfollowed — nothing is submitted for it...
    expect(gamesFor(draft, 'A')).toEqual([])
    // ...but not thrown away either.
    draft = toggleFollowed(draft, 'A')
    expect(gamesFor(draft, 'A')).toEqual(['main_predictor'])
  })

  it('leaves the favourite untouched by every competition and game choice', () => {
    let draft = setFavourite(EMPTY_DRAFT, 'team-celtic')
    draft = toggleFollowed(draft, 'A')
    draft = toggleGame(draft, 'A', 'last_man_standing')
    expect(draft.favouriteTeamId).toBe('team-celtic')

    // And choosing a favourite follows nothing and joins nothing.
    const only = setFavourite(EMPTY_DRAFT, 'team-rangers')
    expect(only.followed).toEqual([])
    expect(totalGameChoices(only)).toBe(0)
  })

  it('clears the favourite explicitly, because the step is optional', () => {
    expect(setFavourite(setFavourite(EMPTY_DRAFT, 't'), null).favouriteTeamId).toBeNull()
  })
})

describe('choosing games', () => {
  it('toggles one game in one competition without touching another', () => {
    let draft = toggleFollowed(toggleFollowed(EMPTY_DRAFT, 'A'), 'B')
    draft = toggleGame(draft, 'A', 'main_predictor')
    expect(gamesFor(draft, 'A')).toEqual(['main_predictor'])
    expect(gamesFor(draft, 'B')).toEqual([])

    draft = toggleGame(draft, 'A', 'main_predictor')
    expect(gamesFor(draft, 'A')).toEqual([])
  })

  it('applies a bulk choice by REPLACING, so the result is predictable', () => {
    // Merging would make the control's effect depend on what was already picked
    // elsewhere: press it twice with different selections and the outcome is a
    // union nobody chose.
    let draft = toggleFollowed(toggleFollowed(EMPTY_DRAFT, 'A'), 'B')
    draft = toggleGame(draft, 'A', 'predictor_cup')
    draft = applyGamesToAll(draft, ['main_predictor'])

    expect(gamesFor(draft, 'A')).toEqual(['main_predictor'])
    expect(gamesFor(draft, 'B')).toEqual(['main_predictor'])
  })

  it('applies bulk only to competitions actually followed', () => {
    let draft = toggleFollowed(EMPTY_DRAFT, 'A')
    draft = applyGamesToAll(draft, ['main_predictor', 'last_man_standing'])
    expect(gamesFor(draft, 'A')).toHaveLength(2)
    expect(gamesFor(draft, 'B')).toEqual([])
  })

  it('reports following without playing as a fact rather than an error', () => {
    let draft = toggleFollowed(toggleFollowed(EMPTY_DRAFT, 'A'), 'B')
    draft = toggleGame(draft, 'A', 'main_predictor')
    // Following without joining is a legitimate outcome and the whole reason
    // the two are separate.
    expect(competitionsWithoutGames(draft)).toEqual(['B'])
  })

  it('counts choices across every followed competition', () => {
    let draft = toggleFollowed(toggleFollowed(EMPTY_DRAFT, 'A'), 'B')
    draft = applyGamesToAll(draft, ['main_predictor', 'predictor_cup'])
    expect(totalGameChoices(draft)).toBe(4)
  })
})

describe('the draft never mutates', () => {
  it('returns a new object from every operation', () => {
    const first = toggleFollowed(EMPTY_DRAFT, 'A')
    expect(EMPTY_DRAFT.followed).toEqual([])
    expect(first).not.toBe(EMPTY_DRAFT)
    expect(toggleGame(first, 'A', 'main_predictor')).not.toBe(first)
    expect(setFavourite(first, 't')).not.toBe(first)
  })
})
