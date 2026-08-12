import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Suspense } from 'react'

// The page's default reader is the real one; every assertion injects its own.
// Mocking the module keeps this credential-free unit test from initialising a
// Supabase client on import.
vi.mock('../../src/services/supabase/euroPublication', () => ({
  fetchEuroPublicationState: vi.fn(),
}))

import {
  SHARED_TOP_LEVEL_PATHS,
  VARIANT_ROUTE_OWNERSHIP,
  variantSurface,
} from '../../src/app/site/variantRoutes'
import { siteConfiguration } from '../../src/app/site/siteConfiguration'
import { SiteProvider } from '../../src/app/site/SiteProvider'
import { EuroDestinationPage } from '../../src/features/euro/EuroDestinationPage'
import { weeklyRoutes } from '../../src/app/shellRoutes'
import { appSource } from './declaredRoutes'
import type { EuroDestination } from '../../src/features/euro/euroSignedInModel'
import type { EuroPublicationSnapshot } from '../../src/services/supabase/euroPublicationModel'

/**
 * The variant route matrix: the same four addresses, two products.
 *
 * WHAT THIS PROTECTS. ADR 0026 builds two deployments from one commit, and PR
 * #702 separated the brand, the navigation wording, the public metadata and the
 * anonymous landing page — and not the signed-in product. A player who signed in
 * on the Euro domain was handed the domestic Hub at all four global destinations
 * with Euro labels on the navigation above it. This is the guard that says a
 * regression to that shape is a failing test rather than a thing somebody has to
 * notice.
 *
 * IT ASSERTS THE TABLE AS A WHOLE, deliberately. A per-path check would pass on a
 * table where one path had quietly been given the same owner in both builds,
 * which is precisely how the split erodes: one path at a time, each looking
 * reasonable.
 */

describe('the variant route matrix', () => {
  it('owns every shared path in both builds', () => {
    expect(SHARED_TOP_LEVEL_PATHS.length).toBeGreaterThan(3)
    for (const path of SHARED_TOP_LEVEL_PATHS) {
      expect(variantSurface('hub', path), `no hub owner for ${path}`).not.toBeNull()
      expect(variantSurface('euro', path), `no euro owner for ${path}`).not.toBeNull()
    }
  })

  it('never gives one path the same surface in both builds', () => {
    // Two builds resolving a path to one surface is the defect, not a shortcut:
    // it means that address is the same product on both domains.
    const shared = VARIANT_ROUTE_OWNERSHIP.filter((row) => row.hub === row.euro)
    expect(
      shared.map((row) => row.path),
      'these paths resolve to the same product on both deployments',
    ).toEqual([])
  })

  it('covers the four global destinations, and the one collision that is not one', () => {
    // `/league` is the fifth and is deliberately not a global destination: it is
    // the tournament's own Leagues address, driven by three of its journeys, and
    // a legacy redirect to `/leagues` on the weekly platform. One static route
    // table cannot register two elements for one path, so it is disambiguated
    // here with everything else that has to be. Listed explicitly so a sixth row
    // is a decision somebody takes rather than a default it inherits.
    expect([...SHARED_TOP_LEVEL_PATHS]).toEqual([
      weeklyRoutes.hub,
      weeklyRoutes.play,
      weeklyRoutes.matches,
      weeklyRoutes.leagues,
      '/league',
    ])
  })

  it('answers null for a path no row owns, rather than guessing', () => {
    // A caller asking about an unshared path has asked the wrong question, and
    // answering "the home page" would hide that.
    expect(variantSurface('hub', '/more')).toBeNull()
    expect(variantSurface('euro', '/competitions')).toBeNull()
  })

  it('is what App.tsx registers, through the dispatchers rather than a branch', () => {
    // An inline ternary in the route table would make the ownership
    // unreviewable AND invisible to the title and accessibility sweeps, which
    // read this file as source and understand `element={<X />}`.
    for (const element of [
      'HomeDestination',
      'PlayDestination',
      'MatchesDestination',
      'LeaguesDestination',
    ]) {
      expect(appSource, `App.tsx does not register ${element}`).toContain(
        `element={<${element} />}`,
      )
    }
    expect(appSource, 'App.tsx branches on the variant inline').not.toMatch(
      /element=\{\s*site\.variant/,
    )
  })
})

function readState(state: EuroPublicationSnapshot['state']) {
  return () => Promise.resolve({ state, changedAt: '2026-08-11T00:00:00.000Z' })
}

function renderEuro(destination: EuroDestination) {
  return render(
    <SiteProvider configuration={siteConfiguration('euro', { siblingOrigin: 'https://hub.example' })}>
      <MemoryRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route
              path="*"
              element={
                <EuroDestinationPage
                  destination={destination}
                  readPublicationState={readState('hidden')}
                />
              }
            />
          </Routes>
        </Suspense>
      </MemoryRouter>
    </SiteProvider>,
  )
}

describe('the Euro deployment’s signed-in destinations', () => {
  it('answers each of the four with the tournament, never the domestic product', async () => {
    for (const [destination, heading] of [
      ['home', /Euro 2028 is not open yet/],
      ['play', /nothing to predict yet/],
      ['matches', /no Euro 2028 matches yet/],
      ['leagues', /Euro 2028 leagues open with the tournament/],
    ] as const) {
      const view = renderEuro(destination)
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy(),
      )
      view.unmount()
    }
  })

  it('shows no fabricated football anywhere on them', async () => {
    for (const destination of ['home', 'play', 'matches', 'leagues'] as const) {
      const view = renderEuro(destination)
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy())
      const body = (document.body.textContent ?? '').toLowerCase()
      // A drawn group, a nation, a fixture or a countdown would each be football
      // this build does not have.
      for (const forbidden of ['group a', 'group b', 'scotland', 'england', 'days to go']) {
        expect(body, `${destination} claims "${forbidden}"`).not.toMatch(
          new RegExp(`\\b${forbidden}\\b`),
        )
      }
      view.unmount()
    }
  })

  it('offers no way to join anything', async () => {
    // Arriving at a destination has never been game entry and must not become
    // it. There is no entry control on any of these pages.
    for (const destination of ['home', 'play', 'leagues'] as const) {
      const view = renderEuro(destination)
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy())
      expect(screen.queryByRole('button', { name: /join|enter|play now/i })).toBeNull()
      view.unmount()
    }
  })
})
