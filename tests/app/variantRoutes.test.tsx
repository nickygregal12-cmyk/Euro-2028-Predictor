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

  it('covers exactly the four global destinations, which is what navigation offers', () => {
    expect([...SHARED_TOP_LEVEL_PATHS]).toEqual([
      weeklyRoutes.hub,
      weeklyRoutes.play,
      weeklyRoutes.matches,
      weeklyRoutes.leagues,
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
    // ALL FOUR DISPATCHERS ARE NOW REGISTERED THROUGH A FLAG BRANCH RATHER
    // THAN A VARIANT ONE, and the distinction is the whole point of this test
    // rather than an exception to it. `/` merged into the competition's Home;
    // `/play`, `/matches` and `/leagues` are the matrix's `HIDE / ABSORB` rows
    // and now resolve into the destination that took each job. Every one of
    // them still RENDERS its dispatcher on the off branch and on the Euro
    // build, which is what keeps the two products apart — the absorbed rows
    // hand it to the resolver as `legacy={<X />}` and it renders unchanged
    // wherever the absorption does not apply.
    for (const element of ['PlayDestination', 'MatchesDestination', 'LeaguesDestination']) {
      expect(appSource, `App.tsx does not render ${element}`).toContain(`<${element} />`)
      expect(
        appSource,
        `${element} is no longer the fallback its own address rolls back to`,
      ).toContain(`legacy={<${element} />}`)
    }

    // `HomeDestination` IS REGISTERED THROUGH A FLAG BRANCH, NOT A VARIANT ONE,
    // and the distinction is the whole point of this test rather than an
    // exception to it. Stage 14 merged `/` into the competition's own Home, so
    // the root now selects between the vNext resolver and this dispatcher —
    // which is `src/app/routeFlags.ts`'s rollback switch doing its job, and
    // leaves the dispatcher mounted on the off branch exactly as before.
    //
    // The `element={<X />}` shape was required so source sweeps could see the
    // registration. Only `tests/app/declaredRoutes.ts` reads the element at all,
    // and only to recognise `<Navigate>`, so the rendering below is equally
    // visible; `/` correctly stays out of the redirect-only set because it
    // renders a component that decides.
    expect(appSource, 'App.tsx does not render HomeDestination').toContain(
      '<HomeDestination />',
    )
    expect(
      appSource,
      'the root no longer falls back to the legacy hub when the flag is off',
    ).toMatch(/isNextUi\('footballHubHome'\)[\s\S]{0,200}<HomeDestination \/>/)
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
