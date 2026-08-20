import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, RouterProvider, Routes, createMemoryRouter } from 'react-router'
import { VNextRootDestination } from '../../src/app/vnext/VNextRootDestination'
import type { PlayerCompetitionsState } from '../../src/app/providers/PlayerCompetitionsProvider'

/**
 * WHAT `/` OPENS ON.
 *
 * The route matrix deferred exactly one decision to the cutover — "`/` may keep
 * resolving to whatever the player's active competition is, and deciding how is
 * the cutover stage's work" — and Stage 14 shipped without taking it, so a
 * signed-in player kept landing on the retired information architecture. These
 * are the rules the decision came with, asserted at the routing layer, because
 * the destination can be perfect and still never render if the front door does
 * not send anyone to it.
 */

const membership = vi.hoisted(() => ({
  state: null as unknown as PlayerCompetitionsState,
}))

vi.mock('../../src/app/providers/PlayerCompetitionsProvider', () => ({
  usePlayerCompetitions: () => membership.state,
}))

/**
 * A `player` carrying only what the resolver reads.
 *
 * Cast once, HERE, and through `unknown` so TypeScript is told rather than
 * talked round: `PlayerCompetitions` also holds `shortcuts`, `overflow`,
 * `catalogue`, `relevanceSource` and `empty`, and building all five would put
 * four fields into every fixture that no assertion below looks at. The narrow
 * shape is the point — a resolver that started reading one of the others would
 * fail here rather than quietly depend on a fixture nobody meant as a contract.
 */
function playerWith(
  ...mine: readonly { competitionSlug: string; seasonSlug: string }[]
): PlayerCompetitionsState['player'] {
  return {
    mine: mine.map((competition) => ({ competition })),
  } as unknown as PlayerCompetitionsState['player']
}

function state(partial: Partial<PlayerCompetitionsState>): PlayerCompetitionsState {
  return {
    status: 'ready',
    player: null,
    preferences: null,
    reload: () => {},
    ...partial,
  } as PlayerCompetitionsState
}

function renderRoot() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<VNextRootDestination fallback={<p>Legacy hub</p>} />} />
        <Route
          path="/competitions/:competitionSlug/:seasonSlug"
          element={<p>Home of :competition</p>}
        />
        <Route path="/competitions" element={<p>Discovery</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('the front door resolves to a competition', () => {
  it('opens the competition the player is most relevant to', () => {
    // `player.mine` is documented as "most relevant first", which is the whole
    // reason this resolver adds no ordering of its own. The SECOND entry being
    // present is what makes the assertion mean something: a resolver that
    // picked arbitrarily would pass a one-competition fixture.
    membership.state = state({
      player: playerWith(
        { competitionSlug: 'premier-league', seasonSlug: '2026-27' },
        { competitionSlug: 'spfl', seasonSlug: '2026-27' },
      ),
    })

    renderRoot()
    expect(screen.getByText('Home of :competition')).toBeInTheDocument()
  })

  it('replaces the entry rather than stacking it, so Back leaves the app', () => {
    // A pushed redirect makes the browser's Back button a loop: `/` sends the
    // player forward again the moment they press it. Asserted through the
    // router's own history action rather than through what rendered, because
    // both positions render the same screen and only one of them traps.
    membership.state = state({
      player: playerWith({ competitionSlug: 'premier-league', seasonSlug: '2026-27' }),
    })

    const router = createMemoryRouter(
      [
        { path: '/', element: <VNextRootDestination fallback={<p>Legacy hub</p>} /> },
        {
          path: '/competitions/:competitionSlug/:seasonSlug',
          element: <p>Home of :competition</p>,
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)
    expect(router.state.location.pathname).toBe('/competitions/premier-league/2026-27')
    expect(router.state.historyAction).toBe('REPLACE')
  })
})

describe('the two cases that are not a competition', () => {
  it('sends a player in none to discovery, not to an empty Home', () => {
    membership.state = state({ player: playerWith() })

    renderRoot()
    expect(screen.getByText('Discovery')).toBeInTheDocument()
  })

  it('shows the legacy hub when the membership read FAILED', () => {
    // "You are in none" and "we could not find out" send a player to different
    // places, and the provider keeps them apart precisely so this can. A
    // failure that fell through to discovery would tell a player with four
    // competitions that they have none.
    membership.state = state({ status: 'failed', player: null })

    renderRoot()
    expect(screen.getByText('Legacy hub')).toBeInTheDocument()
    expect(screen.queryByText('Discovery')).toBeNull()
  })

  it('waits rather than guessing while the read is in flight', () => {
    // Redirecting on a null player would send every signed-in visit to
    // discovery for one frame, and a redirect cannot be taken back.
    membership.state = state({ status: 'loading', player: null })

    renderRoot()
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByText('Discovery')).toBeNull()
    expect(screen.queryByText('Home of :competition')).toBeNull()
    expect(screen.queryByText('Legacy hub')).toBeNull()
  })
})
