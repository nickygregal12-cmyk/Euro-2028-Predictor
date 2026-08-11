import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { DomesticCompetitions } from '../../src/app/DomesticCompetitions'
import { SiteProvider } from '../../src/app/site/SiteProvider'
import { siteConfiguration } from '../../src/app/site/siteConfiguration'
import { weeklyRoutePatterns, weeklyRoutes } from '../../src/app/shellRoutes'
import { appSource } from './declaredRoutes'
import type { SiteVariant } from '../../src/app/site/siteVariant'

/**
 * The weekly competition tree's deployment boundary.
 *
 * `EURO-001` records that the Hub still serves the tournament's player routes.
 * This is the other half of the same rule and the half that can be closed today:
 * the Euro deployment must not serve the DOMESTIC product. It was serving all of
 * it — the published catalogue, every season overview, every domestic game
 * surface, every private league — behind navigation reading "Tournament", so a
 * URL on the tournament's own domain resolved to the Scottish Premiership's
 * Match Predictor with nothing anywhere saying the visitor had left.
 */

const DOMESTIC = 'a domestic competition surface'

function renderBoundary(variant: SiteVariant, at: string) {
  return render(
    <SiteProvider configuration={siteConfiguration(variant)}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route element={<DomesticCompetitions />}>
            <Route path={weeklyRoutes.competitions} element={<p>{DOMESTIC}</p>} />
            <Route path={weeklyRoutePatterns.matchPredictor} element={<p>{DOMESTIC}</p>} />
          </Route>
          <Route path={weeklyRoutes.hub} element={<p>this build’s home</p>} />
        </Routes>
      </MemoryRouter>
    </SiteProvider>,
  )
}

const DEEP = '/competitions/scottish-premiership/2026-27/games/match-predictor'

describe('the domestic competition boundary', () => {
  it('serves the weekly tree on the Hub, catalogue and deep link alike', () => {
    for (const at of [weeklyRoutes.competitions, DEEP]) {
      const view = renderBoundary('hub', at)
      expect(screen.getByText(DOMESTIC), at).toBeTruthy()
      view.unmount()
    }
  })

  it('refuses it on the Euro build, including a guessed deep link', () => {
    // A catalogue omission is not a control: the URL still resolves. This is
    // asserted on the DEEP address as well as the catalogue, because the deep
    // one is what a shared link or a bookmark actually carries.
    for (const at of [weeklyRoutes.competitions, DEEP]) {
      const view = renderBoundary('euro', at)
      expect(screen.queryByText(DOMESTIC), at).toBeNull()
      expect(screen.getByText('this build’s home')).toBeTruthy()
      view.unmount()
    }
  })

  it('is declared once in App.tsx, around the whole tree', () => {
    // One boundary rather than a guard per route: a route added inside inherits
    // it, which is the difference between a boundary and a habit.
    expect(appSource).toContain('element={<DomesticCompetitions />}')
    expect(
      appSource.match(/element=\{<DomesticCompetitions \/>\}/g)?.length,
      'more than one domestic boundary — a route added to the wrong one is silent',
    ).toBe(1)
  })

  it('leaves the four shared destinations outside it', () => {
    // They are shared by design and each build owns its own surface there, so
    // they must not be refused by a boundary about the weekly tree.
    const boundary = appSource.indexOf('element={<DomesticCompetitions />}')
    for (const destination of [
      'HomeDestination',
      'PlayDestination',
      'MatchesDestination',
      'LeaguesDestination',
    ]) {
      expect(
        appSource.indexOf(`element={<${destination} />}`),
        `${destination} is registered inside the domestic boundary`,
      ).toBeLessThan(boundary)
    }
  })
})
