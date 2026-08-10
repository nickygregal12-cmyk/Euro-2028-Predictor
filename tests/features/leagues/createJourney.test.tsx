import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CreateLeagueJourney } from '../../../src/features/leagues/CreateLeagueJourney'
import { presentCreateJourney } from '../../../src/features/leagues/createJourneyModel'
import { twentyCompetitionPlayer } from '../../../src/dev/scaleFixture'

/**
 * Creating a private league, against the server that actually accepts it.
 *
 * THE ONE CLAIM WORTH HOLDING is that nothing is offered which
 * `create_game_league` would refuse. It takes a `game_competition_id` for a
 * game requiring a prediction entry, and refuses a caller without an active
 * membership in it — so Match Predictor in a competition the player already
 * plays is the whole of the truthful offer, and the other two games must be
 * explanations rather than forms.
 *
 * The second claim is that the browser adds no rules of its own beyond having
 * something to submit: a name's length, a league cap and membership are the
 * function's answers, and its message is what the player reads.
 */

const PLAYER = twentyCompetitionPlayer()

function created() {
  return vi.fn(async () => ({ id: 'lg-1', name: 'The Office', inviteCode: 'ABC234' }))
}

describe('what is offered', () => {
  it('offers Match Predictor where it is played, and explains the other two', () => {
    const journey = presentCreateJourney(PLAYER)
    const predictor = journey.games.find((game) => game.gameKey === 'main_predictor')
    expect(predictor?.refusal).toBeNull()
    expect(predictor?.hosts.length).toBeGreaterThan(0)

    for (const key of ['last_man_standing', 'predictor_cup'] as const) {
      const game = journey.games.find((entry) => entry.gameKey === key)
      expect(game?.refusal).toBeTruthy()
      // No host is offered for a game that cannot be created — a host list with
      // a refusal beside it is how a dead form gets built by accident.
      expect(game?.hosts).toEqual([])
    }
    expect(journey.blocked).toBe(false)
  })

  it('refuses Match Predictor too when the player has joined none', () => {
    const journey = presentCreateJourney(null)
    expect(journey.games.every((game) => game.refusal !== null)).toBe(true)
    expect(journey.blocked).toBe(true)
    // And says what to do about it rather than reporting an error.
    expect(journey.games[0]?.refusal).toMatch(/Join Match Predictor in a competition first/)
  })

  it('lists a refused game without a control', async () => {
    render(
      <CreateLeagueJourney
        journey={presentCreateJourney(PLAYER)}
        create={created()}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /Match Predictor/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Last Man Standing/ })).not.toBeInTheDocument()
    expect(screen.getAllByText(/no private version of this game to create/i).length).toBe(2)
  })
})

describe('the journey', () => {
  it('goes choose game → set up → review → create and share', async () => {
    const create = created()
    render(
      <CreateLeagueJourney
        journey={presentCreateJourney(PLAYER)}
        create={create}
        onCancel={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Match Predictor/ }))

    // The competition is asked for, because the fixture player plays three.
    const which = screen.getByRole('group', { name: 'Which competition' })
    fireEvent.click(within(which).getByRole('button', { name: /Premier League/ }))
    fireEvent.change(screen.getByLabelText('League name'), { target: { value: 'The Office' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))

    // Review restates all three, because none of them can be changed later.
    const values = screen.getAllByRole('definition').map((node) => node.textContent)
    expect(values).toEqual(['The Office', 'Match Predictor', 'Premier League 2026/27'])
    // And states the rule that catches people out, before they share the code.
    expect(screen.getByText(/needs to have joined Match Predictor/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create and share' }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /The Office is ready/ })).toBeInTheDocument(),
    )
    // The invite code IS the last step, not a screen the player has to leave.
    expect(screen.getByText('ABC234')).toBeInTheDocument()
    expect(create).toHaveBeenCalledOnce()
  })

  it('will not submit an empty name, and adds no rule beyond that', async () => {
    render(
      <CreateLeagueJourney
        journey={presentCreateJourney(PLAYER)}
        create={created()}
        onCancel={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Match Predictor/ }))
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
    const create = vi.fn(async () => {
      throw { code: 'PT429', message: 'total_league_limit_reached' }
    })
    render(
      <CreateLeagueJourney
        journey={presentCreateJourney(PLAYER)}
        create={create}
        onCancel={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Match Predictor/ }))
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Which competition' })).getAllByRole('button')[0] as HTMLElement,
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

  it('states rather than asks when there is one competition to create in', async () => {
    const journey = presentCreateJourney(PLAYER)
    const single = {
      ...journey,
      games: journey.games.map((game) =>
        game.gameKey === 'main_predictor'
          ? { ...game, hosts: game.hosts.slice(0, 1) }
          : game,
      ),
    }
    render(<CreateLeagueJourney journey={single} create={created()} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Match Predictor/ }))

    // A choice of one is not a choice, so it is preselected and named.
    expect(screen.getByLabelText('League name')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Which competition' })).not.toBeInTheDocument()
    expect(screen.getByText(/the one competition you play/)).toBeInTheDocument()
  })

  it('keeps the game step even though only one game can be created', () => {
    // The step could be skipped — there is exactly one selectable game — and
    // skipping it would hide the only place the other two are explained.
    render(
      <CreateLeagueJourney
        journey={presentCreateJourney(PLAYER)}
        create={created()}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByText(/Choose the game it should rank/)).toBeInTheDocument()
    expect(screen.getAllByText(/no private version of this game to create/i)).toHaveLength(2)
  })
})
