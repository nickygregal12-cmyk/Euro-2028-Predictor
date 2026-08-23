import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from './vnextAxe'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { VNextCreateScreen } from '../../src/vnext/integration/create/VNextCreateScreen'
import type { CreateWrites } from '../../src/vnext/integration/create/VNextCreateScreen'
import { shellScenarios } from '../../src/vnext/fixtures'
import type { PlayerCompetitions } from '../../src/features/hub/playerCompetitions'

/**
 * THE CREATE CORRIDOR, END TO END, WITHOUT A NETWORK.
 *
 * The properties worth protecting are the ones a corridor gets wrong quietly:
 *
 *   1. THE RIGHT FUNCTION FOR THE RIGHT CONTAINER. A private Match Predictor
 *      league is created against a `game_competition_id`; a private Last Man
 *      Standing or Championship against a SEASON. Sending one to the other's
 *      creator produces a league on an id the function cannot use, or a
 *      competition nobody chose — and both look like a server error.
 *   2. THE THREE GAMES STAY PEERS. A game that cannot be created keeps its row
 *      and carries its reason, rather than disappearing and leaving a player to
 *      conclude the product does not have it.
 *   3. A CHAMPIONSHIP IS NOT LAUNCHED HERE. It is created and handed over with
 *      an invite; the draw is a separate, irreversible decision.
 *   4. NOTHING IS RE-VALIDATED. A refusal is the server's sentence, printed.
 */

const player = {
  mine: [
    {
      tournamentId: 'season-1',
      competition: {
        seasonRowName: 'caledonian-2027-28',
        name: 'Caledonian Premiership',
        seasonLabel: '2027/28',
      },
      games: [
        { gameKey: 'main_predictor', id: 'game-competition-mp', membership: { status: 'active' } },
      ],
    },
  ],
  catalogue: [
    {
      seasonRowName: 'caledonian-2027-28',
      tournamentId: 'season-1',
      name: 'Caledonian Premiership',
      seasonLabel: '2027/28',
      status: 'live',
      games: [],
    },
  ],
} as unknown as PlayerCompetitions

function writes(over: Partial<CreateWrites> = {}): CreateWrites {
  return {
    createLeague: vi.fn(async (id: string, name: string) => ({
      id: 'lg-1',
      name,
      inviteCode: `LEAGUE-${id}`,
    })),
    createLms: vi.fn(async (id: string, name: string) => ({
      competitionId: 'comp-1',
      name,
      inviteCode: `LMS-${id}`,
    })),
    createCup: vi.fn(async (id: string, name: string) => ({
      competitionId: 'comp-2',
      name,
      inviteCode: `CUP-${id}`,
    })),
    ...over,
  }
}

function renderCorridor(
  props: Partial<React.ComponentProps<typeof VNextCreateScreen>> = {},
) {
  const perform = (props.writes as CreateWrites | undefined) ?? writes()
  const view = render(
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <VNextCreateScreen
        userId="account-1"
        authLoading={false}
        player={player}
        loading={false}
        failed={false}
        {...props}
        writes={perform}
      />
    </VNextShellProvider>,
  )
  return { ...view, perform }
}

/**
 * SCOPED TO THE CHOICE, because the shell above draws the player's games too
 * and the Championship's own sentence contains the words "Match Predictor
 * points". An unscoped role query matches three things and would have started
 * failing for a reason that had nothing to do with the corridor.
 */
function chooseGame(game: string) {
  const zone = within(
    document.querySelector('[data-vnext-zone="choose-game"]') as HTMLElement,
  )
  fireEvent.click(zone.getByRole('button', { name: new RegExp(`^${game}`) }))
}

function chooseAndName(game: string, name: string) {
  chooseGame(game)
  fireEvent.change(screen.getByRole('textbox', { name: /what is it called/i }), {
    target: { value: name },
  })
}

describe('the create corridor offers all three games as peers', () => {
  it('draws a row for every game, including the ones it cannot create', () => {
    renderCorridor({
      // Nothing joined and nothing published: every game refuses, and every
      // game still has to say so.
      player: { mine: [], catalogue: [] } as unknown as PlayerCompetitions,
    })

    for (const name of ['Match Predictor', 'Last Man Standing', 'Predictor Championship']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    expect(screen.getByText(/Join Match Predictor in a competition first/)).toBeInTheDocument()
  })

  it('offers no control for a game that cannot be created', () => {
    renderCorridor({
      player: { mine: [], catalogue: [] } as unknown as PlayerCompetitions,
    })
    // A CONTROL THAT EXISTS AND REFUSES teaches a player the product is broken.
    const zone = within(
      document.querySelector('[data-vnext-zone="choose-game"]') as HTMLElement,
    )
    expect(zone.queryByRole('button', { name: /^Match Predictor/ })).toBeNull()
  })
})

describe('each container is created by the function its own shape requires', () => {
  it('creates a private league against the game membership', async () => {
    const { perform } = renderCorridor()

    chooseAndName('Match Predictor', 'The Sunday Club')
    fireEvent.click(screen.getByRole('button', { name: 'Create it' }))

    await waitFor(() =>
      expect(perform.createLeague).toHaveBeenCalledWith(
        'game-competition-mp',
        'The Sunday Club',
      ),
    )
    expect(perform.createLms).not.toHaveBeenCalled()
    expect(perform.createCup).not.toHaveBeenCalled()
  })

  it('creates a private Last Man Standing against the SEASON, with its rules', async () => {
    const { perform } = renderCorridor()

    chooseAndName('Last Man Standing', 'Survivors')
    fireEvent.click(screen.getByRole('button', { name: 'A draw keeps you in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create it' }))

    await waitFor(() => expect(perform.createLms).toHaveBeenCalled())
    const call = (perform.createLms as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call?.[0]).toBe('season-1')
    expect(call?.[1]).toBe('Survivors')
    expect(call?.[2]).toMatchObject({ drawsRule: 'survive' })
    expect(perform.createLeague).not.toHaveBeenCalled()
  })

  it('creates a private Championship against the season and does not launch it', async () => {
    const { perform } = renderCorridor()

    chooseAndName('Predictor Championship', 'Office Cup')
    fireEvent.click(screen.getByRole('button', { name: 'Create it' }))

    await waitFor(() => expect(perform.createCup).toHaveBeenCalledWith('season-1', 'Office Cup'))
    // THE DRAW IS FIXED AT LAUNCH AND LAUNCHING CLOSES REGISTRATION. The
    // corridor hands over an invite and says so; it never launches.
    expect(await screen.findByText(/Nobody is drawn yet/)).toBeInTheDocument()
  })
})

describe('what the organiser is left holding', () => {
  it('shows the invite the server issued', async () => {
    renderCorridor()

    chooseAndName('Match Predictor', 'The Sunday Club')
    fireEvent.click(screen.getByRole('button', { name: 'Create it' }))

    expect(await screen.findByText('LEAGUE-game-competition-mp')).toBeInTheDocument()
    expect(screen.getByText(/The Sunday Club is ready/)).toBeInTheDocument()
  })

  it('reports a refusal in safe copy and keeps the player on the form', async () => {
    // `userFacingError` is the repository's one translator and it never returns
    // a raw database, RPC or network detail — the legacy journey routes its
    // refusals through the same function with its own fallback. What the
    // corridor owes is that the refusal is SHOWN, that it is the operation's
    // own sentence rather than a generic one, and that nothing was navigated
    // away from: a player whose create was refused still has their name typed.
    renderCorridor({
      writes: writes({
        createLeague: vi.fn(async () => {
          throw new Error('duplicate key value violates unique constraint')
        }),
      }),
    })

    chooseAndName('Match Predictor', 'The Sunday Club')
    fireEvent.click(screen.getByRole('button', { name: 'Create it' }))

    const refusal = await screen.findByRole('alert')
    expect(refusal).toHaveTextContent('We could not create that just now.')
    expect(refusal.textContent).not.toContain('unique constraint')
    expect(screen.getByRole('textbox', { name: /what is it called/i })).toHaveValue(
      'The Sunday Club',
    )
  })
})

describe('the other way in', () => {
  it('takes whatever was pasted to the address that owns invite codes', () => {
    const onJoinCode = vi.fn()
    renderCorridor({ onJoinCode })

    const join = within(document.querySelector('[data-vnext-zone="join"]') as HTMLElement)
    fireEvent.change(join.getByRole('textbox'), {
      // PEOPLE PASTE THE LINK as often as they type the code, and a corridor
      // that refused a working invite URL would be refusing the commonest input.
      target: { value: 'https://example.test/join/SUN4KD' },
    })
    fireEvent.click(join.getByRole('button', { name: 'Open it' }))

    expect(onJoinCode).toHaveBeenCalledWith('SUN4KD')
  })

  it('validates nothing about the code itself', () => {
    const onJoinCode = vi.fn()
    renderCorridor({ onJoinCode })

    const join = within(document.querySelector('[data-vnext-zone="join"]') as HTMLElement)
    fireEvent.change(join.getByRole('textbox'), { target: { value: 'nonsense' } })
    fireEvent.click(join.getByRole('button', { name: 'Open it' }))

    // `/join/:code` owns every answer about a code, including the refusals it
    // deliberately makes indistinguishable from each other.
    expect(onJoinCode).toHaveBeenCalledWith('nonsense')
  })
})

describe('accessibility', () => {
  it('has no violations on the game choice', async () => {
    await expectNoAxeViolations(
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextCreateScreen
          userId="account-1"
          authLoading={false}
          player={player}
          loading={false}
          failed={false}
          writes={writes()}
        />
      </VNextShellProvider>,
    )
  })
})
