import { render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { VNextHome } from '../../src/vnext/home/VNextHome'
import { LeagueRace } from '../../src/vnext/home/LeagueRace'
import {
  pickDecisionMatch,
  pickFeaturedLiveMatch,
  pickHeadlineLeague,
  selectHomeEmphasis,
} from '../../src/vnext/home/selectHomeEmphasis'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { workshopPeople } from '../../src/vnext/fixtures/players/people'
import {
  competitionHomeModel,
  decisionHomeModel,
  homeScenarios,
  newSeasonHomeModel,
  workshopHomeModel,
} from '../../src/vnext/fixtures'
import type { HomeModel, PrivateLeague } from '../../src/vnext/models/home'

/**
 * WHAT IS WORTH GUARDING NOW THAT HOME IS SELECTED.
 *
 * Stage 3's suite guarded almost nothing about the three concepts, on purpose:
 * they existed to be compared and discarded, and freezing their structure would
 * have turned an exploration into an authority. Home is the opposite — it is
 * the surface every other vNext page will inherit from — so these assertions
 * are stronger. They are still not a DOM snapshot: composition, overflow and
 * width behaviour are measured in a real browser by `e2e/vnext-home.spec.ts`,
 * because jsdom evaluates no container query and computes no layout, and a
 * frozen render tree would fail on every deliberate improvement.
 *
 * What is held here is the set of promises that must survive any redesign of
 * the page:
 *
 *   1. the emphasis selector answers a PRESENTATION question, from supplied
 *      state, and never infers a game rule;
 *   2. Home consumes the presentation model rather than a scenario-specific
 *      shape — all four scenarios render from one component;
 *   3. provisional points are never presented as awarded;
 *   4. state is stated in WORDS, not carried by colour alone;
 *   5. the social gaps and rank movement the model supplies actually render;
 *   6. the accessibility floor the foundation set;
 *   7. reduced motion changes the animation and never the content.
 */

const SCENARIOS = [
  { name: 'live matchday', model: workshopHomeModel, emphasis: 'live' },
  { name: 'decision', model: decisionHomeModel, emphasis: 'decision' },
  { name: 'competition', model: competitionHomeModel, emphasis: 'competition' },
  { name: 'new season', model: newSeasonHomeModel, emphasis: 'competition' },
] as const

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])
/** jsdom has no layout, so it can neither confirm nor deny a contrast ratio. */
const JSDOM_CANNOT_EVALUATE = new Set(['color-contrast'])

async function scan(ui: ReactElement) {
  const { unmount } = render(ui)
  try {
    const results = await axe.run(document.body, {
      runOnly: { type: 'tag', values: TAGS },
    })
    const failing = [
      ...results.violations,
      ...results.incomplete.filter((result) => !JSDOM_CANNOT_EVALUATE.has(result.id)),
    ].filter((result) => result.impact && FAIL_IMPACTS.has(result.impact))

    expect(
      failing,
      failing
        .map(
          (violation) =>
            `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
              .slice(0, 3)
              .map((node) => node.html.slice(0, 140))
              .join(' | ')}`,
        )
        .join('\n'),
    ).toEqual([])
  } finally {
    unmount()
  }
}

function renderHome(model: HomeModel) {
  return render(
    <VNextRoot>
      <VNextHome model={model} />
    </VNextRoot>,
  )
}

/* ------------------------------------------------------------------------ *
 * The emphasis selector
 * ------------------------------------------------------------------------ */

describe('selectHomeEmphasis', () => {
  it.each(SCENARIOS)('gives $name the $emphasis emphasis', (scenario) => {
    expect(selectHomeEmphasis(scenario.model)).toBe(scenario.emphasis)
  })

  it('reads the model’s own live partition rather than comparing clocks', () => {
    // The decisive proof that this is presentation and not a rule: a model that
    // says a match is live gets the live emphasis even though the fixture's
    // kick-off is in the future by the model's own instant. Deciding otherwise
    // would mean Home had formed its own opinion about when a match starts.
    const future: HomeModel = {
      ...decisionHomeModel,
      liveMatches: [
        { ...workshopHomeModel.liveMatches[0], kickoff: '2099-01-01T00:00:00.000Z' },
      ],
    }
    expect(selectHomeEmphasis(future)).toBe('live')
  })

  it('does not treat a non-football action as a decision', () => {
    // `joinLeague` is an errand, not a prediction, so it never claims the
    // dominant zone however urgent the model marks it.
    const errand: HomeModel = {
      ...newSeasonHomeModel,
      primaryAction: {
        ...newSeasonHomeModel.primaryAction,
        urgency: 'urgent',
      },
    }
    expect(selectHomeEmphasis(errand)).toBe('competition')
  })

  it('falls back to competition when there is no fixture to build a hero from', () => {
    const nothingToPredict: HomeModel = {
      ...decisionHomeModel,
      upcomingMatches: [],
    }
    expect(selectHomeEmphasis(nothingToPredict)).toBe('competition')
  })

  it('stages the model’s featured live match, and an unpredicted decision', () => {
    expect(pickFeaturedLiveMatch(workshopHomeModel)?.isFeatured).toBe(true)
    expect(pickFeaturedLiveMatch(decisionHomeModel)).toBeNull()

    const decision = pickDecisionMatch(decisionHomeModel)
    expect(decision?.prediction, 'the decision is the one still to be made').toBeNull()
  })

  it('leads with the league where the user is closest to a place', () => {
    // Work League: two points behind. Sunday league: already won. The chase is
    // the headline, and leading a league is not a battle.
    expect(pickHeadlineLeague(workshopHomeModel)?.id).toBe('league-work')
    expect(pickHeadlineLeague(newSeasonHomeModel)).toBeNull()
  })
})

/* ------------------------------------------------------------------------ *
 * One Home, every scenario
 * ------------------------------------------------------------------------ */

describe.each(SCENARIOS)('Home — $name', (scenario) => {
  it('has no serious accessibility failures', async () => {
    await scan(
      <VNextRoot>
        <VNextHome model={scenario.model} />
      </VNextRoot>,
    )
  })

  it('renders one main landmark, one heading and named navigation', () => {
    renderHome(scenario.model)

    expect(screen.getAllByRole('main')).toHaveLength(1)

    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings, 'exactly one page heading').toHaveLength(1)
    expect(headings[0].textContent).toBe(scenario.model.competition.matchweekLabel)

    // Both navigation shapes are rendered and CSS hides one, so jsdom — which
    // applies no stylesheet — legitimately sees both. Which one is real at a
    // given width is measured in a browser.
    const navigations = screen.getAllByRole('navigation')
    expect(navigations.length).toBeGreaterThan(0)
    for (const nav of navigations) {
      expect(nav.getAttribute('aria-label')?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('gives every control an accessible name', () => {
    renderHome(scenario.model)
    for (const control of screen.getAllByRole('button')) {
      expect(
        (control.getAttribute('aria-label') ?? control.textContent ?? '').trim().length,
        `a control on the ${scenario.name} Home has no accessible name`,
      ).toBeGreaterThan(0)
    }
  })

  it('offers no control on a fixture that is not happening', () => {
    // A postponed match has nothing the user can do about it, and a button
    // labelled with a verb the product cannot honour is worse than a row that
    // says the match is off.
    const withPostponed: HomeModel = {
      ...scenario.model,
      upcomingMatches: [
        ...scenario.model.upcomingMatches,
        {
          ...(scenario.model.upcomingMatches[0] ??
            workshopHomeModel.upcomingMatches[0]),
          id: 'postponed-under-test',
          status: 'postponed',
          clock: null,
          score: null,
          lockAt: null,
        },
      ],
    }
    renderHome(withPostponed)

    expect(screen.getByText('Not going ahead')).toBeInTheDocument()
    for (const control of screen.getAllByRole('button')) {
      expect(control.getAttribute('aria-label') ?? '').not.toContain(
        'postponed-under-test',
      )
    }
  })

  it('renders identical content on the reduced-motion path', () => {
    const { unmount } = render(
      <VNextRoot motion="full">
        <VNextHome model={scenario.model} />
      </VNextRoot>,
    )
    const full = document.body.textContent
    unmount()

    render(
      <VNextRoot motion="reduced">
        <VNextHome model={scenario.model} />
      </VNextRoot>,
    )
    expect(document.body.textContent).toBe(full)
  })
})

/* ------------------------------------------------------------------------ *
 * The rules presentation may not break
 * ------------------------------------------------------------------------ */

describe('Home never presents provisional points as awarded', () => {
  it('qualifies every provisional figure on the live matchday', () => {
    renderHome(workshopHomeModel)
    const body = document.body.textContent ?? ''

    // The fixture puts 6 points on the pitch across two live matches. Wherever
    // Home shows that figure it must qualify it, because the backend awards
    // points and presentation may not imply otherwise.
    expect(body).toMatch(/on the pitch/i)
    expect(body).toMatch(/provisional/i)
  })

  it('says nothing is provisional when nothing is in play', () => {
    for (const model of [decisionHomeModel, competitionHomeModel, newSeasonHomeModel]) {
      const { unmount } = renderHome(model)
      expect(document.body.textContent ?? '').not.toMatch(/on the pitch/i)
      unmount()
    }
  })

  it('marks a settled prediction as banked rather than provisional', () => {
    renderHome(competitionHomeModel)
    const body = document.body.textContent ?? ''
    expect(body).not.toMatch(/provisional/i)
  })
})

describe('Home states football and rival state in words, not only colour', () => {
  it('writes the live state, the deadline and the gap on a matchday', () => {
    renderHome(workshopHomeModel)
    const body = document.body.textContent ?? ''

    expect(body, 'live state').toMatch(/live|half time/i)
    expect(body, 'the outstanding deadline').toMatch(/38 min/)
    expect(body, 'the rival two points ahead').toMatch(/Jamie/)
    expect(body, 'the gap, as a sentence').toMatch(/2 pts to catch/i)
  })

  it('names who can catch the user, not only who the user is chasing', () => {
    // The half of a league race a ladder never says, and the reason the
    // competitive module exists at all.
    renderHome(workshopHomeModel)
    expect(document.body.textContent ?? '').toMatch(/Martin Okafor/)
  })

  it('writes the countdown on the decision hero', () => {
    renderHome(decisionHomeModel)
    const body = document.body.textContent ?? ''
    expect(body).toMatch(/55 min/)
    expect(body).toMatch(/until predictions close/i)
  })
})

describe('Home renders the social state the model supplied', () => {
  it('shows the user’s rank, movement and points from one model', () => {
    renderHome(workshopHomeModel)
    const body = document.body.textContent ?? ''
    expect(body).toContain('1,428th')
    expect(body).toContain('125')
    expect(body).toContain('Work League')
  })

  it('marks the user’s own row, and marks it with a word', () => {
    const { container } = renderHome(competitionHomeModel)
    const current = container.querySelectorAll('[aria-current="true"]')
    expect(current.length).toBeGreaterThan(0)
    for (const row of current) {
      expect(within(row as HTMLElement).getByText('You')).toBeInTheDocument()
    }
  })

  it('describes rank movement as a sentence for assistive technology', () => {
    renderHome(workshopHomeModel)
    expect(screen.getAllByText(/You moved up 214 places/).length).toBeGreaterThan(0)
  })

  it('draws a written empty state rather than a blank panel with no league', () => {
    renderHome(newSeasonHomeModel)
    expect(
      screen.getAllByText(/not in a private league yet/i).length,
    ).toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------------ *
 * The league race names the player actually next in line
 * ------------------------------------------------------------------------ */

describe('LeagueRace chases the adjacent rank', () => {
  /**
   * A table long enough for the window to clamp, with the user LAST.
   *
   * `raceWindow` slices the final three rows, so the user sits at the END of an
   * ascending window rather than in the middle: [4th, 5th, YOU]. That is the
   * shape where "the first row ranked above me" and "the row immediately above
   * me" stop being the same answer, and where naming the wrong one both credits
   * the wrong rival and overstates the gap the user is facing.
   */
  const bottomOfTheTable: PrivateLeague = {
    id: 'league-clamped',
    name: 'Clamped League',
    participantCount: 6,
    userRank: 6,
    userPoints: 100,
    userMovement: { direction: 'down', places: 1 },
    gapToLeader: 40,
    leaderName: 'Jamie Ferguson-Whyte',
    standings: [
      {
        player: workshopPeople.jamie,
        rank: 3,
        points: 140,
        movement: { direction: 'none', places: 0 },
        isUser: false,
      },
      {
        player: workshopPeople.martin,
        rank: 4,
        points: 130,
        movement: { direction: 'none', places: 0 },
        isUser: false,
      },
      {
        player: workshopPeople.bea,
        rank: 5,
        points: 104,
        movement: { direction: 'none', places: 0 },
        isUser: false,
      },
      {
        player: workshopPeople.user,
        rank: 6,
        points: 100,
        movement: { direction: 'down', places: 1 },
        isUser: true,
      },
    ],
  }

  it.each(['race', 'strip'] as const)(
    'names the immediately preceding rank, not the top of the window (%s)',
    (variant) => {
      render(
        <VNextRoot>
          <LeagueRace league={bottomOfTheTable} variant={variant} />
        </VNextRoot>,
      )
      const body = document.body.textContent ?? ''

      // Bea is 5th on 104 — four points up, and the place actually available.
      expect(body, 'chases the adjacent player').toMatch(/4 pts to catch Bea/)

      // Martin is 4th on 130. Naming him would be a 30-point gap the user is
      // not facing, and a place they cannot take without passing Bea first.
      expect(body, 'does not skip a place').not.toMatch(/to catch Martin/)
      expect(body, 'does not quote the two-places-up gap').not.toMatch(/30 pts/)
    },
  )

  it('still names the immediately following rank below the user', () => {
    // The user in the middle of a window: [above, YOU, below]. `below` was
    // already correct and must stay correct — the fix is only about `above`.
    const midTable: PrivateLeague = {
      ...bottomOfTheTable,
      userRank: 4,
      userPoints: 130,
      standings: bottomOfTheTable.standings.map((standing) => ({
        ...standing,
        isUser: standing.player.id === workshopPeople.martin.id,
      })),
    }
    render(
      <VNextRoot>
        <LeagueRace league={midTable} variant="race" />
      </VNextRoot>,
    )
    const body = document.body.textContent ?? ''

    expect(body, 'chases the rank directly above').toMatch(/10 pts to catch Jamie/)
    expect(body, 'names the rank directly below').toMatch(/Bea is 26 pts behind you/)
  })
})

/* ------------------------------------------------------------------------ *
 * One component, one model
 * ------------------------------------------------------------------------ */

describe('Home consumes the presentation model', () => {
  it('renders every scenario from the same component and the same schema', () => {
    // The claim the whole state-adaptive design rests on: there is one Home,
    // not three. If a scenario ever needed its own component this would be the
    // test that had to change to allow it.
    for (const [name, model] of Object.entries(homeScenarios)) {
      const { unmount } = renderHome(model)
      expect(
        screen.getAllByRole('heading', { level: 1 })[0].textContent,
        `${name} did not render a matchweek heading`,
      ).toBe(model.competition.matchweekLabel)
      unmount()
    }
  })

  it('does not repeat the staged match in the list beneath it', () => {
    renderHome(workshopHomeModel)
    const featured = pickFeaturedLiveMatch(workshopHomeModel)
    expect(featured).not.toBeNull()

    // The featured fixture appears once as the stage. Its row in Around the
    // Grounds carries the same accessible label, so counting that label is how
    // a duplicate would show up.
    const label = new RegExp(
      `${featured?.home.team.name} versus ${featured?.away.team.name}`,
    )
    expect(screen.queryAllByLabelText(label)).toHaveLength(0)
  })

  it('shows the outstanding action beside live football, but not beside the hero', () => {
    // In decision emphasis the hero IS the action, so a banner saying the same
    // thing above it would be the same sentence twice.
    const { unmount } = renderHome(workshopHomeModel)
    expect(screen.getByLabelText('Your outstanding action')).toBeInTheDocument()
    unmount()

    renderHome(decisionHomeModel)
    expect(screen.queryByLabelText('Your outstanding action')).toBeNull()
  })
})
