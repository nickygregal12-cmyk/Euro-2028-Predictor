import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SeasonLeaguesPage } from '../../../src/features/season/SeasonLeaguesPage'
import type { SeasonLeaguesGateway } from '../../../src/features/season/gameLeaguesModel'
import type { SeasonLeagueStandingsGateway } from '../../../src/features/season/leagueStandingsModel'
import type { GameLeague } from '../../../src/services/supabase/gameLeagues'
import type {
  SeasonLeagueStandingsPage,
  SeasonLeagueStandingsRow,
} from '../../../src/services/supabase/seasonLeagueStandings'

function league(overrides: Partial<GameLeague> = {}): GameLeague {
  return {
    id: 'league-1',
    name: 'The Office',
    inviteCode: 'ABC123',
    memberCount: 4,
    isOwner: false,
    ownerName: 'Sam',
    lastActivityAt: null,
    ...overrides,
  }
}

function gatewayFor(
  leagues: GameLeague[] = [],
  overrides: Partial<SeasonLeaguesGateway> = {},
): SeasonLeaguesGateway {
  return {
    load: vi.fn(async () => leagues),
    create: vi.fn(async () => ({})),
    join: vi.fn(async () => ({})),
    ...overrides,
  }
}

function standingsRow(
  overrides: Partial<SeasonLeagueStandingsRow> = {},
): SeasonLeagueStandingsRow {
  return {
    displayName: 'Sam',
    points: 84,
    rank: 1,
    matchweeksPlayed: 22,
    tied: false,
    position: 1,
    isYou: false,
    isOwner: false,
    hasEntry: true,
    ...overrides,
  }
}

function standingsPage(
  overrides: Partial<SeasonLeagueStandingsPage> = {},
): SeasonLeagueStandingsPage {
  return {
    rows: [standingsRow()],
    totalCount: 1,
    pageSize: 50,
    hasMore: false,
    nextCursor: null,
    you: null,
    ...overrides,
  }
}

function standingsGatewayFor(
  page: SeasonLeagueStandingsPage = standingsPage(),
): SeasonLeagueStandingsGateway {
  return { load: vi.fn(async () => page) }
}

function renderPage(
  gateway: SeasonLeaguesGateway,
  joinedGame = true,
  standings: SeasonLeagueStandingsGateway = standingsGatewayFor(),
) {
  render(
    <SeasonLeaguesPage
      gateway={gateway}
      standings={standings}
      gameName="Main Predictor"
      joinedGame={joinedGame}
    />,
  )
}

describe('the competition leagues surface', () => {
  it('names the game its leagues rank', async () => {
    renderPage(gatewayFor())

    expect(await screen.findByText(/These leagues rank the Main Predictor/)).toBeTruthy()
  })

  it('lists a league with its invite code, so it can actually be shared', async () => {
    renderPage(gatewayFor([league()]))

    expect(await screen.findByText('The Office')).toBeTruthy()
    expect(screen.getByText('ABC123')).toBeTruthy()
    expect(screen.getByText(/4 members/)).toBeTruthy()
  })

  it('no longer explains away the table it can now open', async () => {
    // The sentence this replaces was true until contract 128 and is false now.
    renderPage(gatewayFor([league()]))

    await screen.findByText('The Office')
    expect(screen.queryByText(/League tables are not open yet/)).toBeNull()
  })

  it('opens a league into its own table, and reads it only when asked', async () => {
    // Reading every league's table on load would be one round trip per card
    // for a member who wanted one of them.
    const standings = standingsGatewayFor()
    renderPage(gatewayFor([league()]), true, standings)

    await screen.findByText('The Office')
    expect(standings.load).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'View The Office table' }))

    await waitFor(() => expect(standings.load).toHaveBeenCalledWith('league-1', null))
    expect(await screen.findByText('Sam')).toBeTruthy()
  })

  it('names the league in the control, so identical buttons cannot pile up', async () => {
    renderPage(gatewayFor([league(), league({ id: 'league-2', name: 'Five-a-side' })]))

    await screen.findByText('The Office')
    expect(screen.getByRole('button', { name: 'View The Office table' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View Five-a-side table' })).toBeTruthy()
  })

  it('keeps one table open at a time', async () => {
    // Two tables of the same players on one screen invite exactly the
    // cross-league comparison neither of them means.
    renderPage(gatewayFor([league(), league({ id: 'league-2', name: 'Five-a-side' })]))

    await screen.findByText('The Office')
    fireEvent.click(screen.getByRole('button', { name: 'View The Office table' }))
    await screen.findByRole('button', { name: 'Hide The Office table' })

    fireEvent.click(screen.getByRole('button', { name: 'View Five-a-side table' }))

    await screen.findByRole('button', { name: 'Hide Five-a-side table' })
    expect(screen.getByRole('button', { name: 'View The Office table' })).toBeTruthy()
  })

  it('closes the open table when its own control is pressed again', async () => {
    renderPage(gatewayFor([league()]))

    await screen.findByText('The Office')
    fireEvent.click(screen.getByRole('button', { name: 'View The Office table' }))
    const hide = await screen.findByRole('button', { name: 'Hide The Office table' })
    expect(hide.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(hide)

    expect(
      (await screen.findByRole('button', { name: 'View The Office table' })).getAttribute(
        'aria-expanded',
      ),
    ).toBe('false')
  })

  it('reports a refused table beside the league rather than blanking the page', async () => {
    // Losing league membership while the card is open is an ordinary outcome.
    // The other leagues must stay readable.
    const standings: SeasonLeagueStandingsGateway = {
      load: vi.fn(async () => {
        throw { code: 'insufficient_privilege' }
      }),
    }
    renderPage(gatewayFor([league()]), true, standings)

    await screen.findByText('The Office')
    fireEvent.click(screen.getByRole('button', { name: 'View The Office table' }))

    expect(await screen.findByText('You are no longer a member of this league.')).toBeTruthy()
    expect(screen.getByText('The Office')).toBeTruthy()
  })

  it('creates a league and reloads rather than appending one locally', async () => {
    // Appending would make the browser a second authority on what the caller
    // belongs to, and the two would disagree the first time a create partly
    // succeeded.
    const gateway = gatewayFor([])
    renderPage(gateway)

    await screen.findByText('No leagues yet')
    fireEvent.change(screen.getByLabelText('League name'), { target: { value: 'The Office' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create league' }))

    await waitFor(() => expect(gateway.create).toHaveBeenCalledWith('The Office'))
    await waitFor(() => expect(gateway.load).toHaveBeenCalledTimes(2))
  })

  it('keeps a refused name in the field, and says why it was refused', async () => {
    // Retyping a 41-character name from memory to fix it is worse than being
    // shown the rule beside the text that broke it.
    const gateway = gatewayFor([], {
      create: vi.fn(async () => {
        throw { code: 'check_violation' }
      }),
    })
    renderPage(gateway)

    await screen.findByText('No leagues yet')
    fireEvent.change(screen.getByLabelText('League name'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create league' }))

    expect(await screen.findByText('A league name must be 1 to 40 characters.')).toBeTruthy()
    expect((screen.getByLabelText('League name') as HTMLInputElement).value).toBe('x')
  })

  it('replaces the create form with the reason when the caller has not joined the game', async () => {
    // Not a disabled control with a tooltip, and not an enabled one that is
    // certain to be refused on submit.
    renderPage(gatewayFor(), false)

    expect(await screen.findByText(/Join the Main Predictor before creating a league/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create league' })).toBeNull()
  })

  it('keeps join available to a caller who has not joined the game', async () => {
    // The code decides which game the league belongs to, and the server
    // refuses with a sentence this page renders. Hiding the field would leave
    // a player holding a code with nowhere to put it.
    renderPage(gatewayFor([], {}), false)

    expect(await screen.findByLabelText('Invite code')).toBeTruthy()
  })

  it('separates an unknown code from a league in another game', async () => {
    const gateway = gatewayFor([], {
      join: vi.fn(async () => {
        throw { code: 'no_data_found' }
      }),
    })
    renderPage(gateway)

    await screen.findByText('No leagues yet')
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'NOPE99' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join league' }))

    expect(await screen.findByText('That invite code does not match a league.')).toBeTruthy()
  })

  it('upper-cases a typed code, because that is how the server stores it', async () => {
    renderPage(gatewayFor())

    const field = await screen.findByLabelText('Invite code')
    fireEvent.change(field, { target: { value: 'abc123' } })

    expect((field as HTMLInputElement).value).toBe('ABC123')
  })

  it('shows a failed read as a failure, never as an empty list', async () => {
    renderPage(
      gatewayFor([], {
        load: vi.fn(async () => {
          throw new Error('offline')
        }),
      }),
    )

    expect(await screen.findByText('We could not load your leagues')).toBeTruthy()
    expect(screen.queryByText('No leagues yet')).toBeNull()
  })

  it('distinguishes a league the caller owns', async () => {
    renderPage(gatewayFor([league({ isOwner: true })]))

    expect(await screen.findByText(/You own this league/)).toBeTruthy()
  })
})
