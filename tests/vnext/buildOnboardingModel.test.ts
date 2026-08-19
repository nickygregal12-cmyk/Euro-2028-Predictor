import { describe, expect, it } from 'vitest'
import { buildOnboardingModel } from '../../src/vnext/integration/onboarding/buildOnboardingModel'
import type { OnboardingSource } from '../../src/vnext/integration/onboarding/buildOnboardingModel'
import { EMPTY_DRAFT, setFavourite, toggleFollowed, toggleGame } from '../../src/features/onboarding/onboardingDraft'
import { ONBOARDING_STEPS } from '../../src/features/onboarding/onboardingResume'
import { ONBOARDING_STEP_ORDER } from '../../src/vnext/models/onboarding'
import type { HubCompetition, HubGame } from '../../src/features/hub/competitionCatalogue'
import type { SeasonClub } from '../../src/services/supabase/seasonClubs'

/**
 * `OnboardingSource` → `OnboardingView`, TESTED WHERE THE STAGE'S CLAIMS BITE.
 *
 *   1. THE STEP LIST IS PINNED TO THE AUTHORITY. The model restates it because
 *      the production boundary forbids a vNext model from importing
 *      `src/features`; this test is the thing that stops the two drifting.
 *   2. FOLLOWING ENTERS NOTHING. Following a competition must add no game to
 *      the draft — the scalability contract's separation, enforced by
 *      `onboardingDraft` and asserted here through the surface it produces.
 *   3. AN ALREADY-JOINED GAME IS NEVER SOMETHING FINISH WILL DO.
 *   4. A CLUB IS NAMED FROM THE READ THAT OFFERED IT, OR NOT NAMED.
 *   5. NOT-READ AND READ-AND-EMPTY ARE DIFFERENT on the club step.
 */

const NOW = '2027-06-01T12:00:00.000Z'

function predictor(over: Partial<HubGame> = {}): HubGame {
  return {
    kind: 'league-predictor',
    gameKey: 'main_predictor',
    name: 'Match Predictor',
    description: 'Predict every score.',
    joined: false,
    status: 'available',
    ...over,
  }
}

function club(teamId: string, name: string): SeasonClub {
  return {
    teamId,
    name,
    tokens: { monogram: name.slice(0, 3).toUpperCase(), primary: '#123456' },
    identityResolved: true,
  }
}

function competition(over: Partial<HubCompetition> = {}): HubCompetition {
  return {
    competitionSlug: 'caledonian',
    seasonSlug: '2027-28',
    seasonRowName: 'Caledonian Premiership 2027/28',
    tournamentId: 't-1',
    name: 'Caledonian Premiership',
    seasonLabel: '2027/28',
    status: 'live',
    summary: 'Twelve clubs.',
    games: [predictor()],
    ...over,
  }
}

function source(over: Partial<OnboardingSource> = {}): OnboardingSource {
  return {
    catalogue: [competition()],
    draft: EMPTY_DRAFT,
    step: 'competitions',
    clubs: {},
    entry: { 'Caledonian Premiership 2027/28': { main_predictor: 'open' } },
    displayName: 'Ada',
    commit: { kind: 'idle' },
    generatedAt: NOW,
    ...over,
  }
}

function ready(view: ReturnType<typeof buildOnboardingModel>) {
  if (view.kind !== 'ready') throw new Error(`expected ready, got ${view.kind}`)
  return view.model
}

describe('the step list agrees with the authority that owns it', () => {
  it('restates ONBOARDING_STEPS exactly, in order', () => {
    expect([...ONBOARDING_STEP_ORDER]).toEqual([...ONBOARDING_STEPS])
  })

  it('counts the steps from that list rather than from a literal', () => {
    const model = ready(buildOnboardingModel(source()))
    expect(model.total).toBe(ONBOARDING_STEPS.length)
    expect(model.position).toBe(1)
    expect(model.back).toBe(false)
    expect(model.isLast).toBe(false)
  })

  it('marks only the last step as the one that commits', () => {
    const last = ready(buildOnboardingModel(source({ step: 'review' })))
    expect(last.isLast).toBe(true)
    expect(last.back).toBe(true)
    expect(last.position).toBe(ONBOARDING_STEPS.length)
  })
})

describe('the reads that did not answer', () => {
  it('is loading before the catalogue arrives', () => {
    expect(buildOnboardingModel(source({ catalogue: null })).kind).toBe('loading')
  })

  it('is unavailable when the catalogue failed, and does not blame the account', () => {
    const view = buildOnboardingModel(source({ catalogue: 'failed' }))
    if (view.kind !== 'unavailable') throw new Error('expected unavailable')
    expect(view.message).toMatch(/your account is fine/i)
  })
})

describe('following is not entering', () => {
  it('adds no game to the draft when a competition is followed', () => {
    const followed = toggleFollowed(EMPTY_DRAFT, 'Caledonian Premiership 2027/28')
    const model = ready(buildOnboardingModel(source({ draft: followed, step: 'games' })))
    if (model.panel.step !== 'games') throw new Error('expected the games step')
    expect(model.panel.offers[0]?.games.every((game) => !game.chosen)).toBe(true)
  })

  it('says so on the step where it is misread', () => {
    const model = ready(buildOnboardingModel(source()))
    if (model.panel.step !== 'competitions') throw new Error('expected the first step')
    expect(model.panel.note).toMatch(/does not enter you/i)
  })

  it('offers games only for competitions actually followed', () => {
    const model = ready(buildOnboardingModel(source({ step: 'games' })))
    if (model.panel.step !== 'games') throw new Error('expected the games step')
    expect(model.panel.offers).toEqual([])
  })
})

describe('what Finish will actually do', () => {
  const key = 'Caledonian Premiership 2027/28'

  it('lists a chosen game, and never one already joined', () => {
    const joined = competition({ games: [predictor({ joined: true, status: 'joined' })] })

    // The player somehow holds a draft entry for a game they already have —
    // which the surface cannot produce, because a joined game has no control.
    // The review must still refuse to claim Finish is about to join it.
    const draft = toggleGame(toggleFollowed(EMPTY_DRAFT, key), key, 'main_predictor')
    const model = ready(
      buildOnboardingModel(source({ catalogue: [joined], draft, step: 'review' })),
    )
    if (model.panel.step !== 'review') throw new Error('expected the review')
    expect(model.panel.summary.games).toEqual([])
    expect(model.panel.summary.follows).toEqual(['Caledonian Premiership'])
  })

  it('names a chosen club from the list that offered it', () => {
    const draft = setFavourite(toggleFollowed(EMPTY_DRAFT, key), key, 'club-1')
    const model = ready(
      buildOnboardingModel(
        source({
          draft,
          step: 'review',
          clubs: { [key]: [club('club-1', 'Ardrossan Athletic')] },
        }),
      ),
    )
    if (model.panel.step !== 'review') throw new Error('expected the review')
    expect(model.panel.summary.clubs).toEqual([
      { competition: 'Caledonian Premiership', club: 'Ardrossan Athletic' },
    ])
  })

  it('never prints a team id at a player when the name is not in hand', () => {
    const draft = setFavourite(toggleFollowed(EMPTY_DRAFT, key), key, 'club-1')
    const model = ready(buildOnboardingModel(source({ draft, step: 'review' })))
    if (model.panel.step !== 'review') throw new Error('expected the review')
    expect(model.panel.summary.clubs[0]?.club).not.toContain('club-1')
    expect(model.panel.summary.clubs[0]?.club).toBe('The club you chose')
  })

  it('calls choosing nothing empty rather than a page with three blank lists', () => {
    const model = ready(buildOnboardingModel(source({ step: 'review' })))
    if (model.panel.step !== 'review') throw new Error('expected the review')
    expect(model.panel.summary.empty).toBe(true)
  })
})

describe('the club step distinguishes not-read from read-and-none', () => {
  const key = 'Caledonian Premiership 2027/28'
  const followed = toggleFollowed(EMPTY_DRAFT, key)

  it('carries null where the clubs have not been read', () => {
    const model = ready(buildOnboardingModel(source({ draft: followed, step: 'clubs' })))
    if (model.panel.step !== 'clubs') throw new Error('expected the club step')
    expect(model.panel.groups[0]?.clubs).toBeNull()
  })

  it('carries an empty list where they were read and there were none', () => {
    const model = ready(
      buildOnboardingModel(source({ draft: followed, step: 'clubs', clubs: { [key]: [] } })),
    )
    if (model.panel.step !== 'clubs') throw new Error('expected the club step')
    expect(model.panel.groups[0]?.clubs).toEqual([])
  })
})

describe('the greeting', () => {
  it('uses a name when there is one', () => {
    expect(ready(buildOnboardingModel(source())).greeting).toBe('Welcome, Ada')
  })

  it('does not invent one when there is not', () => {
    expect(ready(buildOnboardingModel(source({ displayName: null }))).greeting).toBe('Welcome')
    expect(ready(buildOnboardingModel(source({ displayName: '' }))).greeting).toBe('Welcome')
  })
})
