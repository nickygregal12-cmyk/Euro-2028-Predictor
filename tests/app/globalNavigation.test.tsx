import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { PageShell } from '../../src/design-system/PageShell'
import { globalNavTab, isCompetitionModePath } from '../../src/app/shellRoutes'

/**
 * The global navigation, and the rule that it is global.
 *
 * WHY THIS FILE EXISTS. `AppShell` hid the whole bottom bar for every
 * `/competitions/**` route, so a player who tapped through to a game lost all
 * five destinations at once. Nothing tested it — `isCompetitionModePath` had no
 * test of its own and `showBottomNav` had no coverage anywhere — so the only
 * record of the behaviour was one browser assertion that the bar was ABSENT.
 * The design authority requires the opposite: the global destinations "remain
 * visible inside competition context" and the rail "never swaps its
 * destinations".
 *
 * The tab resolution is tested as a pure function rather than by mounting the
 * shell, which needs auth, theme and a router; what the shell contributes is
 * the one fact that cannot be asserted on a string — that the bar renders at
 * all — and `PageShell` is where that is decided.
 */

const BASE = '/competitions/premier-league/2026-27'

describe('global navigation', () => {
  it('renders the bar on every route, competition included', () => {
    render(
      <MemoryRouter initialEntries={[`${BASE}/games/lms`]}>
        <PageShell active={globalNavTab(`${BASE}/games/lms`)}>
          <p>Route content</p>
        </PageShell>
      </MemoryRouter>,
    )

    const primary = screen.getByRole('navigation', { name: 'Primary' })
    const labels = [...primary.querySelectorAll('a')].map((link) => link.textContent)
    expect(labels).toEqual(['Home', 'Play', 'Matches', 'Leagues', 'More'])

    // And the tab the player is on is the one marked, so the bar orients rather
    // than merely being present.
    expect(screen.getByRole('link', { name: 'Play' }).getAttribute('aria-current')).toBe('page')
  })

  it('maps a competition section back to the global tab that leads to it', () => {
    // The chooser sends Play/Matches/Leagues into the matching competition
    // section, so the section highlights the tab that led there.
    expect(globalNavTab(`${BASE}/matches`)).toBe('matches')
    expect(globalNavTab(`${BASE}/leagues`)).toBe('league')
    expect(globalNavTab(`${BASE}/play`)).toBe('predict')
  })

  it('treats a game route as Play and a competition landing as Home', () => {
    expect(globalNavTab(`${BASE}/games/lms`)).toBe('predict')
    expect(globalNavTab(`${BASE}/games/match-predictor`)).toBe('predict')
    expect(globalNavTab(`${BASE}/games/match-predictor/standings`)).toBe('predict')
    expect(globalNavTab(BASE)).toBe('home')
    expect(globalNavTab(`${BASE}/games`)).toBe('home')
  })

  it('matches deep global routes by prefix, which exact equality never did', () => {
    expect(globalNavTab('/league/private-1')).toBe('league')
    expect(globalNavTab('/h2h/player-2')).toBe('league')
    expect(globalNavTab('/match/m-1')).toBe('matches')
    expect(globalNavTab('/profile/player-2')).toBe('more')
    expect(globalNavTab('/more/scoring')).toBe('more')
    expect(globalNavTab('/account')).toBe('more')
  })

  it('resolves the five global roots to their own tabs', () => {
    expect(globalNavTab('/')).toBe('home')
    expect(globalNavTab('/play')).toBe('predict')
    expect(globalNavTab('/matches')).toBe('matches')
    expect(globalNavTab('/leagues')).toBe('league')
    expect(globalNavTab('/more')).toBe('more')
  })

  it('recognises a competition path only with both slugs present', () => {
    expect(isCompetitionModePath(BASE)).toBe(true)
    expect(isCompetitionModePath(`${BASE}/games/lms`)).toBe(true)
    expect(isCompetitionModePath('/competitions/premier-league')).toBe(false)
    expect(isCompetitionModePath('/competitions')).toBe(false)
    expect(isCompetitionModePath('/leagues')).toBe(false)
  })
})
