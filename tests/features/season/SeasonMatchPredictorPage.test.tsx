import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { createSeasonMatchPredictorGateway } from '../../../src/dev/seasonMatchPredictorGateway'
import { MATCHWEEK_COUNT, instantFor } from '../../../src/dev/seasonPreviewFixture'
import { SeasonMatchPredictorPage } from '../../../src/features/season/SeasonMatchPredictorPage'
import type { SeasonLmsRegistrationGateway } from '../../../src/features/season/lmsRegistrationModel'
import { seasonShellDestinations } from '../../../src/features/season/seasonDestinations'

/**
 * The Match Predictor card's shell and its entry path.
 *
 * The save behaviour is covered by `seasonMatchPredictorSave.test.ts` against
 * the hook; this file is about what the page asserts around the card — whose
 * competition it says this is, where the sub-navigation goes, and whether a
 * player who is not entered is told before they fill a matchweek in.
 */

const BEFORE_LOCK = () => instantFor(1, -180)
const BASE = '/competitions/premier-league/2026-27'

function registrationGateway(entered: boolean): SeasonLmsRegistrationGateway {
  return {
    load: async () => ({
      competitionId: 'main-predictor',
      entered,
      joinedAt: null,
      registrationOpensAt: '2020-01-01T00:00:00Z',
      registrationClosesAt: '2099-01-01T00:00:00Z',
      completedAt: null,
      serverNow: '2026-08-06T12:00:00Z',
    }),
    join: vi.fn(async () => {}),
  }
}

function renderPage(
  props: Partial<React.ComponentProps<typeof SeasonMatchPredictorPage>> = {},
) {
  const gateway = createSeasonMatchPredictorGateway({ now: BEFORE_LOCK() })
  render(
    <MemoryRouter>
      <SeasonMatchPredictorPage
        gateway={gateway}
        matchweek={1}
        competitionName="Premier League"
        seasonLabel="2026/27"
        destinations={seasonShellDestinations(BASE)}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('the Match Predictor card shell', () => {
  it('names the real competition while the card is still loading', async () => {
    // It used to render "Loading competition" over the season label "Season" —
    // furniture asserting something untrue while the read was in flight. The
    // route resolves the competition before this page mounts, so the name is a
    // fact by the time it is shown.
    renderPage({
      gateway: { load: () => new Promise(() => {}), apply: async () => {} },
    })

    expect(screen.getByText('Premier League')).toBeTruthy()
    expect(screen.queryByText('Loading competition')).toBeNull()
    expect(screen.queryByText('Season')).toBeNull()
  })

  it('keeps the competition named when the card fails to load', async () => {
    // A failed matchweek is still the player's competition; "Match Predictor"
    // over "Season" read like an error page belonging to nobody.
    renderPage({
      gateway: {
        load: async () => {
          throw new Error('offline')
        },
        apply: async () => {},
      },
    })

    expect(await screen.findByText('This matchweek is unavailable')).toBeTruthy()
    expect(screen.getByText('Premier League')).toBeTruthy()
  })

  it('offers every section of the competition from the card', async () => {
    renderPage()

    const matches = await screen.findByRole('link', { name: 'Matches' })
    expect(matches.getAttribute('href')).toBe(`${BASE}/matches`)
    expect(screen.getByRole('link', { name: 'Leagues' }).getAttribute('href')).toBe(
      `${BASE}/leagues`,
    )
  })
})

describe('the Match Predictor entry path', () => {
  it('offers a join to a player who holds no entry', async () => {
    // `get_season_matchweek_card` answers a non-entrant with an ordinary card —
    // `card_status` is `no_submission`, which is also what an entered player
    // with nothing saved gets — so without this the card invites a whole
    // matchweek of predictions and the first save is refused.
    renderPage({ registration: registrationGateway(false) })

    expect(
      await screen.findByRole('button', { name: 'Join' }, { timeout: 5_000 }),
    ).toBeTruthy()
  })

  it('says nothing at all once the player is entered', async () => {
    // Membership has one statement, and it is not this panel's; two components
    // asserting it from two reads is how they come to disagree on screen.
    renderPage({ registration: registrationGateway(true) })

    await waitFor(() => expect(screen.getByText('Premier League')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull()
  })

  it('renders the card without a registration gateway, for the DEV harness', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Premier League')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull()
  })
})

describe('moving between matchweeks', () => {
  const href = (matchweek: number) => `${BASE}/games/match-predictor?matchweek=${matchweek}`

  it('offers no previous at the first matchweek, and does not grey one out', async () => {
    renderPage({ matchweek: 1, matchweekHref: href })

    await screen.findByRole('navigation', { name: 'Matchweek' })
    expect(screen.queryByRole('link', { name: 'Previous matchweek' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Next matchweek' }).getAttribute('href')).toBe(
      href(2),
    )
  })

  it('steps both ways in the middle of a season', async () => {
    renderPage({ matchweek: 5, matchweekHref: href })

    const previous = await screen.findByRole('link', { name: 'Previous matchweek' })
    expect(previous.getAttribute('href')).toBe(href(4))
    expect(screen.getByRole('link', { name: 'Next matchweek' }).getAttribute('href')).toBe(
      href(6),
    )
  })

  it('offers no next at the last matchweek the season actually has', async () => {
    // The bound is the card read's own `of`, not a number this page invented.
    renderPage({ matchweek: MATCHWEEK_COUNT, matchweekHref: href })

    await screen.findByRole('navigation', { name: 'Matchweek' })
    expect(screen.queryByRole('link', { name: 'Next matchweek' })).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Previous matchweek' }).getAttribute('href'),
    ).toBe(href(MATCHWEEK_COUNT - 1))
  })

  it('says the matchweek once, not twice', async () => {
    renderPage({ matchweek: 5, matchweekHref: href })

    // The status strip drops its copy when the stepper carries one, so the
    // page does not print "Matchweek 5 of 38" in two places.
    await screen.findByRole('navigation', { name: 'Matchweek' })
    expect(screen.getAllByText(`Matchweek 5 of ${MATCHWEEK_COUNT}`)).toHaveLength(1)
  })

  it('keeps the status strip copy where there is no stepper', async () => {
    renderPage({ matchweek: 5 })

    expect(await screen.findByText(`Matchweek 5 of ${MATCHWEEK_COUNT}`)).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Matchweek' })).toBeNull()
  })
})

describe('no control on the card is disabled', () => {
  /**
   * The rule batch I set on the competition dashboard, applied to the surface a
   * player spends most of their time on. A disabled button cannot be told apart
   * from a broken one, so anything the server would refuse is a sentence.
   */
  it('renders no disabled control anywhere on a normal editable card', async () => {
    renderPage({ matchweek: 1 })

    await screen.findByRole('region', { name: 'Matchweek 1 card' })
    const disabled = [...document.body.querySelectorAll('button, a, input')]
      .filter(
        (node) => node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true',
      )
      // ONE EXCEPTION, NAMED RATHER THAN GLOSSED. A score stepper's "−" greys at
      // zero, which is a bound on an increment rather than a refused action: the
      // pair must hold its place while a player taps, and removing an arrow
      // mid-edit would shift every row under their thumb. Everything else here
      // is an action, and an action the server would refuse is a sentence.
      .filter((node) => !/^(Add one to|Subtract one from) /.test(node.ariaLabel ?? ''))

    expect(disabled.map((node) => node.textContent)).toEqual([])
  })

  it('states a confirmed card rather than greying the button that confirmed it', async () => {
    renderPage({ matchweek: 1 })

    // Nothing is entered yet, so confirming is refused — and the refusal is the
    // model's own sentence rather than an unpressable primary button.
    expect(
      await screen.findByText('Enter at least one prediction before confirming the card.'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirm card' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Card confirmed' })).toBeNull()
  })
})
