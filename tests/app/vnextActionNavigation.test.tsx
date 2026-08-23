import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { ReactNode } from 'react'
import { useActionItemNavigation } from '../../src/app/vnext/seam'
import type { PlayerCompetitionsState } from '../../src/app/providers/PlayerCompetitionsProvider'
import type { VNextActionItem } from '../../src/vnext/models/actions'

/**
 * WHERE AN ACTION CENTRE ROW TAKES A PLAYER.
 *
 * The panel can name what needs doing perfectly and still be half a feature if
 * pressing a row goes nowhere — which is what it did when the Action Centre
 * first shipped, because the host was mounted with no `onOpenItem`. These are
 * the rules the wiring came with:
 *
 *   1. A COMPETITION IS NAMED BY IDENTITY AND NAVIGATED BY ADDRESS. The
 *      tournament id is resolved through the player's own membership list, so
 *      an id they hold no membership for navigates NOWHERE rather than being
 *      pasted into a URL that would 404.
 *   2. WORK GOES TO THE GAME. The thing owed is on that game's current round.
 *   3. A SETTLED MATCHWEEK DOES NOT. It carries a round id no route accepts, so
 *      sending it to the Match Predictor would land the player on a DIFFERENT
 *      matchweek from the one the row is about.
 *   4. A ROW WITH NO ROUTABLE GAME GOES NOWHERE, and is drawn as information.
 */

const membership = vi.hoisted(() => ({
  state: null as unknown as PlayerCompetitionsState,
}))

const navigate = vi.hoisted(() => vi.fn())

vi.mock('../../src/app/providers/PlayerCompetitionsProvider', () => ({
  usePlayerCompetitions: () => membership.state,
}))

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return { ...actual, useNavigate: () => navigate }
})

/**
 * A player carrying only what the resolver reads — the same narrow-shape
 * discipline `vnextRootDestination.test.tsx` uses, and for the same reason: a
 * resolver that started reading another field should fail here rather than
 * quietly depend on a fixture nobody meant as a contract.
 */
function playerWith(
  ...mine: readonly { tournamentId: string; competitionSlug: string; seasonSlug: string }[]
): PlayerCompetitionsState['player'] {
  return {
    mine: mine.map(({ tournamentId, ...competition }) => ({
      tournamentId,
      competition: { ...competition, tournamentId },
    })),
  } as unknown as PlayerCompetitionsState['player']
}

const CALEDONIAN = {
  tournamentId: 'tournament-caledonian',
  competitionSlug: 'caledonian-premiership',
  seasonSlug: '2027-28',
}

function item(over: Partial<VNextActionItem> = {}): VNextActionItem {
  return {
    key: 'a',
    kind: 'lms-pick-due',
    actionClass: 'needs-you',
    game: 'last-man-standing',
    contextId: CALEDONIAN.tournamentId,
    competitionId: 'comp-lms',
    competitionName: 'Caledonian Premiership',
    headline: 'Pick your club',
    detail: null,
    deadlineAt: null,
    seen: false,
    ...over,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
}

function openWith(entry: VNextActionItem, player = playerWith(CALEDONIAN)) {
  navigate.mockClear()
  membership.state = { player } as unknown as PlayerCompetitionsState
  const { result } = renderHook(() => useActionItemNavigation(), { wrapper })
  result.current(entry)
  return navigate
}

describe('opening an Action Centre row', () => {
  it('takes a due pick to Last Man Standing in its own competition', () => {
    expect(openWith(item())).toHaveBeenCalledWith(
      '/competitions/caledonian-premiership/2027-28/games/lms',
    )
  })

  it('takes a due card to the Match Predictor', () => {
    expect(
      openWith(item({ kind: 'matchweek-predictions-due', game: 'match-predictor' })),
    ).toHaveBeenCalledWith(
      '/competitions/caledonian-premiership/2027-28/games/match-predictor',
    )
  })

  it('takes a due penalty number to the Championship', () => {
    expect(
      openWith(item({ kind: 'cup-penalty-number-due', game: 'championship' })),
    ).toHaveBeenCalledWith(
      '/competitions/caledonian-premiership/2027-28/games/championship',
    )
  })

  it('takes a settled matchweek to the competition rather than to the open card', () => {
    // THE ROW IS ABOUT MATCHWEEK 11 AND THE GAME ROUTE SHOWS THE CURRENT ONE.
    // No route in this application takes `settled_round_id`, so the recap on
    // the competition's Home is the honest destination — landing a player on
    // Matchweek 13's open card after they pressed "Matchweek 11 is settled"
    // would be the product answering a different question.
    const called = openWith(item({ kind: 'matchweek-settled', game: 'match-predictor' }))
    expect(called).toHaveBeenCalledWith('/competitions/caledonian-premiership/2027-28')
  })

  it('takes a consequence to the game that produced it', () => {
    expect(
      openWith(item({ kind: 'game-consequence', actionClass: 'news', game: 'championship' })),
    ).toHaveBeenCalledWith(
      '/competitions/caledonian-premiership/2027-28/games/championship',
    )
  })

  it('goes nowhere for a row with no routable game', () => {
    // A `game_key` with no vNext surface, or a kind this build cannot read.
    expect(openWith(item({ kind: 'game-consequence', game: null }))).not.toHaveBeenCalled()
    expect(openWith(item({ kind: 'unknown', game: null }))).not.toHaveBeenCalled()
  })

  it('goes nowhere for a competition the player holds no membership for', () => {
    // NOT a guessed URL. The tournament id is an identity and the membership
    // list is the only thing that turns it into an address; without a row there
    // is no address, and inventing one produces a 404 with the player's own
    // action attached to it.
    const called = openWith(item({ contextId: 'tournament-nowhere' }))
    expect(called).not.toHaveBeenCalled()
  })

  it('goes nowhere when the player list has not loaded', () => {
    membership.state = { player: null } as unknown as PlayerCompetitionsState
    navigate.mockClear()
    const { result } = renderHook(() => useActionItemNavigation(), { wrapper })
    result.current(item())
    expect(navigate).not.toHaveBeenCalled()
  })
})
