import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { PageShell } from '../../src/design-system/PageShell'
import { SideRail } from '../../src/design-system/SideRail'
import { railGroups } from '../../src/app/railDestinations'
import { siteConfiguration } from '../../src/app/site/siteConfiguration'

/** The weekly platform, which is also what an unset site variant resolves to. */
const HUB_SITE = siteConfiguration('hub')
import { globalNavTab } from '../../src/app/shellRoutes'
import { twentyCompetitionPlayer } from '../../src/dev/scaleFixture'
import {
  COMPETITION_SHORTCUT_LIMIT,
  presentPlayerCompetitions,
} from '../../src/features/hub/playerCompetitions'

/**
 * The persistent desktop rail (`UI-F01`), against the navigation authority of
 * 10 August 2026 and its binding twenty-competition scalability contract.
 *
 * WHAT CHANGED, AND WHY THESE ASSERTIONS EXIST. The first implementation
 * expanded the competition the player was inside into Overview / Play /
 * Matches / Games / Leagues. The authority forbids that outright: the rail is
 * permanently global, a competition shortcut opens that competition's Overview
 * and nothing deeper, and the competition's own sections live under its
 * masthead in the content column. Two navigations answering the same question
 * is the defect; the one in the content column is the one that belongs to the
 * competition. Half of this file is the record that the tree is gone.
 *
 * THE FIXTURE IS TWENTY COMPETITIONS, NOT TWO. With the real catalogue's two
 * entries, a bounded list and an unbounded one are indistinguishable, so every
 * scalability property here would pass by accident. The player plays in three
 * of the twenty, and they are deliberately not the first three.
 *
 * WIDTH IS NOT TESTED HERE. Which of the two navigations is visible is a CSS
 * media query and jsdom applies no CSS module styles. The rule enforced instead
 * is the one a media query cannot get wrong on its own: that both are rendered,
 * so no JavaScript width measurement decides navigation.
 */

const BASE = '/competitions/premier-league/2026-27'
const PLAYER = twentyCompetitionPlayer()

function rail(pathname: string, player: typeof PLAYER | null = PLAYER) {
  return (
    <MemoryRouter initialEntries={[pathname]}>
      <SideRail
        groups={railGroups(player, HUB_SITE)}
        pathname={pathname}
        collapsed={false}
        onToggleCollapsed={() => {}}
      />
    </MemoryRouter>
  )
}

describe('the rail is permanently global', () => {
  it('opens with the bottom bar’s destinations, in the bar’s order and words', () => {
    render(rail('/'))
    const nav = screen.getByRole('navigation', { name: 'Sections' })
    const first = within(nav).getAllByRole('link').slice(0, 4)
    expect(first.map((link) => link.textContent)).toEqual([
      'Home',
      'Play',
      'Matches',
      // "Leagues", not "Leagues & Competitions". The widened desktop label was
      // reverted by the authority: the page explains the difference between a
      // private league and a private LMS or Championship competition, and a
      // navigation label is a worse place to teach it.
      'Leagues',
    ])
  })

  it('never expands a competition into its sections or games', () => {
    // The defect this replaced. Standing inside a game, deep in a competition,
    // is exactly when the old implementation grew the tree.
    render(rail(`${BASE}/games/lms`))
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))

    expect(hrefs).toContain(BASE)
    for (const section of ['/play', '/matches', '/games', '/leagues', '/games/lms']) {
      expect(hrefs).not.toContain(`${BASE}${section}`)
    }
  })

  it('marks the competition shortcut only on the competition’s own address', () => {
    // Exact matching on the shortcut's own href. Deep inside the competition
    // nothing in the rail is current, because the rail is not where the player
    // is — the competition sub-navigation is.
    render(rail(BASE))
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current.map((link) => link.getAttribute('href'))).toEqual([BASE])
  })
})

describe('the rail is bounded for a platform of twenty competitions', () => {
  it('shows only the competitions the player plays in', () => {
    render(rail('/'))
    const nav = screen.getByRole('navigation', { name: 'Sections' })
    expect(within(nav).getByRole('heading', { name: 'My competitions' })).toBeInTheDocument()

    // Three of twenty. Seventeen published competitions the player does not
    // play in are absent — that is the whole requirement.
    expect(within(nav).getByRole('link', { name: 'Premier League' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Scottish Premiership' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Champions League' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Serie A' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'MLS' })).not.toBeInTheDocument()
  })

  it('never renders more shortcuts than the bound, however many the player plays', () => {
    // Every competition joined. A rail that simply listed them would be twenty
    // rows tall, which is the failure the bound exists to prevent.
    const everything = presentPlayerCompetitions(
      PLAYER.catalogue,
      PLAYER.catalogue.map((competition) => ({
        seasonName: competition.seasonRowName,
        tournamentId: `season-${competition.competitionSlug}`,
        seasonStatus: 'active' as const,
        seasonGames: {
          competitionMember: true,
          serverNow: null,
          games: [
            {
              id: `${competition.competitionSlug}-mp`,
              gameKey: 'main_predictor' as const,
              active: true,
              displayName: 'Match Predictor',
              registrationOpensAt: null,
              registrationClosesAt: null,
              completedAt: null,
              allowRejoin: true,
              membership: {
                status: 'active',
                joinedAt: null,
                leftAt: null,
                disqualifiedAt: null,
              },
            },
          ],
        },
      })),
    )
    expect(everything.mine.length).toBe(20)
    expect(everything.shortcuts.length).toBe(COMPETITION_SHORTCUT_LIMIT)
    expect(everything.overflow).toBe(20 - COMPETITION_SHORTCUT_LIMIT)

    render(rail('/', everything))
    const nav = screen.getByRole('navigation', { name: 'Sections' })
    // Four main destinations, the bounded shortcuts, the Explore link, and the
    // three More destinations. Nothing else, at any catalogue size.
    expect(within(nav).getAllByRole('link')).toHaveLength(4 + COMPETITION_SHORTCUT_LIMIT + 1 + 3)
  })

  it('always offers the catalogue, and never renders it', () => {
    render(rail('/'))
    const nav = screen.getByRole('navigation', { name: 'Sections' })
    expect(within(nav).getByRole('link', { name: 'All competitions' })).toHaveAttribute(
      'href',
      '/competitions',
    )
  })

  it('offers only the catalogue link before membership is known', () => {
    // While the read is in flight or after it fails, claiming a competition is
    // the player's would be asserting membership nothing confirmed.
    render(rail('/', null))
    const nav = screen.getByRole('navigation', { name: 'Sections' })
    expect(within(nav).getByRole('link', { name: 'All competitions' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Premier League' })).not.toBeInTheDocument()
  })
})

describe('the rail collapses without losing its names', () => {
  it('keeps every link named when only the icon is visible', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SideRail
          groups={railGroups(PLAYER, HUB_SITE)}
          pathname="/"
          collapsed
          onToggleCollapsed={() => {}}
        />
      </MemoryRouter>,
    )

    // An icon-only rail whose links have no accessible name is the commonest
    // way this component fails an audit. The group headings survive too.
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Leagues' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'My competitions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument()
  })

  it('gives each competition its own initials rather than a shared icon', () => {
    // Two competitions drawn as the same globe are indistinguishable when the
    // name is only a tooltip. Found by looking at it.
    render(rail('/'))
    expect(screen.getByText('PL')).toBeInTheDocument()
    expect(screen.getByText('SP')).toBeInTheDocument()
    expect(screen.getByText('CL')).toBeInTheDocument()
  })

  it('offers the collapse control by name when open', () => {
    render(rail('/'))
    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
})

describe('the shell renders both navigations', () => {
  it('keeps the bar and the rail both mounted, so CSS alone decides which is seen', () => {
    const pathname = `${BASE}/games/lms`
    render(
      <MemoryRouter initialEntries={[pathname]}>
        <PageShell
          active={globalNavTab(pathname)}
          rail={
            <SideRail
              groups={railGroups(PLAYER, HUB_SITE)}
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
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })
})
