import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { VNextPlayerProfile } from '../../src/vnext/player/VNextPlayerProfile'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import {
  playerProfileScenarioNames,
  playerProfileScenarios,
  shellScenarios,
} from '../../src/vnext/fixtures'
import type { PlayerProfileModel } from '../../src/vnext/models/playerProfile'

/**
 * WHAT IS WORTH GUARDING ABOUT THE STAGE 10 SURFACE.
 *
 * Not a DOM snapshot. Composition, chart geometry on screen, overflow and
 * target sizes are measured in a real browser by
 * `e2e/vnext-player-profile.spec.ts`, because jsdom evaluates no container
 * query and computes no layout.
 *
 * What is held here is the set of promises that must survive any redesign:
 *
 *   1. THE THREE PANELS ARE INDEPENDENT. A refused profile leaves a plotted
 *      season and a head-to-head on screen, because the server's three
 *      boundaries differ.
 *   2. A RETRY IS OFFERED ONLY WHERE A READ FAILED. A refusal answers the same
 *      way every time; a button beside it spends a press proving that.
 *   3. AN UNSETTLED MATCHWEEK IS A SENTENCE, NEVER "0 pts".
 *   4. NO PERCENTAGE IS PRINTED OVER A ZERO DENOMINATOR.
 *   5. THE RECORD APPEARS WITH ITS DENOMINATOR, which is not the strip beneath.
 *   6. AN EMPTY RIVALRY DOES NOT READ AS A DRAW.
 *   7. A RANK IS NEVER PRINTED WITHOUT THE FIELD IT WAS OUT OF.
 *   8. THE CHART IS AN ILLUSTRATION — the same series is a real table.
 *   9. NO PREDICTION SCORELINE APPEARS ANYWHERE.
 *  10. One `<main>`, one `<h1>`, and the accessibility floor, in every world.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])
/** jsdom has no layout, so it can neither confirm nor deny a contrast ratio. */
const JSDOM_CANNOT_EVALUATE = new Set(['color-contrast'])

async function scan(ui: ReactElement) {
  const { unmount } = render(ui)
  try {
    const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } })
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

/**
 * THE PAGE INSIDE A WORLD, AND NEVER A SECOND SHELL.
 *
 * `VNextPlayerProfile` renders `VNextShell` itself, so wrapping it in another
 * gives the document two `<main>` landmarks. The world reaches the page's own
 * shell through the provider, exactly as the connected integration does.
 */
function renderProfile(model: PlayerProfileModel, onRetry?: () => void) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextPlayerProfile model={model} onRetry={onRetry} />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

function panel(zone: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-vnext-zone="${zone}"]`)
  if (found === null) throw new Error(`no panel for zone "${zone}"`)
  return found
}

/* ------------------------------------------------------------------------ *
 * 1. The three panels are independent
 * ------------------------------------------------------------------------ */

describe('a refusal in one panel is not a refusal in another', () => {
  it('keeps the chart and the comparison when the profile is refused', () => {
    renderProfile(playerProfileScenarios.profileRefused)

    expect(screen.getByText(/share no private league/i)).toBeTruthy()
    // Both contract-192 panels answered, because they need only `compare`.
    expect(within(panel('rank')).getByRole('figure')).toBeTruthy()
    expect(within(panel('compare')).getByRole('table')).toBeTruthy()
  })

  it('keeps the chart when the profile and the comparison both refuse', () => {
    // The weakest reach that still plots a season: contract 151 and the
    // rivalry are both refused, and the positions are still the reader's to
    // see, because that read needs only `compare`.
    renderProfile(playerProfileScenarios.rankOnly)

    expect(screen.getByText(/share no private league/i)).toBeTruthy()
    expect(screen.getByText(/may not compare with this player/i)).toBeTruthy()
    expect(within(panel('rank')).getByRole('figure')).toBeTruthy()
  })

  it('keeps the profile when the positions are the panel that refuses', () => {
    renderProfile({
      ...playerProfileScenarios.openProfile,
      rankHistory: { kind: 'refused' },
    })

    expect(screen.getByText(/positions are not visible to you/i)).toBeTruthy()
    expect(within(panel('summary')).getByText('Position')).toBeTruthy()
    expect(within(panel('compare')).getByRole('table')).toBeTruthy()
  })

  it('draws all three panels whatever any one of them answered', () => {
    for (const name of playerProfileScenarioNames) {
      const { unmount } = renderProfile(playerProfileScenarios[name])
      expect(document.querySelectorAll('[data-vnext-zone="summary"]')).toHaveLength(1)
      expect(document.querySelectorAll('[data-vnext-zone="rank"]')).toHaveLength(1)
      expect(document.querySelectorAll('[data-vnext-zone="compare"]')).toHaveLength(1)
      unmount()
    }
  })
})

/* ------------------------------------------------------------------------ *
 * 2. A retry belongs only to a read that failed
 * ------------------------------------------------------------------------ */

describe('a retry is offered only where a read failed', () => {
  it('offers one beside each failed panel', () => {
    renderProfile(playerProfileScenarios.allUnavailable, vi.fn())
    expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(3)
  })

  it('offers none for a refusal, which will answer the same way next time', () => {
    renderProfile(playerProfileScenarios.rankOnly, vi.fn())
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('offers none for a player who has not entered', () => {
    renderProfile(playerProfileScenarios.notEntered, vi.fn())
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('offers none for an unaddressable read', () => {
    renderProfile(playerProfileScenarios.unaddressable, vi.fn())
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('asks the host when pressed', async () => {
    const onRetry = vi.fn()
    renderProfile(playerProfileScenarios.profileUnavailable, onRetry)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('announces the failure to a reader who cannot see it', () => {
    // The message is the live region and the control sits outside it, so a
    // second failure is announced to somebody who just asked for this answer.
    renderProfile(playerProfileScenarios.profileUnavailable, vi.fn())
    const status = screen.getAllByRole('status')
    expect(status.some((node) => /could not load/i.test(node.textContent ?? ''))).toBe(true)
    expect(status.some((node) => within(node).queryByRole('button') !== null)).toBe(false)
  })
})

/* ------------------------------------------------------------------------ *
 * 3–4. Honest zeroes
 * ------------------------------------------------------------------------ */

describe('an unsettled matchweek is a sentence, never a nought', () => {
  it('says so rather than printing zero points', () => {
    renderProfile(playerProfileScenarios.pendingMatchweek)

    const history = panel('history')
    expect(within(history).getByText('Not settled yet')).toBeTruthy()
    expect(within(history).queryByText('0')).toBeNull()
  })

  it('still prints a genuine nought where one was banked', () => {
    renderProfile(playerProfileScenarios.noAccuracy)
    // Zero season points from zero matchweeks is a real, settled figure.
    expect(within(panel('summary')).getAllByText('0').length).toBeGreaterThan(0)
  })
})

describe('no percentage is printed over a zero denominator', () => {
  it('prints counts and no share for a player who has predicted nothing', () => {
    renderProfile(playerProfileScenarios.noAccuracy)
    expect(panel('summary').textContent).not.toContain('%')
  })

  it('prints shares where there were fixtures to be right about', () => {
    renderProfile(playerProfileScenarios.openProfile)
    expect(panel('summary').textContent).toContain('%')
  })

  it('prints no share in the comparison either when nothing was compared', () => {
    renderProfile(playerProfileScenarios.newSeason)
    expect(panel('compare').textContent).not.toContain('%')
  })
})

/* ------------------------------------------------------------------------ *
 * 5–6. The comparison
 * ------------------------------------------------------------------------ */

describe('the record appears with the denominator it was counted over', () => {
  it('states thirty matchweeks beside a five-matchweek strip', () => {
    renderProfile(playerProfileScenarios.truncatedWindow)

    const compare = panel('compare')
    expect(compare.textContent).toContain('30 matchweeks')
    // The strip is a window on that, and is visibly shorter.
    expect(within(compare).getAllByRole('listitem')).toHaveLength(5)
  })

  it('never prints a record whose parts sum to the strip instead', () => {
    renderProfile(playerProfileScenarios.truncatedWindow)
    const compare = panel('compare')
    expect(compare.textContent).toContain('14')
    expect(compare.textContent).toContain('13')
  })
})

describe('an empty rivalry does not read as a draw', () => {
  it('says there is nothing to compare rather than printing 0-0-0', () => {
    renderProfile(playerProfileScenarios.newSeason)

    const compare = panel('compare')
    expect(compare.textContent).toMatch(/nothing to compare/i)
    expect(within(compare).queryByRole('table')).toBeNull()
  })

  it('draws a genuine level rivalry as a comparison', () => {
    // Same symmetric record, opposite meaning. Only the denominator separates
    // them, and the two pages must not look alike.
    renderProfile(playerProfileScenarios.levelRivalry)

    const compare = panel('compare')
    expect(within(compare).getByRole('table')).toBeTruthy()
    expect(compare.textContent).toMatch(/level on points/i)
  })

  it('says there is no one to compare with on your own profile', () => {
    renderProfile(playerProfileScenarios.yourOwnProfile)
    expect(panel('compare').textContent).toMatch(/your own profile/i)
  })
})

describe('two players with one display name stay two columns', () => {
  it('always labels the caller`s column "You"', () => {
    renderProfile(playerProfileScenarios.duplicateName)

    const headers = within(panel('compare')).getAllByRole('columnheader')
    const labels = headers.map((header) => header.textContent?.trim())
    expect(labels).toContain('You')
    expect(labels).toContain('Sam Docherty')
    // Two distinguishable headings even though the two people share a name.
    expect(new Set(labels).size).toBe(labels.length)
  })
})

/* ------------------------------------------------------------------------ *
 * 7. A rank never travels without its field
 * ------------------------------------------------------------------------ */

describe('a position is never printed without the field it was out of', () => {
  it('prints the field beside the summary position', () => {
    renderProfile(playerProfileScenarios.openProfile)
    expect(within(panel('summary')).getByText(/2nd of 412/)).toBeTruthy()
  })

  it('says "not yet ranked" rather than a zeroth place', () => {
    renderProfile(playerProfileScenarios.noStandingYet)
    expect(within(panel('compare')).getByText('Not yet ranked')).toBeTruthy()
  })

  it('names the field beneath the chart, and says when it moved', () => {
    renderProfile(playerProfileScenarios.fieldChanged)
    expect(panel('rank').textContent).toMatch(/field that changed/i)
    expect(panel('rank').textContent).toContain('412')
  })
})

/* ------------------------------------------------------------------------ *
 * 8. The chart is an illustration
 * ------------------------------------------------------------------------ */

describe('the chart is readable without seeing it', () => {
  it('hides the drawing and carries the same series as a table', () => {
    renderProfile(playerProfileScenarios.climbing)

    const chart = panel('rank-chart')
    const svg = chart.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')

    const table = within(chart).getByRole('table')
    // Five settled matchweeks, five rows, one per plotted point.
    expect(within(table).getAllByRole('row')).toHaveLength(6)
  })

  it('states every position in the table with its field', () => {
    renderProfile(playerProfileScenarios.climbing)
    const table = within(panel('rank-chart')).getByRole('table')
    expect(within(table).getByText('301st of 412')).toBeTruthy()
    expect(within(table).getByText('12th of 412')).toBeTruthy()
  })

  it('says a season with nothing settled has no position to plot', () => {
    renderProfile(playerProfileScenarios.newSeason)
    expect(panel('rank').textContent).toMatch(/no position to plot/i)
    expect(panel('rank').querySelector('svg')).toBeNull()
  })

  it('draws a marker and no line for one settled matchweek', () => {
    renderProfile(playerProfileScenarios.singlePoint)
    const chart = panel('rank-chart')
    expect(chart.querySelectorAll('circle')).toHaveLength(1)
    expect(chart.querySelectorAll('path')).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------------ *
 * 9. Nothing leaks
 * ------------------------------------------------------------------------ */

describe('no prediction reaches the screen', () => {
  it('counts the picks rather than printing scorelines', () => {
    renderProfile(playerProfileScenarios.openProfile)

    const history = panel('history')
    expect(within(history).getAllByText(/\d+ predictions/).length).toBeGreaterThan(0)
    // An en-dashed scoreline against an opaque fixture id would be a score
    // against nobody, and the payload carries no team to name.
    expect(history.textContent).not.toMatch(/\d–\d/)
  })

  it('counts only what is shown and never claims a share of the season', () => {
    // The gaps in the revealed history mean "not yet revealed" OR "they did not
    // play it", and the payload does not say which.
    renderProfile(playerProfileScenarios.openProfile)
    const summary = panel('summary')
    expect(summary.textContent).toContain('matchweeks you can see')
    expect(summary.textContent).not.toMatch(/\d+ of \d+ matchweeks/)
  })
})

/* ------------------------------------------------------------------------ *
 * 10. Structure and the accessibility floor
 * ------------------------------------------------------------------------ */

describe('every world is one page', () => {
  it.each(playerProfileScenarioNames)('%s has one main and one h1', (name) => {
    renderProfile(playerProfileScenarios[name])
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('names the page "Player" when no read said who this is', () => {
    renderProfile(playerProfileScenarios.allUnavailable)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Player')
  })
})

describe('the accessibility floor', () => {
  it.each(playerProfileScenarioNames)('%s has no critical or serious violation', async (name) => {
    await scan(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextPlayerProfile model={playerProfileScenarios[name]} onRetry={vi.fn()} />
        </VNextShellProvider>
      </VNextRoot>,
    )
  })
})
