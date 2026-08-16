import { render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { ArenaHome } from '../../src/vnext/concepts/arena/ArenaHome'
import { CommandHome } from '../../src/vnext/concepts/command/CommandHome'
import { CinematicHome } from '../../src/vnext/concepts/cinematic/CinematicHome'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { workshopHomeModel } from '../../src/vnext/fixtures'
import type { HomeModel } from '../../src/vnext/models/home'

/**
 * WHAT IS WORTH GUARDING ABOUT THREE THROWAWAY CONCEPTS.
 *
 * Almost none of their structure. These compositions exist to be compared and
 * then mostly discarded, and a test that asserted a heading order or a card
 * arrangement would turn an exploration into an authority — which is exactly
 * what Stage 3 is told not to do. Layout, overflow and width composition are
 * measured in a real browser by `e2e/vnext-home-concepts.spec.ts`, because
 * jsdom evaluates no container query.
 *
 * What IS worth guarding is the small set of promises that outlive whichever
 * concept wins:
 *
 *   1. all three read the SAME model — the comparison is worthless if one
 *      concept is quietly showing better numbers;
 *   2. all three keep the accessibility floor the Stage 2 foundation set;
 *   3. all three say what state something is in with WORDS, not colour alone —
 *      including the one rule presentation is not allowed to break, that
 *      provisional points are never presented as awarded;
 *   4. reduced motion changes the animation, never the content.
 */

const CONCEPTS = [
  { name: 'A — Matchday Arena', render: (model: HomeModel) => <ArenaHome model={model} /> },
  {
    name: 'B — Game Command Centre',
    render: (model: HomeModel) => <CommandHome model={model} />,
  },
  {
    name: 'C — Cinematic Football',
    render: (model: HomeModel) => <CinematicHome model={model} />,
  },
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

describe.each(CONCEPTS)('$name', (concept) => {
  it('has no serious accessibility failures', async () => {
    await scan(<VNextRoot>{concept.render(workshopHomeModel)}</VNextRoot>)
  })

  it('offers a navigation landmark and real controls with real names', () => {
    render(<VNextRoot>{concept.render(workshopHomeModel)}</VNextRoot>)

    // Both navigation shapes are rendered and CSS hides one, so jsdom — which
    // applies no stylesheet — legitimately sees both. What matters here is that
    // navigation exists and is named; which one is real at a width is measured
    // in a browser.
    const navigations = screen.getAllByRole('navigation')
    expect(navigations.length).toBeGreaterThan(0)
    for (const nav of navigations) {
      expect(nav.getAttribute('aria-label')?.length ?? 0).toBeGreaterThan(0)
    }

    for (const control of screen.getAllByRole('button')) {
      expect(
        (control.getAttribute('aria-label') ?? control.textContent ?? '').trim().length,
        `a control on ${concept.name} has no accessible name`,
      ).toBeGreaterThan(0)
    }
  })

  it('never presents provisional points as awarded', () => {
    render(<VNextRoot>{concept.render(workshopHomeModel)}</VNextRoot>)

    // The fixture puts 6 points on the pitch across two live matches. Wherever
    // a concept shows that figure it must qualify it — "on the pitch",
    // "provisional" — because the backend awards points and presentation may
    // not imply otherwise.
    const body = document.body.textContent ?? ''
    expect(body).toMatch(/provisional|on the pitch/i)
  })

  it('states football and rival state in words, not only in colour', () => {
    render(<VNextRoot>{concept.render(workshopHomeModel)}</VNextRoot>)
    const body = document.body.textContent ?? ''

    // Live state, the outstanding deadline and the rival gap are the three
    // things every concept must communicate without relying on a colour.
    expect(body).toMatch(/live|half time/i)
    expect(body).toMatch(/38 min/)
    expect(body).toMatch(/Jamie/)
  })

  it('renders identical content on the reduced-motion path', () => {
    const { unmount } = render(
      <VNextRoot motion="full">{concept.render(workshopHomeModel)}</VNextRoot>,
    )
    const full = document.body.textContent
    unmount()

    render(<VNextRoot motion="reduced">{concept.render(workshopHomeModel)}</VNextRoot>)
    expect(document.body.textContent).toBe(full)
  })
})

describe('the three concepts are a fair comparison', () => {
  /**
   * THE ONE RULE THE WHOLE STAGE RESTS ON. Three concepts fed three fixtures is
   * not a design comparison, it is three different products. This asserts the
   * cheapest honest version of "same data": every concept is rendered from the
   * one exported workshop model, and the figures that would make one look
   * better than another — the points total, the rank, the gap to the leader,
   * the open-prediction count and the deadline — appear in all three.
   */
  const SHARED_FACTS = [
    '125', // total points
    '1,428', // overall rank
    '38 min', // the outstanding deadline
    'Jamie', // the rival two points ahead
    'Work League', // the private league the gap lives in
  ]

  it.each(CONCEPTS)('$name shows the same matchday facts', (concept) => {
    render(<VNextRoot>{concept.render(workshopHomeModel)}</VNextRoot>)
    const body = document.body.textContent ?? ''
    for (const fact of SHARED_FACTS) {
      expect(body, `${concept.name} is missing "${fact}"`).toContain(fact)
    }
  })

  it('all three surface the same private leagues and rivals', () => {
    for (const concept of CONCEPTS) {
      const { unmount } = render(<VNextRoot>{concept.render(workshopHomeModel)}</VNextRoot>)
      const body = document.body.textContent ?? ''
      for (const league of workshopHomeModel.privateLeagues) {
        expect(body, `${concept.name} drops ${league.name}`).toContain(league.name)
      }
      unmount()
    }
  })

  it('marks the user’s own row in every concept that shows a table', () => {
    for (const concept of CONCEPTS) {
      const { container, unmount } = render(
        <VNextRoot>{concept.render(workshopHomeModel)}</VNextRoot>,
      )
      const current = container.querySelectorAll('[aria-current="true"]')
      if (current.length > 0) {
        for (const row of current) {
          expect(within(row as HTMLElement).getByText('You')).toBeInTheDocument()
        }
      }
      unmount()
    }
  })
})
