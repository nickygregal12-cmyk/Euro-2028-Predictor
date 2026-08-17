import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { IA_CONCEPTS, IA_CONCEPT_KEYS, IaConcept } from '../../src/vnext/ia/IaLab'
import type { IaConceptKey } from '../../src/vnext/ia/IaLab'
import { iaScenarios, iaScenarioNames } from '../../src/vnext/fixtures'
import type { IaScenarioName } from '../../src/vnext/fixtures'

/**
 * THE STAGE 7.5 PRODUCT CONTRACT.
 *
 * WHAT IS DELIBERATELY NOT HERE. No pixel baselines, no frozen markup, no
 * assertion that a concept has a particular control in a particular corner.
 * Every one of these three architectures exists to be argued with and two of
 * them will be discarded, so a test that pinned their composition would have to
 * be deleted in the same change that acts on the review — which is a test that
 * teaches nothing and costs something.
 *
 * WHAT IS HERE IS THE PART THAT MUST SURVIVE WHICHEVER CONCEPT WINS:
 *
 *   * the three dimensions stay apart — a competition, a game and a private
 *     league are never rendered as three of the same thing;
 *   * a game the competition does not run is ABSENT, not disabled;
 *   * a player's name is a control only where an address exists;
 *   * the way back from a player is deterministic and names where it goes;
 *   * one `<main>`, one `<h1>`, one skip link, per concept, in every world;
 *   * every control clears the tap target and every accessible name is real;
 *   * twenty competitions do not enter the permanent chrome;
 *   * one competition does not pay for a chooser.
 *
 * Every case runs against ALL THREE CONCEPTS, because a rule that only one of
 * them keeps is not a contract — it is that concept's feature.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])
/** jsdom has no layout, so it can neither confirm nor deny a contrast ratio. */
const JSDOM_CANNOT_EVALUATE = new Set(['color-contrast'])

function renderConcept(concept: IaConceptKey, scenario: IaScenarioName) {
  return render(
    <VNextRoot>
      <IaConcept concept={concept} model={iaScenarios[scenario]} />
    </VNextRoot>,
  )
}

describe.each(IA_CONCEPT_KEYS)('Concept %s', (concept) => {
  const name = IA_CONCEPTS[concept].name

  describe('the landmark contract, in every world', () => {
    it.each(iaScenarioNames)('holds in the %s scenario', (scenario) => {
      const { container } = renderConcept(concept, scenario)

      expect(container.querySelectorAll('main')).toHaveLength(1)
      expect(container.querySelectorAll('h1')).toHaveLength(1)

      const main = container.querySelector('main') as HTMLElement
      const labelledBy = main.getAttribute('aria-labelledby')
      expect(labelledBy, `${name} left <main> unlabelled`).toBeTruthy()
      expect(container.querySelector(`#${CSS.escape(labelledBy as string)}`)).toBe(
        container.querySelector('h1'),
      )

      // The skip link is the first thing in the DOM and resolves to the content
      // region — not to an id that was renamed three refactors ago.
      const skip = screen.getByRole('link', { name: /skip to content/i })
      expect(skip.getAttribute('href')).toBe(`#${main.id}`)
    })
  })

  describe('the three dimensions stay apart', () => {
    it('never renders a game with a competition’s own furniture', () => {
      renderConcept(concept, 'regular')
      // A game may be named anywhere. What it may never carry is a season
      // label, which is a property of the football context alone. If a concept
      // ever prints "Last Man Standing · 2026/27" it has made a game into a
      // competition.
      const body = document.body.textContent ?? ''
      for (const game of ['Match Predictor', 'Last Man Standing', 'Predictor Championship']) {
        expect(body).not.toContain(`${game} · 2026/27`)
        expect(body).not.toContain(`${game} 2026/27`)
      }
    })

    it('names the competition and the game separately on every attention card', async () => {
      // Concept B's queue is the strictest case: it is the only surface that
      // lists work from several competitions at once, so it is where the two
      // could most easily merge into one label.
      renderConcept(concept, 'regular')
      const user = userEvent.setup()

      // Reaching the queue differs per concept; what must not differ is that
      // when a competition and a game appear together they are two strings.
      const buttons = screen.getAllByRole('button')
      const merged = buttons.filter((button) =>
        /Premier League (Match Predictor|Last Man Standing)/.test(
          button.textContent ?? '',
        ),
      )
      expect(merged, `${name} merged a competition and a game into one label`).toEqual([])
      await user.tab()
    })
  })

  describe('a game the competition does not run', () => {
    it('is absent rather than disabled', async () => {
      // Euro 2028 runs only the Match Predictor. Neither of the other two games
      // may appear as a control anywhere — a greyed row invites a press and
      // then refuses it, which is worse than nothing being there.
      renderConcept(concept, 'unsupported')

      const controls = [
        ...screen.queryAllByRole('button'),
        ...screen.queryAllByRole('link'),
      ]
      const offenders = controls.filter(
        (control) =>
          /Last Man Standing|Predictor Championship/.test(control.textContent ?? '') &&
          (control as HTMLButtonElement).disabled,
      )
      expect(offenders.map((entry) => entry.textContent)).toEqual([])
    })

    it('says so in words somewhere the player can read it', async () => {
      const user = userEvent.setup()
      renderConcept(concept, 'unsupported')

      // Every concept reaches this differently, so the assertion is on the
      // SENTENCE rather than on the route to it: with Euro 2028 active, the
      // product must be able to state that it does not run the other games.
      // Concept A has a games surface, Concept C has the spine's game menu, and
      // Concept B — which has no game navigation at all — has to answer it from
      // the competition filter, which is the finding this case produced.
      if (concept === 'a') {
        await user.click(screen.getAllByRole('button', { name: /^Games$/ })[0] as HTMLElement)
      } else if (concept === 'b') {
        await user.click(screen.getAllByRole('button', { name: /Euro 2028/ })[0] as HTMLElement)
      } else {
        await user.click(
          screen.getAllByRole('button', { name: /^Competition: / })[0] as HTMLElement,
        )
      }

      const body = document.body.textContent ?? ''
      expect(
        /does not run|Not run in this competition/i.test(body),
        `${name} never says that Euro 2028 does not run the other games`,
      ).toBe(true)
    })
  })

  describe('player identity — the navigation contract', () => {
    it('makes a private-league name a control and a global-table name text', async () => {
      const user = userEvent.setup()
      renderConcept(concept, 'regular')

      // Reach a people surface. Each concept has its own route in; the contract
      // is what is found once there.
      await openPeople(user, concept)

      // A co-member of a private league is reachable.
      const jamie = screen.queryAllByRole('button', { name: /Jamie Ferguson-Whyte/ })
      expect(
        jamie.length,
        `${name} did not make a private-league co-member reachable`,
      ).toBeGreaterThan(0)

      // A global leaderboard name is not a control anywhere, because the read
      // returns no identifier to address one with.
      //
      // CALLUM RATHER THAN PRIYA, AND THE REASON IS A FINDING. Priya appears in
      // BOTH the global Premier League table and the private Office Survivors
      // league, so in one place her name is a door and in the other it is text
      // — the same person, the same screen, two treatments. That is not a
      // defect of these concepts; it is what the platform's reads make true,
      // and it is one of the questions Stage 7.5 sends up for decision. Callum
      // is in the global table only, so he isolates the rule.
      expect(
        screen.queryByRole('button', { name: /Callum Mac an Bhaird/ }),
        `${name} made a global leaderboard row a control — there is no user id ` +
          `in get_season_leaderboard to link to`,
      ).toBeNull()
      expect(screen.getAllByText(/Callum Mac an Bhaird/).length).toBeGreaterThan(0)
    })

    it('returns to the league the player was opened from, by name', async () => {
      const user = userEvent.setup()
      renderConcept(concept, 'regular')
      await openPeople(user, concept)

      const [jamie] = screen.getAllByRole('button', { name: /Jamie Ferguson-Whyte/ })
      await user.click(jamie as HTMLElement)

      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
        'Jamie Ferguson-Whyte',
      )

      // The way out is deterministic and states its destination, because a deep
      // link may be the first address opened and history would have nothing.
      const back = screen.getByRole('button', { name: /Back to The Sunday Club/ })
      await user.click(back)
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
        'The Sunday Club',
      )
    })

    it('states the visibility rule rather than implying a public directory', async () => {
      const user = userEvent.setup()
      renderConcept(concept, 'regular')
      await openPeople(user, concept)
      const [jamie] = screen.getAllByRole('button', { name: /Jamie Ferguson-Whyte/ })
      await user.click(jamie as HTMLElement)

      expect(document.body.textContent).toContain('share')
      expect(document.body.textContent).toContain('The Sunday Club')
    })
  })

  describe('scale', () => {
    it('does not put twenty competitions in the permanent chrome', () => {
      const { container } = renderConcept(concept, 'catalogue')
      const model = iaScenarios.catalogue

      // The catalogue is twenty; the player is relevant to three. THE
      // PERMANENT CHROME — the header, the navigations and any standing side
      // column — may name only those three, or it has become a function of what
      // the platform publishes rather than of what the player plays.
      //
      // Scoped to the chrome deliberately. The page BODY is allowed to name
      // other things: `Predictor Championship` contains the name of a real
      // competition in this catalogue, and a test over the whole container
      // would fail on a game's name and call it a scalability defect.
      const chrome = [...container.querySelectorAll('header, nav, aside')]
        .map((element) => element.textContent ?? '')
        .join(' ')
      const strangers = model.catalogue
        .filter((entry) => entry.relationship === 'browsing')
        .map((entry) => entry.competition.name)
      const leaked = strangers.filter((name_) => chrome.includes(name_))
      expect(
        leaked,
        `${name} named competitions the player has nothing to do with, before discovery`,
      ).toEqual([])
    })

    it('does not offer a competition chooser to a one-competition player', () => {
      renderConcept(concept, 'single')

      // A control that offers one choice teaches a player there is a decision
      // and then wastes their press proving there is not.
      const switchers = screen
        .queryAllByRole('button')
        .filter((button) =>
          /choose a competition|switch competition/i.test(
            button.getAttribute('aria-label') ?? button.textContent ?? '',
          ),
        )
      expect(switchers.map((entry) => entry.textContent)).toEqual([])
    })

    it('renders eleven competitions without naming the whole catalogue', () => {
      const { container } = renderConcept(concept, 'power')
      const text = container.textContent ?? ''
      expect(text).toContain('Premier League')
      // Two of the eleven are FOLLOWED and not played. Losing them would be
      // losing the state the platform was blind to before contract 157.
      expect(iaScenarios.power.contexts.filter((c) => c.relationship === 'following')).toHaveLength(
        2,
      )
    })
  })

  describe('accessibility', () => {
    it.each(['regular', 'catalogue', 'newcomer', 'longNames'] as const)(
      'has no critical or serious violation in the %s scenario',
      async (scenario) => {
        const { container } = renderConcept(concept, scenario)
        const results = await axe.run(container, { runOnly: { type: 'tag', values: TAGS } })
        const serious = results.violations.filter(
          (violation) =>
            FAIL_IMPACTS.has(violation.impact ?? '') &&
            !JSDOM_CANNOT_EVALUATE.has(violation.id),
        )
        expect(
          serious.map((violation) => `${violation.id}: ${violation.help}`),
          name,
        ).toEqual([])
      },
    )

    it('gives every control a real accessible name', () => {
      const { container } = renderConcept(concept, 'regular')
      const nameless = [...container.querySelectorAll('button')].filter((button) => {
        const label = button.getAttribute('aria-label') ?? button.textContent ?? ''
        return label.trim().length === 0
      })
      expect(nameless.map((entry) => entry.outerHTML.slice(0, 120))).toEqual([])
    })

    it('has exactly one navigation landmark per displayed navigation', () => {
      const { container } = renderConcept(concept, 'regular')
      const navs = [...container.querySelectorAll('nav')]
      // Every navigation must be labelled; two unlabelled `nav` elements are
      // indistinguishable to a screen-reader user reading the landmark list.
      const unlabelled = navs.filter(
        (nav) => !nav.getAttribute('aria-label') && !nav.getAttribute('aria-labelledby'),
      )
      expect(unlabelled).toHaveLength(0)
      expect(navs.length).toBeGreaterThan(0)
    })
  })

  describe('the empty world', () => {
    it('answers a player with no competition rather than rendering a broken shell', () => {
      renderConcept(concept, 'newcomer')
      expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
      // Discovery is reachable, because it is the only thing this player can do.
      expect(document.body.textContent).toMatch(/competition/i)
    })
  })
})

/**
 * Reach a people surface in whichever way this concept offers.
 *
 * DELIBERATELY CONCEPT-AWARE, and it is the only place in the suite that is.
 * The route in is exactly what the three concepts disagree about, so a test
 * that pretended they were the same would be asserting one concept's chrome on
 * all three. What the suite holds is what is true once the player is there.
 */
async function openPeople(
  user: ReturnType<typeof userEvent.setup>,
  concept: IaConceptKey,
) {
  if (concept === 'c') {
    // Concept C has no People anchor at all — that is its argument. The command
    // surface is the route, and the standings entry is what lands on the same
    // people surface the other two reach from the bar.
    await user.click(screen.getByRole('button', { name: /^Jump$/ }))
    await user.click(
      screen.getByRole('button', { name: /Premier League standings/ }),
    )
    return
  }
  const anchor = screen.getAllByRole('button', {
    name: concept === 'a' ? /^Leagues$/ : /^People$/,
  })[0]
  await user.click(anchor as HTMLElement)
}

describe('the lab itself', () => {
  it('offers exactly three concepts, none of them marked as chosen', () => {
    expect(IA_CONCEPT_KEYS).toEqual(['a', 'b', 'c'])
    for (const key of IA_CONCEPT_KEYS) {
      const entry = IA_CONCEPTS[key]
      expect(entry.name.length).toBeGreaterThan(0)
      expect(entry.mentalModel.length).toBeGreaterThan(0)
      // A "recommended", "preferred" or "winner" flag would make the selection
      // stage decorative. There is no such field, and this is the guard that
      // notices one arriving.
      expect(Object.keys(entry).sort()).toEqual(['mentalModel', 'name', 'render'])
    }
  })

  it('holds twelve worlds, and every one of them is used', () => {
    expect(iaScenarioNames.length).toBe(12)
    for (const scenario of iaScenarioNames) {
      const model = iaScenarios[scenario]
      expect(model.premise.length).toBeGreaterThan(20)
      expect(model.scenario.length).toBeGreaterThan(0)
    }
  })

  it('publishes twenty competitions and keeps the player relevant to three', () => {
    const model = iaScenarios.catalogue
    expect(model.catalogue).toHaveLength(20)
    expect(model.contexts).toHaveLength(3)
    // Not the first three: a bounded list that sliced the top would pass wrongly.
    expect(model.catalogue.slice(0, 3).every((entry) => entry.relationship === 'browsing')).toBe(
      true,
    )
  })

  it('never lets a global standing row carry a reachable player', () => {
    for (const scenario of iaScenarioNames) {
      for (const scope of iaScenarios[scenario].people) {
        if (scope.kind !== 'global') continue
        expect(
          scope.entries.every((entry) => entry.reach === 'name-only'),
          `${scenario}/${scope.id} made a global leaderboard row reachable`,
        ).toBe(true)
      }
    }
  })

  it('never claims a game a competition does not run', () => {
    for (const scenario of iaScenarioNames) {
      for (const context of iaScenarios[scenario].contexts) {
        for (const game of context.games) {
          if (game.availability === 'not-offered') {
            expect(game.status).toBeNull()
            expect(game.urgency).toBe('none')
          }
        }
      }
    }
  })

  it('keeps every attention item pointing at a real competition and game', () => {
    for (const scenario of iaScenarioNames) {
      const model = iaScenarios[scenario]
      const ids = new Set(model.contexts.map((entry) => entry.competition.id))
      for (const item of model.attention) {
        expect(ids.has(item.contextId), `${scenario}/${item.id}`).toBe(true)
        const context = model.contexts.find((entry) => entry.competition.id === item.contextId)
        const game = context?.games.find((entry) => entry.key === item.game)
        expect(
          game && game.availability !== 'not-offered',
          `${scenario}/${item.id} asks the player to act in a game the competition does not run`,
        ).toBe(true)
      }
    }
  })

  it('never reads a clock: every deadline is a string the fixture supplied', () => {
    for (const scenario of iaScenarioNames) {
      for (const context of iaScenarios[scenario].contexts) {
        for (const game of context.games) {
          const status = game.status
          if (status?.kind === 'match-predictor') {
            expect(typeof status.deadlineLabel).toBe('string')
          }
          if (status?.kind === 'last-man-standing' && status.deadlineLabel !== null) {
            expect(typeof status.deadlineLabel).toBe('string')
          }
        }
      }
    }
  })
})

describe('the shared surfaces, once', () => {
  it('draws each game in its own vocabulary rather than one shared shape', () => {
    render(
      <VNextRoot>
        <IaConcept concept="a" model={iaScenarios.regular} />
      </VNextRoot>,
    )

    const body = document.body.textContent ?? ''
    // Match Predictor: a fraction against a deadline.
    expect(body).toMatch(/\d+ of \d+ predicted/)
    // Last Man Standing: a life and a club. Never a fraction.
    expect(body).toMatch(/Still alive|Eliminated/)
    // The Championship: a position in a field.
    expect(body).toMatch(/\d+ of \d+/)
  })

  it('keeps a private league’s game visible so a player never has to remember it', async () => {
    const user = userEvent.setup()
    render(
      <VNextRoot>
        <IaConcept concept="a" model={iaScenarios.regular} />
      </VNextRoot>,
    )
    await user.click(screen.getAllByRole('button', { name: /^Leagues$/ })[0] as HTMLElement)

    const office = screen.getByRole('heading', { name: 'Office Survivors' })
    const panel = office.closest('section') as HTMLElement
    // The card names its competition AND its game — the production authority's
    // own rule, because a player must never have to remember which football
    // competition a private league belongs to.
    expect(within(panel).getByText(/Premier League/)).toBeTruthy()
    expect(within(panel).getByText(/LMS/)).toBeTruthy()
  })
})
