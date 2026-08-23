import { render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { VNextLeagues } from '../../src/vnext/leagues/VNextLeagues'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { leaguesScenarios, shellScenarios } from '../../src/vnext/fixtures'
import type { LeaguesModel } from '../../src/vnext/models/leagues'

/**
 * THE CHASE, RENDERED — contract 183 / `MIG-UI-18`.
 *
 * WHAT IS WORTH GUARDING. Not the layout: `e2e/vnext-leagues.spec.ts` measures
 * composition in a real browser, because jsdom computes none. What is held here
 * is the set of claims the strip must never make falsely:
 *
 *   1. THE DIRECTION OF A GAP IS IN TEXT, not only in a colour. "+3" and "−3"
 *      are different facts and a greyscale reader must get both.
 *   2. AN ABSENT WINDOW DRAWS NOTHING AT ALL — not an empty frame and not a
 *      message — and never costs the reader the standings.
 *   3. THE EDGE IS SAID IN WORDS, because a short list and a top-of-table are
 *      otherwise the same picture.
 *   4. A NEIGHBOUR WITH NO STATED REACH IS PLAIN TEXT, not a disabled control.
 *   5. The accessibility floor, on every world that draws a chase.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])
/** jsdom has no layout, so it can neither confirm nor deny a contrast ratio. */
const JSDOM_CANNOT_EVALUATE = new Set(['color-contrast'])

function renderLeagues(model: LeaguesModel) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextLeagues model={model} />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

function chase(): HTMLElement | null {
  return document.querySelector('[data-vnext-zone="rank-neighbourhood"]')
}

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
      failing.map((violation) => `${violation.id}: ${violation.help}`).join('\n'),
    ).toEqual([])
  } finally {
    unmount()
  }
}

describe('the chase', () => {
  it('names the players either side of the reader', () => {
    renderLeagues(leaguesScenarios.chaseMidTable)

    const strip = chase()
    expect(strip).not.toBeNull()

    const names = within(strip!).getAllByRole('rowheader').length
    // Seven rows: three above, the reader, three below.
    expect(names).toBe(7)
    expect(within(strip!).getByText('Marta Oyelaran')).toBeInTheDocument()
    expect(within(strip!).getByText('Dermot Kyle')).toBeInTheDocument()
  })

  it('says which direction a gap is, in words and not only in a sign', () => {
    renderLeagues(leaguesScenarios.chaseMidTable)
    const strip = chase()!

    // A GREYSCALE READER GETS BOTH. The visible cell carries + or −; the
    // accessible text says ahead or behind, because some voices read "+3" and
    // "−3" identically.
    expect(within(strip).getByText('5 points ahead of you')).toBeInTheDocument()
    expect(within(strip).getByText('5 points behind you')).toBeInTheDocument()
    expect(within(strip).getByText('1 point ahead of you')).toBeInTheDocument()
  })

  it('says level rather than nothing where an entrant matches the reader on points', () => {
    renderLeagues(leaguesScenarios.chaseMidTable)
    // Dermot is on the same points and a rank below. "0" alone would read as
    // missing; the rank column carries the tie-break and the server owns it.
    expect(within(chase()!).getByText('level with you')).toBeInTheDocument()
  })

  it('gives the reader no gap to themselves', () => {
    renderLeagues(leaguesScenarios.chaseMidTable)
    expect(within(chase()!).getByText('your total')).toBeInTheDocument()
  })

  it('says so in words when the reader leads the season', () => {
    renderLeagues(leaguesScenarios.chaseAtTop)
    // WITHOUT THIS SENTENCE the strip is indistinguishable from one whose rows
    // above simply failed to arrive.
    expect(screen.getByText(/Nobody above you/i)).toBeInTheDocument()
  })

  it('draws nothing at all when the window did not answer', () => {
    renderLeagues(leaguesScenarios.chaseUnavailable)

    expect(chase()).toBeNull()
    // AND THE STANDINGS ARE UNAFFECTED. A failed second read costs the chase
    // and never the table the reader came for.
    expect(screen.getByText('Rhona Buchanan')).toBeInTheDocument()
  })

  it('draws no chase on a world that has none, which is every existing world', () => {
    renderLeagues(leaguesScenarios.seasonYouOffPage)
    expect(chase()).toBeNull()
  })

  it('renders a neighbour with no stated reach as plain text, not a disabled control', () => {
    renderLeagues(leaguesScenarios.chaseMidTable)
    const strip = chase()!

    // Nobody in this window is on page one, so no neighbour carries identity.
    expect(within(strip).queryAllByRole('button')).toHaveLength(0)
    expect(within(strip).getByText('Isla McNair')).toBeInTheDocument()
  })

  it('marks the reader row as current so it is findable without colour', () => {
    renderLeagues(leaguesScenarios.chaseMidTable)
    const current = within(chase()!)
      .getAllByRole('row')
      .filter((row) => row.getAttribute('aria-current') === 'true')

    expect(current).toHaveLength(1)
  })

  it('meets the accessibility floor wherever it draws', async () => {
    for (const name of ['chaseMidTable', 'chaseAtTop', 'chaseUnavailable'] as const) {
      await scan(
        <VNextRoot>
          <VNextShellProvider model={shellScenarios.oneCompetition}>
            <VNextLeagues model={leaguesScenarios[name]} />
          </VNextShellProvider>
        </VNextRoot>,
      )
    }
  })
})
