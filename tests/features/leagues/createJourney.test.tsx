import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  CreatePrivateJourney,
  type CreatePrivateJourneyProps,
} from '../../../src/features/leagues/CreatePrivateJourney'
import { presentCreateJourney } from '../../../src/features/leagues/createJourneyModel'
import { twentyCompetitionPlayer } from '../../../src/dev/scaleFixture'

/**
 * Creating private play, in all three weekly games.
 *
 * WHAT THESE ASSERTIONS USED TO PROTECT. That nothing was offered which
 * `create_game_league` would refuse — which, before contracts 153 and 154, meant
 * Match Predictor and two explanations. Both explanations have gone, because
 * both games now have a private container the server will create.
 *
 * WHAT THEY PROTECT NOW.
 *
 *   1. The two container SHAPES stay apart. A Match Predictor league is created
 *      against a `game_competition_id` in a competition the player already
 *      plays; a Last Man Standing or Championship is created against a SEASON,
 *      with no prerequisite, because joining the container is the entry.
 *   2. Only the selected game's fields are shown, and the Last Man Standing
 *      rules are offered as the server's ranges rather than re-validated.
 *   3. A Championship is created and then LAUNCHED, and the interface says
 *      which is which — the draw cannot be undone.
 *   4. The browser still adds no rule beyond having something to submit.
 */

const PLAYER = twentyCompetitionPlayer()

function createdLeague() {
  return vi.fn(async () => ({ id: 'lg-1', name: 'The Office', inviteCode: 'ABC234DEF567' }))
}

function createdLms(outcome: 'opened' | 'no_schedulable_round' = 'opened') {
  return vi.fn(async () => ({
    competitionId: 'lms-1',
    name: 'Sunday Survivors',
    inviteCode: 'LMS234DEF567',
    windows: outcome === 'opened' ? 3 : 0,
    outcome,
    launched: false,
  }))
}

function createdCup() {
  return vi.fn(async () => ({
    competitionId: 'cup-1',
    name: 'Office Cup',
    inviteCode: 'CUP234DEF567',
    windows: 0,
    outcome: 'created' as const,
    launched: false,
  }))
}

function renderJourney(overrides: Partial<CreatePrivateJourneyProps> = {}) {
  const props: CreatePrivateJourneyProps = {
    journey: presentCreateJourney(PLAYER),
    createLeague: createdLeague(),
    createLms: createdLms(),
    createCup: createdCup(),
    launchCup: vi.fn(async () => ({
      outcome: 'launched' as const,
      entrants: 8,
      leagueRounds: 14,
      fixtures: 56,
    })),
    onCancel: () => {},
    ...overrides,
  }
  render(<CreatePrivateJourney {...props} />)
  return props
}

describe('what is offered', () => {
  it('offers all three games, each against the host its server call takes', () => {
    const journey = presentCreateJourney(PLAYER)

    const predictor = journey.games.find((game) => game.gameKey === 'main_predictor')
    expect(predictor?.refusal).toBeNull()
    expect(predictor?.setup).toBe('league')
    // A league is created against a game the player is IN, so every host names
    // one.
    expect(predictor?.hosts.every((host) => host.gameCompetitionId !== null)).toBe(true)

    for (const key of ['last_man_standing', 'predictor_cup'] as const) {
      const game = journey.games.find((entry) => entry.gameKey === key)
      expect(game?.refusal).toBeNull()
      expect(game?.hosts.length).toBeGreaterThan(0)
      // A season container is created against a SEASON. Carrying a
      // `game_competition_id` here would be the wrong id for the call.
      expect(game?.hosts.every((host) => host.gameCompetitionId === null)).toBe(true)
      expect(game?.hosts.every((host) => host.tournamentId.length > 0)).toBe(true)
    }
    expect(journey.blocked).toBe(false)
  })

  it('refuses every game when there is nothing published and nothing joined', () => {
    const journey = presentCreateJourney(null)

    expect(journey.games.every((game) => game.refusal !== null)).toBe(true)
    expect(journey.blocked).toBe(true)
    // And says what to do about it rather than reporting an error.
    expect(journey.games[0]?.refusal).toMatch(/Join Match Predictor in a competition first/)
  })

  it('offers a Last Man Standing in a competition the player plays nothing in', () => {
    // The point of a separate shape: entering the container IS the entry, so
    // there is no prerequisite membership to hold.
    const journey = presentCreateJourney(PLAYER)
    const lms = journey.games.find((game) => game.gameKey === 'last_man_standing')
    const predictor = journey.games.find((game) => game.gameKey === 'main_predictor')

    expect(lms!.hosts.length).toBeGreaterThan(predictor!.hosts.length)
  })

  it('gives every game a control, with no refusal screens left', () => {
    renderJourney()

    expect(screen.getByRole('button', { name: /^Match Predictor/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Last Man Standing/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Predictor Championship/ })).toBeInTheDocument()
    expect(screen.queryByText(/no private version of this game to create/i)).toBeNull()
  })
})

describe('a private Match Predictor league', () => {
  it('goes choose game → set up → review → create and share', async () => {
    const props = renderJourney()

    fireEvent.click(screen.getByRole('button', { name: /^Match Predictor/ }))

    const which = screen.getByRole('group', { name: 'Which competition' })
    fireEvent.click(within(which).getByRole('button', { name: /Premier League/ }))
    fireEvent.change(screen.getByLabelText('League name'), { target: { value: 'The Office' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))

    const values = screen.getAllByRole('definition').map((node) => node.textContent)
    expect(values).toEqual(['The Office', 'Match Predictor', 'Premier League 2026/27'])
    // The rule that catches people out, before they share the code.
    expect(screen.getByText(/needs to have joined Match Predictor/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create and share' }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /The Office is ready/ })).toBeInTheDocument(),
    )
    expect(screen.getByText('ABC234DEF567')).toBeInTheDocument()
    expect(props.createLeague).toHaveBeenCalledOnce()
  })

  it('will not submit an empty name, and adds no rule beyond that', () => {
    renderJourney()

    fireEvent.click(screen.getByRole('button', { name: /^Match Predictor/ }))
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Which competition' })).getAllByRole(
        'button',
      )[0] as HTMLElement,
    )
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled()

    // A single character is enough for the browser: the 1–40 range is the
    // function's and it says so itself.
    fireEvent.change(screen.getByLabelText('League name'), { target: { value: 'A' } })
    expect(screen.getByRole('button', { name: 'Review' })).toBeEnabled()
  })

  it('shows the server refusal rather than a generic failure', async () => {
    renderJourney({
      createLeague: vi.fn(async () => {
        throw { code: 'PT429', message: 'total_league_limit_reached' }
      }),
    })

    fireEvent.click(screen.getByRole('button', { name: /^Match Predictor/ }))
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Which competition' })).getAllByRole(
        'button',
      )[0] as HTMLElement,
    )
    fireEvent.change(screen.getByLabelText('League name'), { target: { value: 'The Office' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create and share' }))

    await waitFor(() =>
      expect(screen.getByText('League limit reached. Contact admin.')).toBeInTheDocument(),
    )
    // Still on review, with the choices intact: a failed create is not a lost
    // form.
    expect(screen.getByRole('button', { name: 'Create and share' })).toBeInTheDocument()
  })
})

describe('a private Last Man Standing', () => {
  it('asks the organiser for the four rules ADR 0013 makes theirs', async () => {
    const props = renderJourney()

    fireEvent.click(screen.getByRole('button', { name: /^Last Man Standing/ }))
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Which competition' })).getAllByRole(
        'button',
      )[0] as HTMLElement,
    )
    fireEvent.change(screen.getByLabelText('Competition name'), {
      target: { value: 'Sunday Survivors' },
    })

    fireEvent.click(within(screen.getByRole('group', { name: 'Lives' })).getByText('2'))
    fireEvent.click(within(screen.getByRole('group', { name: 'Saves' })).getByText('1'))
    fireEvent.click(screen.getByRole('button', { name: 'A draw survives' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Everyone still standing shares the win' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create and share' }))

    await waitFor(() => expect(props.createLms).toHaveBeenCalledOnce())
    expect(props.createLms).toHaveBeenCalledWith(expect.any(String), 'Sunday Survivors', {
      lives: 2,
      saves: 1,
      drawsRule: 'survive',
      endgameOnWipeout: 'shared_win',
    })
  })

  it('never shows the Last Man Standing rules for a league', () => {
    renderJourney()

    fireEvent.click(screen.getByRole('button', { name: /^Match Predictor/ }))
    expect(screen.queryByRole('group', { name: 'Lives' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'If everyone goes out' })).toBeNull()
  })

  it('says so when the season has no round left, instead of a plain success screen', async () => {
    renderJourney({ createLms: createdLms('no_schedulable_round') })

    fireEvent.click(screen.getByRole('button', { name: /^Last Man Standing/ }))
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Which competition' })).getAllByRole(
        'button',
      )[0] as HTMLElement,
    )
    fireEvent.change(screen.getByLabelText('Competition name'), { target: { value: 'Too Late' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create and share' }))

    expect(await screen.findByText(/no round left this season/i)).toBeInTheDocument()
    // The code is still offered: the competition exists.
    expect(screen.getByText('LMS234DEF567')).toBeInTheDocument()
  })

  it('tells an invitee they need nothing else first', async () => {
    renderJourney()

    fireEvent.click(screen.getByRole('button', { name: /^Last Man Standing/ }))
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Which competition' })).getAllByRole(
        'button',
      )[0] as HTMLElement,
    )
    fireEvent.change(screen.getByLabelText('Competition name'), { target: { value: 'S' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))

    expect(screen.getByText(/do not need to have joined anything else first/)).toBeInTheDocument()
  })
})

describe('a private Predictor Championship', () => {
  it('creates without drawing, then launches on the organiser’s say-so', async () => {
    const props = renderJourney()

    fireEvent.click(screen.getByRole('button', { name: /^Predictor Championship/ }))
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Which competition' })).getAllByRole(
        'button',
      )[0] as HTMLElement,
    )
    fireEvent.change(screen.getByLabelText('Competition name'), { target: { value: 'Office Cup' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))

    // The irreversible part is said before it happens, not after.
    expect(screen.getByText(/Nothing is drawn yet/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create and share' }))

    expect(await screen.findByText('CUP234DEF567')).toBeInTheDocument()
    expect(props.createCup).toHaveBeenCalledOnce()
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Launch the Championship' }))

    expect(await screen.findByText(/8 entrants, 14 rounds and 56 fixtures/)).toBeInTheDocument()
    // Launched once and no longer offered: the draw is fixed.
    expect(screen.queryByRole('button', { name: 'Launch the Championship' })).toBeNull()
  })

  it('lets the organiser invite more and try again when the field is too small', async () => {
    renderJourney({
      launchCup: vi.fn(async () => ({
        outcome: 'no_viable_format' as const,
        entrants: 3,
        reason: 'field_below_minimum',
      })),
    })

    fireEvent.click(screen.getByRole('button', { name: /^Predictor Championship/ }))
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Which competition' })).getAllByRole(
        'button',
      )[0] as HTMLElement,
    )
    fireEvent.change(screen.getByLabelText('Competition name'), { target: { value: 'Office Cup' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create and share' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Launch the Championship' }))

    expect(await screen.findByText(/3 entrants, which is not enough/)).toBeInTheDocument()
    // Still offered, because inviting more people is the fix.
    expect(screen.getByRole('button', { name: 'Launch the Championship' })).toBeInTheDocument()
  })
})
