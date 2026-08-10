import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PageShell } from '../../src/design-system/PageShell'
import { SideRail } from '../../src/design-system/SideRail'
import { railGroups } from '../../src/app/railDestinations'
import { globalNavTab } from '../../src/app/shellRoutes'

/**
 * The persistent desktop rail (UI-F01).
 *
 * WHAT IT IS PROTECTING. The signed-in frame was the phone frame at every
 * width — a five-tab bar pinned to the bottom of a desktop monitor with the
 * content in one column above it — and the owner's 10 August 2026 direction
 * makes a real desktop shell the first item of UI finalisation. Two properties
 * decide whether that shell is honest, and neither can be seen in a screenshot:
 * that the rail offers the SAME global destinations as the bar rather than a
 * second information architecture, and that it offers no destination that
 * renders nothing.
 *
 * WIDTH IS NOT TESTED HERE, DELIBERATELY. Which of the two navigations is
 * visible is a CSS media query, and jsdom applies no CSS module styles — a test
 * asserting visibility here would assert nothing. The rule it enforces instead
 * is the one a media query cannot get wrong on its own: that both are rendered,
 * so no JavaScript width measurement decides navigation and neither can go
 * missing at a size nobody tested.
 */

const BASE = '/competitions/premier-league/2026-27'

function rail(pathname: string) {
  return (
    <MemoryRouter initialEntries={[pathname]}>
      <SideRail
        groups={railGroups(pathname)}
        pathname={pathname}
        collapsed={false}
        onToggleCollapsed={() => {}}
      />
    </MemoryRouter>
  )
}

describe('the desktop rail carries the global destinations', () => {
  it('opens with the bottom bar’s five, in the bar’s order', () => {
    render(rail('/'))
    const nav = screen.getByRole('navigation', { name: 'Sections' })
    const first = within(nav).getAllByRole('link').slice(0, 4)
    expect(first.map((link) => link.textContent)).toEqual([
      'Home',
      'Play',
      'Matches',
      // The one label that differs, as the direction specifies: there is room
      // on desktop for the distinction between a private league and a
      // competition to be made.
      'Leagues & Competitions',
    ])
  })

  it('marks exactly the destination the player is on', () => {
    render(rail(`${BASE}/matches`))
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current.map((link) => link.textContent)).toEqual(['Matches'])
    // The competition's own Matches, not the global one: matching is exact, so
    // a parent and its child cannot both light up.
    expect(current[0]?.getAttribute('href')).toBe(`${BASE}/matches`)
  })

  it('expands only the competition the player is inside', () => {
    render(rail(`${BASE}/games/lms`))
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toContain(`${BASE}/games/lms`)
    expect(hrefs).toContain(`${BASE}/leagues`)
    // The other competition is listed, but not expanded — a rail that opened
    // every competition at once would be a sitemap.
    expect(hrefs).toContain('/competitions/scottish-premiership/2026-27')
    expect(hrefs).not.toContain('/competitions/scottish-premiership/2026-27/games/lms')
  })

  it('offers no destination that renders nothing', () => {
    // The Match Predictor route answers NotFoundPage while
    // VITE_UI_SEASON_MATCH_PREDICTOR is off, which it is everywhere today. A
    // rail entry for it would be the dead control the last batch removed nine
    // of.
    render(rail(BASE))
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).not.toContain(`${BASE}/games/match-predictor`)
  })

  it('claims no membership', () => {
    // The catalogue's `joined` flags are presentation placeholders. The group
    // is headed by what the platform runs, never by what the player has
    // entered.
    render(rail('/'))
    expect(screen.getByRole('heading', { name: 'Competitions' })).toBeInTheDocument()
    expect(screen.queryByText(/your competitions/i)).not.toBeInTheDocument()
  })
})

describe('the rail collapses without losing its names', () => {
  it('keeps every link named when only the icon is visible', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SideRail
          groups={railGroups('/')}
          pathname="/"
          collapsed
          onToggleCollapsed={() => {}}
        />
      </MemoryRouter>,
    )

    // An icon-only rail whose links have no accessible name is the commonest
    // way this component fails an audit. The group headings survive too — the
    // grouping is the same navigation either way, and only the room for a word
    // has gone.
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Leagues & Competitions' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Competitions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument()
  })

  it('drops the nested destinations rather than drawing them as identical dots', () => {
    // Found by looking at it. A section has no icon of its own, so in a 64px
    // rail the nested links rendered as a column of 4px dots whose only label
    // was a tooltip — nine indistinguishable targets. The control that reveals
    // them is immediately below, so hiding them is the honest answer.
    const pathname = `${BASE}/games/lms`
    render(
      <MemoryRouter initialEntries={[pathname]}>
        <SideRail
          groups={railGroups(pathname)}
          pathname={pathname}
          collapsed
          onToggleCollapsed={() => {}}
        />
      </MemoryRouter>,
    )
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toContain(BASE)
    expect(hrefs).not.toContain(`${BASE}/games/lms`)
  })

  it('gives each competition its own initials rather than a shared icon', () => {
    // Two competitions drawn as the same globe are indistinguishable when the
    // name is only a tooltip. Also found by looking at it.
    render(rail('/'))
    expect(screen.getByText('PL')).toBeInTheDocument()
    expect(screen.getByText('SP')).toBeInTheDocument()
  })

  it('offers the collapse control by name when open', () => {
    render(rail('/'))
    const toggle = screen.getByRole('button', { name: 'Collapse navigation' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('the shell renders both navigations', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
  })
  afterEach(() => {
    globalThis.localStorage?.clear()
  })

  it('keeps the bar and the rail both mounted, so CSS alone decides which is seen', () => {
    const pathname = `${BASE}/games/lms`
    render(
      <MemoryRouter initialEntries={[pathname]}>
        <PageShell
          active={globalNavTab(pathname)}
          rail={
            <SideRail
              groups={railGroups(pathname)}
              pathname={pathname}
              collapsed={false}
              onToggleCollapsed={() => {}}
            />
          }
        >
          <p>Route content</p>
        </PageShell>
      </MemoryRouter>,
    )

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument()
    // And the content is still the main landmark, reachable by the skip link.
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })
})
