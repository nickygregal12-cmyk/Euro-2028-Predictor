import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  VNextAccountAbsorbed,
  VNextCompetitionPlayAbsorbed,
  VNextLeaguesAbsorbed,
  VNextMatchesAbsorbed,
  VNextPlayAbsorbed,
  VNextScoringAbsorbed,
  VNextStandingsAbsorbed,
} from '../../src/app/vnext/absorbedAddresses'
import { SiteProvider } from '../../src/app/site/SiteProvider'
import { siteConfiguration } from '../../src/app/site/siteConfiguration'
import type { PlayerCompetitionsState } from '../../src/app/providers/PlayerCompetitionsProvider'

/**
 * THE ADDRESSES vNEXT ABSORBED, AND WHERE THEY LAND.
 *
 * `routeOwnership.test.ts` proves the route TREE hands each of these to a
 * resolver. This proves the resolvers answer correctly — which is the half a
 * source-reading guard cannot see:
 *
 *   • an old bookmark reaches the surface that took its job, not a dead end;
 *   • a build that is not the Hub keeps every one of these addresses exactly as
 *     it had them, because Euro 2028 is outside this migration;
 *   • a failed or empty membership read lands on Discovery rather than
 *     guessing at a competition or reporting an error the player caused.
 */

const membership = vi.hoisted(() => ({
  state: null as unknown as PlayerCompetitionsState,
}))

vi.mock('../../src/app/providers/PlayerCompetitionsProvider', () => ({
  usePlayerCompetitions: () => membership.state,
}))

function state(partial: Partial<PlayerCompetitionsState>): PlayerCompetitionsState {
  return {
    status: 'ready',
    player: null,
    preferences: null,
    reload: () => {},
    ...partial,
  } as PlayerCompetitionsState
}

/**
 * A membership answer carrying only what a resolver reads. Narrow on purpose:
 * a resolver that started reading something else fails here rather than
 * depending on a fixture nobody meant as a contract.
 */
function playerIn(competitionSlug: string, seasonSlug: string) {
  return {
    mine: [{ competition: { competitionSlug, seasonSlug } }],
  } as unknown as PlayerCompetitionsState['player']
}

function renderAt(
  path: string,
  element: React.ReactElement,
  variant: 'hub' | 'euro' = 'hub',
  registerAs = path,
) {
  return render(
    <SiteProvider configuration={siteConfiguration(variant)}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={registerAs} element={element} />
          <Route
            path="/competitions/:competitionSlug/:seasonSlug"
            element={<p>Competition home</p>}
          />
          <Route
            path="/competitions/:competitionSlug/:seasonSlug/matches"
            element={<p>Competition matches</p>}
          />
          <Route
            path="/competitions/:competitionSlug/:seasonSlug/leagues"
            element={<p>Competition leagues</p>}
          />
          <Route
            path="/competitions/:competitionSlug/:seasonSlug/games"
            element={<p>Competition games</p>}
          />
          <Route path="/competitions" element={<p>Discovery</p>} />
          <Route path="/account" element={<p>Account</p>} />
        </Routes>
      </MemoryRouter>
    </SiteProvider>,
  )
}

const LEGACY = <p>Legacy surface</p>

afterEach(() => {
  vi.clearAllMocks()
})

describe('the absorbed global addresses resolve into the Competition Deck', () => {
  it('sends /play to the competition’s own front door', () => {
    // The job split in two: what needs doing HERE is Home's, and what needs
    // doing elsewhere is the shell's attention layer. Home is the half with an
    // address.
    membership.state = state({ player: playerIn('premier-league', '2026-27') })
    renderAt('/play', <VNextPlayAbsorbed legacy={LEGACY} />)
    expect(screen.getByText('Competition home')).toBeInTheDocument()
  })

  it('sends /matches to the competition’s Matches, where the combined scope lives', () => {
    membership.state = state({ player: playerIn('premier-league', '2026-27') })
    renderAt('/matches', <VNextMatchesAbsorbed legacy={LEGACY} />)
    expect(screen.getByText('Competition matches')).toBeInTheDocument()
  })

  it('sends /leagues to the competition’s Leagues', () => {
    membership.state = state({ player: playerIn('premier-league', '2026-27') })
    renderAt('/leagues', <VNextLeaguesAbsorbed legacy={LEGACY} />)
    expect(screen.getByText('Competition leagues')).toBeInTheDocument()
  })

  it('sends /more/scoring to Games, where the rules are rendered', () => {
    membership.state = state({ player: playerIn('premier-league', '2026-27') })
    renderAt('/more/scoring', <VNextScoringAbsorbed legacy={LEGACY} />)
    expect(screen.getByText('Competition games')).toBeInTheDocument()
  })

  it('sends /more and /profile to the account, with no membership read at all', () => {
    // Neither resolves to a competition, so neither waits on one. A redirect
    // that blocked on an unrelated read would be slower for no reason.
    membership.state = state({ status: 'loading' })
    renderAt('/profile', <VNextAccountAbsorbed legacy={LEGACY} />)
    expect(screen.getByText('Account')).toBeInTheDocument()
  })
})

describe('the absorbed competition-scoped addresses keep the competition they were given', () => {
  it('sends a competition’s play list to that competition’s Home', () => {
    // FROM THE ADDRESS, NOT FROM THE ACTIVE COMPETITION. A player who typed one
    // competition's URL must not be moved to another one.
    membership.state = state({ player: playerIn('scottish-premiership', '2026-27') })
    renderAt(
      '/competitions/premier-league/2026-27/play',
      <VNextCompetitionPlayAbsorbed legacy={LEGACY} />,
      'hub',
      '/competitions/:competitionSlug/:seasonSlug/play',
    )
    expect(screen.getByText('Competition home')).toBeInTheDocument()
  })

  it('sends the Match Predictor standings to Leagues, where the season table is a scope', () => {
    membership.state = state({ player: playerIn('premier-league', '2026-27') })
    renderAt(
      '/competitions/premier-league/2026-27/games/match-predictor/standings',
      <VNextStandingsAbsorbed legacy={LEGACY} />,
      'hub',
      '/competitions/:competitionSlug/:seasonSlug/games/match-predictor/standings',
    )
    expect(screen.getByText('Competition leagues')).toBeInTheDocument()
  })
})

describe('the tournament build keeps every one of these addresses', () => {
  it.each([
    ['/play', <VNextPlayAbsorbed legacy={LEGACY} key="play" />],
    ['/matches', <VNextMatchesAbsorbed legacy={LEGACY} key="matches" />],
    ['/leagues', <VNextLeaguesAbsorbed legacy={LEGACY} key="leagues" />],
    ['/profile', <VNextAccountAbsorbed legacy={LEGACY} key="account" />],
  ])('leaves %s alone on the Euro deployment', (path, element) => {
    // Three of these are `variantRoutes.ts`'s shared paths and mean the
    // tournament's own product there. Euro 2028 is explicitly outside this
    // migration, and the cutover flags reach both sites from one netlify.toml —
    // so the site, not the flag, is what keeps them apart.
    membership.state = state({ player: playerIn('premier-league', '2026-27') })
    renderAt(path, element, 'euro')
    expect(screen.getByText('Legacy surface')).toBeInTheDocument()
  })
})

describe('a membership read that cannot answer is not an error page', () => {
  it('lands on Discovery when the read failed', () => {
    // The rollback is the flag and it is build-time. A flaky network must not
    // move a player between two information architectures.
    membership.state = state({ status: 'failed' })
    renderAt('/matches', <VNextMatchesAbsorbed legacy={LEGACY} />)
    expect(screen.getByText('Discovery')).toBeInTheDocument()
  })

  it('lands on Discovery when the player is in no competition', () => {
    // Not an error, and it must not look like one: a Matches page for a
    // competition the player is not in would be an empty room with their name
    // on it.
    membership.state = state({ player: { mine: [] } as never })
    renderAt('/matches', <VNextMatchesAbsorbed legacy={LEGACY} />)
    expect(screen.getByText('Discovery')).toBeInTheDocument()
  })
})
