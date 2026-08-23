import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildGamesModel } from '../../src/vnext/integration/games/buildGamesModel'
import type { GamesSource } from '../../src/vnext/integration/games/gamesSource'
import { buildShellModel } from '../../src/vnext/integration/shell/buildShellModel'
import { presentCompetitionWeek } from '../../src/features/hub/competitionWeekModel'
import type { CompetitionWeek } from '../../src/features/hub/competitionWeekModel'
import type { LmsRoundPage } from '../../src/features/season/lmsRoundModel'
import type { MatchPredictorPage } from '../../src/features/season/matchPredictorModel'
import type { ChampionshipPlayerView } from '../../src/services/supabase/seasonCupPlayer'
import type { SeasonGames } from '../../src/services/supabase/competitionGamesModel'
import { VNextGames } from '../../src/vnext/games/VNextGames'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'

/**
 * GAMES IS ACTION-LED WHERE A GAME IS ASKING, AND A DESTINATION WHERE IT IS NOT.
 *
 * `DFA-006` in its own words: each card's primary control is "the action itself
 * where the game is asking for one — 'Pick your club' rather than 'Open game'"
 * — and stays a destination where it is not, "so a complete game is not dressed
 * as a task". The shipped surface said `Open` and `Look inside` for every row
 * in every state, because the catalogue read it was built on knows membership
 * and registration and nothing whatever about the week.
 *
 * THE CATALOGUE IS NEVER ASKED TO KNOW THE WEEK. Every case below supplies the
 * catalogue and the week SEPARATELY, which is the boundary the fix depends on:
 * `get_competition_games` says who is in what, each game's own read says what it
 * wants, and `presentCompetitionWeek` is the only thing that turns the second
 * into an action.
 */

const NOW = '2027-08-21T12:00:00.000Z'
const LMS_LOCK = '2027-08-21T13:30:00.000Z'
const MP_LOCK = '2027-08-21T14:00:00.000Z'

function card(entered: number, total: number): MatchPredictorPage {
  return {
    matchweek: { number: 5, of: 38 },
    lock: { locked: false, lockAt: MP_LOCK },
    joker: { playedHere: false, available: false },
    fixtures: Array.from({ length: total }, (_, index) => ({
      id: `mp-${index}`,
      prediction: index < entered ? { home: 1, away: 0 } : null,
    })),
  } as unknown as MatchPredictorPage
}

function lmsRound(picked: boolean, eliminated = false): LmsRoundPage {
  return {
    available: true,
    entered: true,
    entryOutcome: eliminated ? 'eliminated' : 'alive',
    pick: picked ? { teamId: 'club-1' } : null,
    round: {
      windowId: 'w-5',
      sequence: 5,
      label: 'Round 5',
      opensAt: null,
      locksAt: LMS_LOCK,
    },
    fixtures: [],
    pickOutcome: null,
  } as unknown as LmsRoundPage
}

function championship(): ChampionshipPlayerView {
  return {
    competitionId: 'cup-1',
    entered: true,
    phaseReady: true,
    visibility: null,
    availabilityStatus: null,
    phaseKind: null,
    group: null,
    members: [],
    table: [],
    fixtures: [
      {
        fixtureId: 'cup-fx-1',
        windowSequence: 3,
        windowLabel: 'Matchday 3',
        opensAt: null,
        locksAt: MP_LOCK,
        matchday: 3,
        isMyFixture: true,
        isHome: true,
        status: 'pending',
        home: { displayName: 'Aisha Kaur' },
        away: { displayName: 'Rowan Adeyemi' },
        homePoints: null,
        awayPoints: null,
        result: null,
      },
    ],
  } as unknown as ChampionshipPlayerView
}

/** The catalogue: three games, all actively joined. */
function catalogue(): SeasonGames {
  return {
    competitionMember: true,
    serverNow: NOW,
    games: [
      {
        id: 'g-mp',
        gameKey: 'main_predictor',
        active: true,
        displayName: 'Match Predictor',
        registrationOpensAt: null,
        registrationClosesAt: null,
        completedAt: null,
        allowRejoin: true,
        membership: { status: 'active' },
      },
      {
        id: 'g-lms',
        gameKey: 'last_man_standing',
        active: true,
        displayName: 'Last Man Standing',
        registrationOpensAt: null,
        registrationClosesAt: null,
        completedAt: null,
        allowRejoin: true,
        membership: { status: 'active' },
      },
      {
        id: 'g-cup',
        gameKey: 'predictor_cup',
        active: true,
        displayName: 'Predictor Championship',
        registrationOpensAt: null,
        registrationClosesAt: null,
        completedAt: null,
        allowRejoin: true,
        membership: { status: 'active' },
      },
    ],
  } as unknown as SeasonGames
}

function week(input: {
  matchPredictor?: MatchPredictorPage | null
  lms?: LmsRoundPage | null
  championship?: ChampionshipPlayerView | null
}): CompetitionWeek {
  return presentCompetitionWeek({
    matchPredictor: input.matchPredictor ? { page: input.matchPredictor, href: null } : null,
    lms: input.lms ? { page: input.lms, href: null } : null,
    championship: input.championship ? { view: input.championship, href: null } : null,
    now: new Date(NOW),
  })
}

function source(week: CompetitionWeek | null): GamesSource {
  return {
    generatedAt: NOW,
    context: {
      tournamentId: 't-1',
      competitionName: 'Test League',
      seasonLabel: '2027/28',
    },
    games: { kind: 'ok', games: catalogue() },
    week,
  } as unknown as GamesSource
}

/**
 * Rows are addressed by the catalogue id the surface stamps on them, not by
 * their visible name: every button also carries the game name in an `srOnly`
 * span for its accessible name, so a text lookup matches three nodes per row.
 */
function rowFor(gameId: string) {
  const row = document.querySelector(`[data-vnext-game="${gameId}"]`)
  if (row === null) throw new Error(`no row for ${gameId}`)
  return row as HTMLElement
}

function renderGames(week: CompetitionWeek | null) {
  const model = buildGamesModel(source(week))
  return render(
    <VNextRoot>
      <VNextGames model={model} />
    </VNextRoot>,
  )
}

describe('a game that is asking', () => {
  it('leads with the action rather than the destination', () => {
    renderGames(week({ matchPredictor: card(0, 10), lms: lmsRound(false) }))

    expect(
      within(rowFor('g-lms')).getByRole('button', { name: /Pick your club/ }),
    ).toBeInTheDocument()
    expect(
      within(rowFor('g-mp')).getByRole('button', { name: /Predict this matchweek/ }),
    ).toBeInTheDocument()
  })

  it('prints the game’s own sentence, not one composed here', () => {
    renderGames(week({ matchPredictor: card(3, 10), lms: lmsRound(false) }))

    expect(rowFor('g-lms')).toHaveTextContent(
      'Last Man Standing: pick a club for Round 5',
    )
    expect(rowFor('g-mp')).toHaveTextContent('Matchweek 5: 7 of 10 still to predict')
  })
})

describe('a game that is not asking', () => {
  it('stays a destination once the pick is in', () => {
    renderGames(week({ matchPredictor: card(10, 10), lms: lmsRound(true) }))

    const row = rowFor('g-lms')
    expect(within(row).queryByRole('button', { name: /Pick your club/ })).toBeNull()
    expect(within(row).getByRole('button', { name: /Open/ })).toBeInTheDocument()
  })

  it('never dresses an eliminated entry as a task', () => {
    renderGames(week({ matchPredictor: card(10, 10), lms: lmsRound(false, true) }))

    const row = rowFor('g-lms')
    expect(row).toHaveTextContent('Last Man Standing: you are out')
    expect(within(row).queryByRole('button', { name: /Pick your club/ })).toBeNull()
  })

  it('never gives the Championship a prediction verb', () => {
    renderGames(week({ matchPredictor: card(0, 10), championship: championship() }))

    const row = rowFor('g-cup')
    // It reports its matchup and offers a destination. It is won by Match
    // Predictor points the player is already being told to earn.
    expect(row).toHaveTextContent('Championship: Matchday 3 against Rowan Adeyemi')
    const control = within(row).getByRole('button', { name: /Open/ })
    // The row is not asking, so the control keeps the destination verb. Matching
    // on /Predict/ would be met by the game's own NAME in the accessible label.
    expect(control).toHaveAttribute('data-asking', 'false')
    expect(within(row).queryByRole('button', { name: /Predict this matchweek/ })).toBeNull()
  })

  it('falls back to the destination wording when no week could be read', () => {
    renderGames(null)

    expect(within(rowFor('g-lms')).getByRole('button', { name: /Open/ })).toBeInTheDocument()
    expect(screen.queryByText(/pick a club/i)).toBeNull()
  })
})

describe('the Games badge', () => {
  const badgeFor = (week: CompetitionWeek | null) =>
    buildShellModel({
      competition: {
        tournamentId: 't-1',
        name: 'Test League',
        seasonLabel: '2027/28',
        colours: null,
      },
      playerName: 'Aisha',
      outstandingGames:
        week === null ? null : week.actions.filter((action) => action.outstanding).length,
      canNavigateAway: true,
      elsewhere: null,
    } as never).destinations.find((entry) => entry.id === 'games')?.badge

  it('counts GAMES that are asking, not fixtures in one of them', () => {
    // Seven scorelines missing in ONE game, plus an unmade pick in another.
    // The old badge said 7 beside the word "Games".
    expect(badgeFor(week({ matchPredictor: card(3, 10), lms: lmsRound(false) }))).toBe(2)
  })

  it('never counts the Championship, which is never outstanding', () => {
    expect(
      badgeFor(week({ matchPredictor: card(3, 10), championship: championship() })),
    ).toBe(1)
  })

  it('renders nothing when every game is settled', () => {
    expect(badgeFor(week({ matchPredictor: card(10, 10), lms: lmsRound(true) }))).toBeUndefined()
  })

  it('is absent rather than zero where the page cannot say', () => {
    // `null` into the source and `undefined` out of the model are the same
    // answer: no badge. What must never happen is a confident `0`.
    expect(badgeFor(null)).toBeUndefined()
  })
})
