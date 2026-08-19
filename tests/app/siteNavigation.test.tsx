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
    expect(within(hub.container).getByRole('link', { name: 'Play' })).toHaveAttribute('href', '/play')
    expect(within(hub.container).queryByRole('link', { name: 'Predict' })).toBeNull()

    const euro = renderBar(EURO)
    expect(within(euro.container).getByRole('link', { name: 'Predict' })).toHaveAttribute('href', '/play')
  })

  it('offers the same five destinations on both, so a deep link resolves alike', () => {
    const hub = renderBar(HUB)
    const hubHrefs = within(hub.container).getAllByRole('link').map((link) => link.getAttribute('href'))
    const euro = renderBar(EURO)
    const euroHrefs = within(euro.container).getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hubHrefs).toEqual(['/', '/play', '/matches', '/leagues', '/more'])
    expect(euroHrefs).toEqual(hubHrefs)
  })

  it('keeps More identical, because settings are not a product decision', () => {
    for (const site of [HUB, EURO]) {
      expect(globalNavItems(site).at(-1)).toEqual({ key: 'more', label: 'More', to: '/more' })
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
    const euro = renderRail(EURO).container.textContent ?? ''
    expect(euro).not.toContain('All competitions')
    expect(railGroups(null, EURO).map((group) => group.key)).toEqual(['main', 'more'])
    expect(railGroups(null, HUB).map((group) => group.key)).toEqual(['main', 'competitions', 'more'])
  })

  it('carries the deployment’s own wording in its first group', () => {
    const euro = renderRail(EURO)
    expect(within(euro.container).getByRole('link', { name: 'Predict' })).toBeTruthy()
    expect(within(euro.container).queryByRole('link', { name: 'Play' })).toBeNull()
  })

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
    expect(siteGames('euro')).toHaveLength(4)
    expect(siteGames('euro').slice(1).map((game) => `${game.key}:${game.rank}`)).toEqual([
      'matchPredictor:elsewhere',
      'lms:bonus',
      'championship:bonus',
    ])
  })
})

describe('the auth screens', () => {
  it('introduce the product the visitor is actually on', () => {
    for (const site of [HUB, EURO]) {
      const view = render(
        <SiteProvider configuration={site}>
          <AuthScreen><p>form</p></AuthScreen>
        </SiteProvider>,
      )
      expect(within(view.container).getByRole('heading', { level: 1, name: site.brand.productName })).toBeTruthy()
      expect(view.container.textContent).toContain(siteBrandCopy(site.variant).tagline)
      view.unmount()
    }
  })

  it('never shows one deployment the other’s name', () => {
    const euro = render(
      <SiteProvider configuration={EURO}>
        <AuthScreen><p>form</p></AuthScreen>
      </SiteProvider>,
    )
    expect(euro.container.textContent).not.toContain(HUB.brand.productName)
  })
})

describe('the browser tab', () => {
  it('names the product this deployment is', () => {
    expect(HUB.brand.productName).toBe('Predictor Hub')
    expect(EURO.brand.productName).toBe('Euro 2028 Predictor')
  })
})
