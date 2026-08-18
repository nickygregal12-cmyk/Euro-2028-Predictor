import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { VNextShell } from '../../src/vnext/app/VNextShell'
import { VNextPageHeader } from '../../src/vnext/app/VNextPageHeader'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { VNextHome } from '../../src/vnext/home/VNextHome'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { SHELL_DESTINATIONS } from '../../src/vnext/models/shell'
import { homeScenarios, shellScenarios } from '../../src/vnext/fixtures'
import { fromRoot, reachableFrom } from '../app/importGraph'
import { at } from '../support/indexed'

/**
 * THE SHELL CONTRACT — the part every future vNext page inherits.
 *
 * Stage 5 extracted the application structure out of the Gold Standard Home.
 * Stage 7.6 replaced what that structure SAYS: the four platform destinations
 * became the four destinations of the active FOOTBALL COMPETITION, which is
 * Concept A — the Competition Deck — becoming product authority.
 *
 * What has to stay true, and none of it is visible in a screenshot:
 *
 *   THE LANDMARK CONTRACT. The shell owns exactly one `<main>` and the page
 *   owns exactly one `<h1>`, and the two are wired together. Get this wrong in
 *   the shell and every page inherits the mistake.
 *
 *   THE DIRECTION OF THE DEPENDENCY. `app/` may not reach into `home/` or
 *   `fixtures/`. A shell that imports one Home component is a shell that has
 *   quietly become Home.
 *
 *   THE ARCHITECTURE ITSELF. Which is now a product claim and not only an
 *   implementation detail, so it is tested as one in `shellIa.test.tsx`.
 *
 * WHAT IS NOT HERE. Composition, overflow, the width at which the bar becomes a
 * rail, whether mobile content clears the bottom bar and whether a dense page
 * can use the workspace are all LAYOUT, and jsdom computes none of it.
 * `e2e/vnext-shell.spec.ts` measures those in Chromium.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])
/** jsdom has no layout, so it can neither confirm nor deny a contrast ratio. */
const JSDOM_CANNOT_EVALUATE = new Set(['color-contrast'])

function renderShell(children: ReactNode, header?: ReactNode) {
  return render(
    <VNextRoot>
      <VNextShell
        destination="matches"
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
    // The migration's own guard, in both directions now. Home used to render
    // the `<main>` and the `<h1>` itself; and Stage 7.6 changed what surrounds
    // it. Either mistake shows up here as two mains or a dangling label.
    render(
      <VNextRoot>
        <VNextHome model={homeScenarios.live} />
      </VNextRoot>,
    )
    expectLandmarkContract(homeScenarios.live.competition.matchweekLabel)
  })

  it('still holds when Home sits inside a supplied competition', () => {
    // The Stage 7.6 case: the shell now has a switcher, an attention control and
    // a rail of its own around the page, every one of which is a chance to grow
    // a second heading or a second landmark.
    //
    // THE WORLD ARRIVES THROUGH A PROVIDER AND NEVER THROUGH A SECOND SHELL.
    // Home renders `VNextShell` itself, so wrapping it in another one is how a
    // page ends up with two `<main>` landmarks — which is exactly what this
    // assertion caught the first time it was written the other way.
    render(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.fourCompetitions}>
          <VNextHome model={homeScenarios.live} />
        </VNextShellProvider>
      </VNextRoot>,
    )
    const mains = screen.getAllByRole('main')
    expect(mains, 'Home inside the shell has one main — its own').toHaveLength(1)
    expect(
      screen.getAllByRole('heading', { level: 1 }),
      'and one h1, which is the page’s',
    ).toHaveLength(1)
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
      expect(current[0]?.textContent).toContain('Matches')
    }
  })

  it('offers the four competition destinations and no invented ones', () => {
    renderShell(<p>Placeholder</p>)
    const nav = at(screen.getAllByRole('navigation'), 0)
    const labels = [...nav.querySelectorAll('button')].map((button) =>
      button.textContent?.trim(),
    )

    // THE SELECTED ARCHITECTURE, ASSERTED AS COPY. `Season` is gone because the
    // competition is now the chrome above these four rather than a tab beside
    // them, `Fixtures` became `Matches` to match the product's own word for
    // football, and `Games` is the place where the three game formats are
    // peers. See `docs/product/vnext-shell-ia.md`.
    expect(labels).toEqual(['Home', 'Matches', 'Games', 'Leagues'])
  })

  it('takes its destination labels and counts from the supplied model', () => {
    // The badge is the MODEL's and never the page's. Stage 5 let Home pass a
    // `navItems` array with an open-prediction count on it, which made the page
    // an author of the application's navigation.
    render(
      <VNextRoot>
        <VNextShell
          destination="home"
          shell={{
            ...shellScenarios.oneCompetition,
            destinations: SHELL_DESTINATIONS.map((entry) =>
              entry.id === 'games' ? { ...entry, badge: 2 } : entry,
            ),
          }}
          header={<VNextPageHeader title="A page" />}
        >
          <p>Placeholder</p>
        </VNextShell>
      </VNextRoot>,
    )

    expect(
      screen.getAllByRole('button', { name: 'Games, 2 waiting' }).length,
    ).toBeGreaterThan(0)
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

    expect(focusable[0], 'the skip link comes before the destinations').toBe(
      screen.getByRole('link', { name: /skip to content/i }),
    )

    // And each of them actually takes focus when it is reached.
    for (const element of focusable.slice(0, 5)) {
      element.focus()
      expect(document.activeElement).toBe(element)
    }
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

  it('has no serious accessibility failures with a whole world supplied', async () => {
    // The chrome that carries the architecture — switcher, attention control,
    // rail shortcuts, Explore, account — exists only when a model does, so the
    // bare shell above cannot see any of it.
    render(
      <VNextRoot>
        <VNextShell
          destination="home"
          shell={shellScenarios.manyCompetitions}
          header={<VNextPageHeader title="Home" />}
        >
          <p>Placeholder</p>
        </VNextShell>
      </VNextRoot>,
    )

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
    const long = ['Startseite', 'Spielbegegnungen', 'Spiele', 'Ligatabellen']

    render(
      <VNextRoot>
        <VNextShell
          destination="matches"
          shell={{
            ...shellScenarios.oneCompetition,
            destinations: SHELL_DESTINATIONS.map((entry, index) => ({
              ...entry,
              label: long[index] as string,
            })),
          }}
          header={<VNextPageHeader title="Spielbegegnungen" />}
        >
          <p>Platzhalter</p>
        </VNextShell>
      </VNextRoot>,
    )

    const nav = at(screen.getAllByRole('navigation'), 0)
    expect(
      [...nav.querySelectorAll('button')].map((button) => button.textContent?.trim()),
    ).toEqual(long)
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  })

  it('renders identical content on the reduced-motion path', () => {
    const page = (
      <VNextShell
        destination="matches"
        shell={shellScenarios.fourCompetitions}
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
    //
    // IT COVERS `fixtures/` TOO, which matters more in Stage 7.6 than it did in
    // Stage 5: the shell now has ten deterministic review worlds, and a shell
    // that imported one to fill an empty state would have shipped Premier
    // League as a default.
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

  it('cannot reach the Stage 7.5 lab from the accepted shell', () => {
    // `ia/` is historical evidence for WHY this architecture was chosen. The
    // accepted shell must not depend on it, or archiving the lab would take the
    // product down with it. The one module that moved the other way —
    // `focusReturn` — was PROMOTED into `foundations/`, and the lab imports it
    // from there.
    const offenders: string[] = []
    for (const file of appFiles) {
      for (const reached of reachableFrom(file)) {
        if (reached.includes('/src/vnext/ia/')) {
          offenders.push(`${fromRoot(file)} -> ${fromRoot(reached)}`)
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([])
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
