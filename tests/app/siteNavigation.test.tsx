import { render, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { BottomNav, SideRail } from '../../src/design-system'
import { railGroups } from '../../src/app/railDestinations'
import { globalNavItems } from '../../src/app/site/navigation'
import { siteConfiguration } from '../../src/app/site/siteConfiguration'
import { siteGames } from '../../src/app/site/siteGames'
import { siteBrandCopy } from '../../src/app/site/sitePublicMetadata'
import { SiteProvider } from '../../src/app/site/SiteProvider'
import { AuthScreen } from '../../src/features/auth/AuthScreen'

/**
 * Both deployments' navigation, rendered in one process.
 *
 * This is the property the `SiteProvider` seam exists to make testable: without
 * it, proving the Euro bar means mutating `import.meta.env` before the module
 * graph loads, which no test can do reliably. Here both are just values.
 */

const HUB = siteConfiguration('hub')
const EURO = siteConfiguration('euro')

function renderBar(site: typeof HUB) {
  return render(
    <MemoryRouter>
      <BottomNav active="home" items={globalNavItems(site)} />
    </MemoryRouter>,
  )
}

describe('the mobile bottom bar', () => {
  it('leads with Play on the Hub and with Predict on Euro', () => {
    const hub = renderBar(HUB)
    expect(
      within(hub.container).getByRole('link', { name: 'Play' }),
    ).toHaveAttribute('href', '/play')
    expect(within(hub.container).queryByRole('link', { name: 'Predict' })).toBeNull()

    const euro = renderBar(EURO)
    // Same destination, this product's word for it.
    expect(
      within(euro.container).getByRole('link', { name: 'Predict' }),
    ).toHaveAttribute('href', '/play')
  })

  it('offers the same five destinations on both, so a deep link resolves alike', () => {
    const hub = renderBar(HUB)
    const hubHrefs = within(hub.container)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    const euro = renderBar(EURO)
    const euroHrefs = within(euro.container)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))

    expect(hubHrefs).toEqual(['/', '/play', '/matches', '/leagues', '/more'])
    expect(euroHrefs).toEqual(hubHrefs)
  })

  it('keeps More identical, because settings are not a product decision', () => {
    for (const site of [HUB, EURO]) {
      expect(globalNavItems(site).at(-1)).toEqual({
        key: 'more',
        label: 'More',
        to: '/more',
      })
    }
  })
})

describe('the desktop rail', () => {
  function renderRail(site: typeof HUB) {
    return render(
      <MemoryRouter>
        <SideRail
          groups={railGroups(null, site)}
          pathname="/"
          collapsed={false}
          onToggleCollapsed={() => undefined}
        />
      </MemoryRouter>,
    )
  }

  it('titles the competitions group on the deployment that has one', () => {
    expect(renderRail(HUB).container.textContent).toContain('My competitions')
  })

  it('offers no domestic competition list on the Euro deployment', () => {
    // The group lists the player's DOMESTIC seasons and ends in the weekly
    // catalogue. Rendering it under a heading reading "Tournament" gave the
    // tournament's own site a permanent, mislabelled index of the other
    // product, every row of which led out of this one.
    const euro = renderRail(EURO).container.textContent ?? ''
    expect(euro).not.toContain('All competitions')
    expect(railGroups(null, EURO).map((group) => group.key)).toEqual(['main', 'more'])
    expect(railGroups(null, HUB).map((group) => group.key)).toEqual([
      'main',
      'competitions',
      'more',
    ])
  })

  it('carries the deployment’s own wording in its first group', () => {
    const euro = renderRail(EURO)
    expect(within(euro.container).getByRole('link', { name: 'Predict' })).toBeTruthy()
    expect(within(euro.container).queryByRole('link', { name: 'Play' })).toBeNull()
  })

  // The rail's More group is the reach the desktop width pays for; it is never
  // a tab, so it must not appear in the first group on either deployment.
  it('never repeats More as a first-group destination', () => {
    for (const site of [HUB, EURO]) {
      const first = railGroups(null, site)[0]
      expect(first?.links.map((link) => link.key)).not.toContain('more')
      expect(first?.links).toHaveLength(4)
    }
  })
})

describe('the games each deployment leads with', () => {
  it('is three equal weekly games on the Hub', () => {
    expect(siteGames('hub').filter((game) => game.rank === 'equal')).toHaveLength(3)
    expect(siteGames('hub').some((game) => game.key === 'euroPredictor')).toBe(false)
  })

  it('is the tournament first, with the two attachable games beneath it on Euro', () => {
    expect(siteGames('euro')[0]?.key).toBe('euroPredictor')
    expect(siteGames('euro')[0]?.rank).toBe('primary')
    // Present, not removed — a Bonus Game is the same game, ranked lower — and
    // domestic Match Predictor is present too, ranked `elsewhere` because it is
    // a competition season played on the Hub rather than a game attached to
    // this tournament.
    expect(siteGames('euro')).toHaveLength(4)
    expect(
      siteGames('euro')
        .slice(1)
        .map((game) => `${game.key}:${game.rank}`),
    ).toEqual([
      'matchPredictor:elsewhere',
      'lms:bonus',
      'championship:bonus',
    ])
  })
})

describe('the auth screens', () => {
  it('introduce the product the visitor is actually on', () => {
    // Both the name and the tagline were hard-coded to the weekly platform, so
    // every Euro auth screen introduced itself as the other product — on the
    // screen where somebody decides whether to create an account.
    for (const site of [HUB, EURO]) {
      const view = render(
        <SiteProvider configuration={site}>
          <AuthScreen>
            <p>form</p>
          </AuthScreen>
        </SiteProvider>,
      )
      expect(
        within(view.container).getByRole('heading', { level: 1, name: site.brand.productName }),
      ).toBeTruthy()
      expect(view.container.textContent).toContain(siteBrandCopy(site.variant).tagline)
      view.unmount()
    }
  })

  it('never shows one deployment the other’s name', () => {
    const euro = render(
      <SiteProvider configuration={EURO}>
        <AuthScreen>
          <p>form</p>
        </AuthScreen>
      </SiteProvider>,
    )
    expect(euro.container.textContent).not.toContain(HUB.brand.productName)
  })
})

describe('the browser tab', () => {
  it('names the product this deployment is', () => {
    // The runtime document title and the generated `<title>` in the head are
    // the same fact, and both come from the site configuration. Hard-coding
    // either is how the Euro site's tabs end up reading "Football Prediction
    // Hub" — the other product's name, in every bookmark a player keeps.
    expect(HUB.brand.productName).toBe('Predictor Hub')
    expect(EURO.brand.productName).toBe('Euro 2028 Predictor')
  })
})
