import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, waitFor, within } from '@testing-library/react'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextGamesScreen } from '../../src/vnext/integration/games/VNextGamesScreen'

/**
 * JOIN, END TO END, THROUGH THE AUTHORITY THAT OWNS ENTRY.
 *
 * ============================ WHAT WAS MISSING ===========================
 *
 * The hub drew Join and Joining… and the acquisition hook stated in its own
 * header that the write "is not here yet" — the surface emitted `join-game`,
 * the host was said to own it, and no host performed it. So the control was
 * real, focusable, named and inert, which is the one thing a games catalogue
 * must never ship.
 *
 * ============================ WHAT THESE CASES HOLD ======================
 *
 *   * a Join calls `join_competition_game` with the row's own
 *     `game_competition_id`, and NOTHING else — no rule is re-decided here;
 *   * the row becomes "You are playing" from a RE-READ of the catalogue, never
 *     from a patched copy;
 *   * a refused Join leaves the player unjoined, keeps the row, keeps the rest
 *     of the catalogue and prints the server's own sentence;
 *   * two fast presses send ONE join;
 *   * a press on a second row while the first is in flight sends nothing;
 *   * and no registration is inferred from a browser clock — the outlook the
 *     control is drawn from resolves against `server_now`.
 */

const server = vi.hoisted(() => {
  const state = {
    /** Which game competition ids this account is a member of. */
    joined: new Set<string>(),
    failWith: null as string | null,
    /** Held open so an in-flight press is observable. */
    hold: false,
    /** The instant the catalogue reports. Deliberately not the device clock. */
    serverNow: '2026-08-22T12:00:00.000Z',
  }
  const calls = { games: 0, join: [] as string[] }
  let release: (() => void) | null = null
  return { state, calls, releaseHold: () => release?.(), setRelease: (fn: () => void) => { release = fn } }
})

vi.mock('../../src/services/supabase/seasonPlayContext', () => ({
  createSeasonPlayContextGateway: () => ({
    load: async () => ({
      tournamentId: 'season-1',
      competitionName: 'Caledonian Premiership',
      seasonLabel: '2027/28',
    }),
  }),
}))

vi.mock('../../src/services/supabase/competitionGames', () => ({
  fetchSeasonGames: async () => {
    server.calls.games += 1
    return {
      competitionMember: true,
      serverNow: server.state.serverNow,
      games: [
        {
          id: 'game-lms',
          gameKey: 'last_man_standing',
          active: true,
          displayName: 'Last Man Standing',
          registrationOpensAt: '2026-08-01T00:00:00.000Z',
          registrationClosesAt: '2026-09-01T00:00:00.000Z',
          completedAt: null,
          allowRejoin: true,
          membership: server.state.joined.has('game-lms')
            ? { status: 'active', joinedAt: '2026-08-20T00:00:00.000Z' }
            : null,
        },
        {
          id: 'game-cup',
          gameKey: 'predictor_cup',
          active: true,
          displayName: 'Predictor Championship',
          registrationOpensAt: '2026-08-01T00:00:00.000Z',
          registrationClosesAt: '2026-09-01T00:00:00.000Z',
          completedAt: null,
          allowRejoin: true,
          membership: server.state.joined.has('game-cup')
            ? { status: 'active', joinedAt: '2026-08-20T00:00:00.000Z' }
            : null,
        },
      ],
    }
  },
  joinCompetitionGame: async (gameCompetitionId: string) => {
    server.calls.join.push(gameCompetitionId)
    if (server.state.hold) {
      await new Promise<void>((resolve) => server.setRelease(resolve))
    }
    if (server.state.failWith !== null) throw new Error(server.state.failWith)
    server.state.joined.add(gameCompetitionId)
  },
}))

function renderGames() {
  return render(
    <VNextRoot>
      <VNextGamesScreen
        userId="player-1"
        authLoading={false}
        competitionSlug="caledonian"
        seasonSlug="2027-28"
      />
    </VNextRoot>,
  )
}

const rowOf = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-vnext-game="${id}"]`) as HTMLElement

async function readyHub() {
  const view = renderGames()
  await waitFor(() => expect(rowOf(view.container, 'game-lms')).toBeTruthy())
  return view
}

beforeEach(() => {
  server.state.joined = new Set<string>()
  server.state.failWith = null
  server.state.hold = false
  server.calls.games = 0
  server.calls.join = []
})

describe('a join that lands', () => {
  it('sends the row’s own game competition id and re-reads', async () => {
    const { container } = await readyHub()

    fireEvent.click(within(rowOf(container, 'game-lms')).getByRole('button', { name: /^join/i }))

    await waitFor(() =>
      expect(rowOf(container, 'game-lms').getAttribute('data-standing')).toBe('playing'),
    )
    // Addressed by `game_competition_id`, which is what the RPC takes.
    expect(server.calls.join).toEqual(['game-lms'])
    // The row changed because the CATALOGUE changed, not because this lane
    // patched its copy: the read ran a second time.
    expect(server.calls.games).toBeGreaterThan(1)
    expect(within(rowOf(container, 'game-lms')).queryByRole('button', { name: /^join/i })).toBeNull()
  })

  it('moves the row into "You are playing"', async () => {
    const { container } = await readyHub()
    fireEvent.click(within(rowOf(container, 'game-lms')).getByRole('button', { name: /^join/i }))

    await waitFor(() => {
      const playing = container.querySelector('[data-vnext-zone="playing"]') as HTMLElement
      expect(playing).toBeTruthy()
      expect(playing.querySelector('[data-vnext-game="game-lms"]')).toBeTruthy()
    })
  })
})

describe('a join that does not land', () => {
  it('leaves the player unjoined and says why', async () => {
    server.state.failWith = 'registration for this game has closed'
    const { container } = await readyHub()

    fireEvent.click(within(rowOf(container, 'game-lms')).getByRole('button', { name: /^join/i }))

    await within(rowOf(container, 'game-lms')).findByRole('status')
    expect(server.state.joined.has('game-lms')).toBe(false)
    expect(rowOf(container, 'game-lms').getAttribute('data-standing')).toBe('never-joined')
    // Still offered, and the control is itself the retry.
    expect(
      within(rowOf(container, 'game-lms')).getByRole('button', { name: /^join/i }),
    ).toBeEnabled()
  })

  it('does not blank the rest of the catalogue', async () => {
    server.state.failWith = 'registration for this game has closed'
    const { container } = await readyHub()

    fireEvent.click(within(rowOf(container, 'game-lms')).getByRole('button', { name: /^join/i }))
    await within(rowOf(container, 'game-lms')).findByRole('status')

    expect(rowOf(container, 'game-cup')).toBeTruthy()
    expect(within(rowOf(container, 'game-cup')).queryByRole('status')).toBeNull()
    expect(
      within(rowOf(container, 'game-cup')).getByRole('button', { name: /^join/i }),
    ).toBeEnabled()
  })

  it('announces politely and opens nothing modal', async () => {
    server.state.failWith = 'registration for this game has closed'
    const { container } = await readyHub()

    fireEvent.click(within(rowOf(container, 'game-lms')).getByRole('button', { name: /^join/i }))
    await within(rowOf(container, 'game-lms')).findByRole('status')

    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('clears once the same press succeeds', async () => {
    server.state.failWith = 'registration for this game has closed'
    const { container } = await readyHub()

    fireEvent.click(within(rowOf(container, 'game-lms')).getByRole('button', { name: /^join/i }))
    await within(rowOf(container, 'game-lms')).findByRole('status')

    server.state.failWith = null
    fireEvent.click(within(rowOf(container, 'game-lms')).getByRole('button', { name: /^join/i }))

    await waitFor(() =>
      expect(rowOf(container, 'game-lms').getAttribute('data-standing')).toBe('playing'),
    )
    expect(container.querySelector('[data-vnext-zone="join-failed"]')).toBeNull()
  })
})

describe('while a join is in flight', () => {
  it('sends one join for two fast presses', async () => {
    server.state.hold = true
    const { container } = await readyHub()

    const join = within(rowOf(container, 'game-lms')).getByRole('button', { name: /^join/i })
    fireEvent.click(join)
    fireEvent.click(join)
    fireEvent.click(join)

    await waitFor(() =>
      expect(
        within(rowOf(container, 'game-lms')).getByRole('button', { name: /joining…/i }),
      ).toBeDisabled(),
    )
    expect(server.calls.join).toEqual(['game-lms'])

    server.state.hold = false
    server.releaseHold()
    await waitFor(() =>
      expect(rowOf(container, 'game-lms').getAttribute('data-standing')).toBe('playing'),
    )
  })

  it('suppresses a press on another row until the first settles', async () => {
    server.state.hold = true
    const { container } = await readyHub()

    fireEvent.click(within(rowOf(container, 'game-lms')).getByRole('button', { name: /^join/i }))
    await waitFor(() =>
      expect(
        within(rowOf(container, 'game-lms')).getByRole('button', { name: /joining…/i }),
      ).toBeDisabled(),
    )

    // The other row is NOT disabled — one row's work does not freeze the hub —
    // but the write is one at a time, so this press sends nothing.
    const other = within(rowOf(container, 'game-cup')).getByRole('button', { name: /^join/i })
    expect(other).toBeEnabled()
    fireEvent.click(other)
    expect(server.calls.join).toEqual(['game-lms'])

    server.state.hold = false
    server.releaseHold()
    await waitFor(() =>
      expect(rowOf(container, 'game-lms').getAttribute('data-standing')).toBe('playing'),
    )
  })
})

describe('registration openness is never inferred from the browser', () => {
  it('closes the control on the server’s instant, not the device’s', async () => {
    // The device clock is untouched; only the catalogue's `server_now` moves
    // past the close. If the surface read a browser clock this row would still
    // offer Join.
    server.state.serverNow = '2026-10-01T12:00:00.000Z'
    const { container } = await readyHub()

    expect(
      within(rowOf(container, 'game-lms')).queryByRole('button', { name: /^join/i }),
    ).toBeNull()
    expect(server.calls.join).toEqual([])
  })
})
