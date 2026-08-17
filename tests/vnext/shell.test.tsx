import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { VNextShell } from '../../src/vnext/app/VNextShell'
import { VNextPageHeader } from '../../src/vnext/app/VNextPageHeader'
import { VNextHome } from '../../src/vnext/home/VNextHome'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { defaultNavItems } from '../../src/vnext/components/navigation/VNextNav'
import { homeScenarios } from '../../src/vnext/fixtures'
import { fromRoot, reachableFrom } from '../app/importGraph'
import { at } from '../support/indexed'

/**
 * THE SHELL CONTRACT — the part every future vNext page inherits.
 *
 * Stage 5 extracted the application structure out of the Gold Standard Home so
 * that Match Predictor, Match Centre, Fixtures, Leagues and Season can start
 * from it instead of copying Home. That only holds if two things stay true, and
 * neither of them is visible in a screenshot:
 *
 *   THE LANDMARK CONTRACT. The shell owns exactly one `<main>` and the page
 *   owns exactly one `<h1>`, and the two are wired together. Get this wrong in
 *   the shell and every page inherits the mistake — two mains, or a heading
 *   nothing is labelled by, on eight surfaces at once.
 *
 *   THE DIRECTION OF THE DEPENDENCY. `app/` may not reach into `home/`. A shell
 *   that imports one Home component is a shell that has quietly become Home,
 *   and the next page inherits a featured match it has no fixture for.
 *
 * WHAT IS NOT HERE. Composition, overflow, the width at which the navigation
 * swaps, whether mobile content clears the bottom bar, and whether a dense page
 * can use the workspace are all LAYOUT, and jsdom computes none of it.
 * `e2e/vnext-shell.spec.ts` measures those in Chromium. Nothing below asserts
 * the markup of a demonstration page either: those placeholders exist to be
 * thrown away, and a test that froze them would make them permanent.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])
/** jsdom has no layout, so it can neither confirm nor deny a contrast ratio. */
const JSDOM_CANNOT_EVALUATE = new Set(['color-contrast'])

function renderShell(children: ReactNode, header?: ReactNode) {
  return render(
    <VNextRoot>
      <VNextShell
        destination="fixtures"
        header={
          header ?? <VNextPageHeader competition="Placeholder" title="A page" context="Context" />
        }
      >
        {children}
      </VNextShell>
    </VNextRoot>,
  )
}

/** The landmark contract, asserted the same way whatever rendered the page. */
function expectLandmarkContract(expectedHeading: string) {
  const mains = screen.getAllByRole('main')
  expect(mains, 'the shell owns exactly one main landmark').toHaveLength(1)

  const headings = screen.getAllByRole('heading', { level: 1 })
  expect(headings, 'the page owns exactly one h1').toHaveLength(1)
  expect(headings[0]?.textContent).toBe(expectedHeading)

  // The wiring, not just the counts: a shell that generated an id and a header
  // that generated a different one would satisfy both assertions above and
  // still leave `<main>` labelled by nothing.
  const labelledBy = at(mains, 0).getAttribute('aria-labelledby')
  expect(labelledBy, 'main is labelled by the page heading').toBeTruthy()
  expect(document.getElementById(labelledBy as string)).toBe(headings[0])
}

/* ------------------------------------------------------------------------ *
 * Landmarks and headings
 * ------------------------------------------------------------------------ */

describe('the shell owns the landmarks and the page owns the heading', () => {
  it('renders one main, one h1, and wires them together', () => {
    renderShell(<p>Placeholder</p>)
    expectLandmarkContract('A page')
  })

  it('still holds when Home is the page', () => {
    // The migration's own guard. Home used to render the `<main>` and the `<h1>`
    // itself; if the extraction had left either behind, this is where two mains
    // or a dangling `aria-labelledby` would show up.
    render(
      <VNextRoot>
        <VNextHome model={homeScenarios.live} />
      </VNextRoot>,
    )
    expectLandmarkContract(homeScenarios.live.competition.matchweekLabel)
  })

  it('labels main by nothing rather than by a missing element with no header', () => {
    // A dangling `aria-labelledby` is worse than an unnamed landmark: assistive
    // technology announces neither, and axe cannot tell the author which.
    render(
      <VNextRoot>
        <VNextShell destination="home">
          <p>Placeholder</p>
        </VNextShell>
      </VNextRoot>,
    )
    expect(screen.getByRole('main').getAttribute('aria-labelledby')).toBeNull()
  })

  it('sends the skip link at the main it actually rendered', () => {
    renderShell(<p>Placeholder</p>)
    const target = screen
      .getByRole('link', { name: /skip to content/i })
      .getAttribute('href')

    expect(target?.startsWith('#')).toBe(true)
    expect(document.getElementById((target as string).slice(1))).toBe(
      screen.getByRole('main'),
    )
  })
})

/* ------------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------------ */

describe('global navigation', () => {
  it('names every navigation landmark and marks the current destination', () => {
    renderShell(<p>Placeholder</p>)

    // Both shapes are rendered and CSS shows one; jsdom applies no stylesheet,
    // so it legitimately sees both. Which is real at a width is measured in a
    // browser. What must hold here is that neither is anonymous, and that the
    // current page is marked in both rather than in whichever happened to be
    // visible when someone last looked.
    const navigations = screen.getAllByRole('navigation')
    expect(navigations.length).toBeGreaterThan(0)

    for (const nav of navigations) {
      expect(nav.getAttribute('aria-label')?.length ?? 0).toBeGreaterThan(0)

      const current = [...nav.querySelectorAll('[aria-current="page"]')]
      expect(current, 'exactly one current destination').toHaveLength(1)
      expect(current[0]?.textContent).toContain('Fixtures')
    }
  })

  it('offers the four vNext destinations and no invented ones', () => {
    renderShell(<p>Placeholder</p>)
    const nav = at(screen.getAllByRole('navigation'), 0)
    const labels = [...nav.querySelectorAll('button')].map((button) =>
      button.textContent?.trim(),
    )

    expect(labels).toEqual(['Home', 'Fixtures', 'Leagues', 'Season'])
  })

  it('puts the skip link first in focus order, then the destinations', () => {
    const { container } = renderShell(<p>Placeholder</p>)
    const shell = container.querySelector('[data-vnext-shell]') as HTMLElement

    // Tab order IS document order here, and that is worth asserting rather than
    // simulating: it only stops being true if something grows a positive
    // `tabindex`, which is the next assertion.
    const focusable = [
      ...shell.querySelectorAll<HTMLElement>(
        'a[href], button, [tabindex]:not([tabindex="-1"])',
      ),
    ]

    expect(
      [...shell.querySelectorAll('[tabindex]')]
        .map((element) => Number(element.getAttribute('tabindex')))
        .filter((value) => value > 0),
      'a positive tabindex would reorder the page against its own reading order',
    ).toEqual([])

    expect(focusable[0], 'the skip link comes before four destinations').toBe(
      screen.getByRole('link', { name: /skip to content/i }),
    )

    // jsdom applies no stylesheet, so both navigation shapes are focusable
    // here; the four that follow the skip link are the first one's.
    expect(focusable.slice(1, 5).map((element) => element.textContent?.trim())).toEqual([
      'Home',
      'Fixtures',
      'Leagues',
      'Season',
    ])

    // And each of them actually takes focus when it is reached.
    for (const element of focusable.slice(0, 5)) {
      element.focus()
      expect(document.activeElement).toBe(element)
    }
  })

  it('announces a badge as part of the destination name', () => {
    render(
      <VNextRoot>
        <VNextShell
          destination="home"
          navItems={defaultNavItems.map((item) =>
            item.id === 'fixtures' ? { ...item, badge: 2 } : item,
          )}
          header={<VNextPageHeader title="A page" />}
        >
          <p>Placeholder</p>
        </VNextShell>
      </VNextRoot>,
    )

    expect(screen.getAllByRole('button', { name: 'Fixtures, 2 waiting' }).length)
      .toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------------ *
 * Accessibility and motion
 * ------------------------------------------------------------------------ */

describe('the shell accessibility floor', () => {
  it('has no serious accessibility failures', async () => {
    renderShell(<p>Placeholder</p>)

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
        .map((violation) => `${violation.id} (${violation.impact}): ${violation.help}`)
        .join('\n'),
    ).toEqual([])
  })

  it('survives long localised destination labels', async () => {
    // Four English labels are short enough to hide a bar that cannot cope. The
    // German set is nearly three times as long and must still produce named,
    // reachable destinations.
    const long = defaultNavItems.map((item, index) => ({
      ...item,
      label: ['Startseite', 'Spielbegegnungen', 'Ligatabellen', 'Saisonübersicht'][
        index
      ] as string,
    }))

    render(
      <VNextRoot>
        <VNextShell
          destination="fixtures"
          navItems={long}
          header={<VNextPageHeader title="Spielbegegnungen" />}
        >
          <p>Platzhalter</p>
        </VNextShell>
      </VNextRoot>,
    )

    const nav = at(screen.getAllByRole('navigation'), 0)
    expect(
      [...nav.querySelectorAll('button')].map((button) => button.textContent?.trim()),
    ).toEqual(['Startseite', 'Spielbegegnungen', 'Ligatabellen', 'Saisonübersicht'])
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  })

  it('renders identical content on the reduced-motion path', () => {
    const page = (
      <VNextShell
        destination="fixtures"
        header={<VNextPageHeader competition="Placeholder" title="A page" />}
      >
        <p>Placeholder</p>
      </VNextShell>
    )

    const { unmount } = render(<VNextRoot motion="full">{page}</VNextRoot>)
    const full = document.body.textContent
    unmount()

    render(<VNextRoot motion="reduced">{page}</VNextRoot>)
    expect(document.body.textContent).toBe(full)
  })
})

/* ------------------------------------------------------------------------ *
 * The shell is not Home
 * ------------------------------------------------------------------------ */

describe('the shell knows nothing about Home', () => {
  const appFiles = filesUnder(resolve(process.cwd(), 'src/vnext/app'))

  it('finds the tree, so the guard is not vacuous', () => {
    expect(appFiles.length).toBeGreaterThan(1)
  })

  it('cannot reach a page from the application shell', () => {
    // The test that answers "would deleting Home leave a coherent shell?". It
    // would: nothing under `app/` can see `home/`, so the dependency only ever
    // points from the page to the shell.
    const offenders: string[] = []
    for (const file of appFiles) {
      for (const reached of reachableFrom(file)) {
        if (reached.includes('/src/vnext/home/') || reached.includes('/src/vnext/fixtures/')) {
          offenders.push(`${fromRoot(file)} -> ${fromRoot(reached)}`)
        }
      }
    }

    expect(
      [...new Set(offenders)],
      'the application shell reached into a page or its fixtures — it has stopped ' +
        'being infrastructure and become that page',
    ).toEqual([])
  })
})

function filesUnder(directory: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) out.push(...filesUnder(path))
    else if (/\.tsx?$/.test(path)) out.push(path)
  }
  return out
}
