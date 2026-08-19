import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { VNextLms } from '../../src/vnext/lms/VNextLms'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { lmsScenarioNames, lmsScenarios, shellScenarios } from '../../src/vnext/fixtures'
import type { LmsPageModel } from '../../src/vnext/models/lms'

/**
 * WHAT IS WORTH GUARDING ABOUT THE STAGE 11 SURFACE.
 *
 * Composition, target sizes and overflow are measured in a real browser by
 * `e2e/vnext-lms.spec.ts`. What is held here is the set of promises that must
 * survive any redesign:
 *
 *   1. A CLUB IS PRESSABLE IFF THE MODEL SAID SO. Used, chosen and shut clubs
 *      are TEXT — not disabled buttons — and the press emits the id the option
 *      carried, never one read from somewhere else.
 *   2. SURVIVAL IS THE STANDING, NEVER THE RESULT. A won pick beside an
 *      elimination must read as an elimination.
 *   3. THERE IS NO SCORE ANYWHERE. This is not Match Predictor, and the
 *      clearest structural proof is that the page has no numeric input at all.
 *   4. THE DEADLINE IS SAID, NOT COUNTED.
 *   5. NOT-OFFERED, NOT-ENTERED, NO-ROUND and UNAVAILABLE are four sentences.
 *   6. A WRITE THAT DID NOT LAND SAYS WHICH KIND IT WAS.
 *   7. One `<main>`, one `<h1>`, and the accessibility floor, in every world.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])
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
      failing.map((v) => `${v.id} (${v.impact}): ${v.help}`).join('\n'),
    ).toEqual([])
  } finally {
    unmount()
  }
}

function renderLms(
  model: LmsPageModel,
  options: {
    onIntent?: (intent: { kind: 'pick'; teamId: string }) => void
    onRetry?: () => void
    busy?: boolean
    notice?: 'conflict' | 'refused' | 'failed'
  } = {},
) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextLms
          model={model}
          onIntent={options.onIntent}
          onRetry={options.onRetry}
          busy={options.busy}
          notice={options.notice}
        />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

function zone(name: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-vnext-zone="${name}"]`)
  if (found === null) throw new Error(`no zone "${name}"`)
  return found
}

/* ------------------------------------------------------------------ *
 * 1. A club is pressable iff the model said so
 * ------------------------------------------------------------------ */

describe('a club is pressable only where the model carried an id', () => {
  it('gives a pickable club a button and a used one plain text', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn() })

    expect(screen.getByRole('button', { name: 'Celtic' })).toBeTruthy()
    // Hearts is spent: present, legible, and not a control.
    expect(screen.queryByRole('button', { name: /Hearts/ })).toBeNull()
    expect(within(zone('pick-list')).getByText('Hearts')).toBeTruthy()
  })

  it('offers no control at all once the round is locked', () => {
    renderLms(lmsScenarios.lockedRound, { onIntent: vi.fn() })
    expect(within(zone('pick-list')).queryAllByRole('button')).toEqual([])
  })

  it('offers no control to an eliminated player', () => {
    renderLms(lmsScenarios.eliminated, { onIntent: vi.fn() })
    expect(within(zone('pick-list')).queryAllByRole('button')).toEqual([])
  })

  it('marks the held club rather than offering it again', () => {
    renderLms(lmsScenarios.pickMade, { onIntent: vi.fn() })
    expect(screen.queryByRole('button', { name: /Celtic/ })).toBeNull()
    expect(within(zone('pick-list')).getByText('Your pick')).toBeTruthy()
  })

  it('emits the id the option carried', async () => {
    const onIntent = vi.fn()
    renderLms(lmsScenarios.openRound, { onIntent })

    await userEvent.click(screen.getByRole('button', { name: 'Celtic' }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'pick', teamId: 'team-celtic' })
  })

  it('offers nothing to press when the host wired no intent', () => {
    renderLms(lmsScenarios.openRound)
    expect(within(zone('pick-list')).queryAllByRole('button')).toEqual([])
  })

  it('never renders a disabled club control', () => {
    // A disabled button advertises something the player cannot have and invites
    // the press anyway. Everywhere a club cannot be picked it is text.
    for (const name of lmsScenarioNames) {
      const { unmount } = renderLms(lmsScenarios[name], { onIntent: vi.fn() })
      const disabled = [...document.querySelectorAll('button[disabled]')].filter(
        (node) => !(node.textContent ?? '').includes('Try again'),
      )
      expect(disabled, `${name} renders a disabled club`).toEqual([])
      unmount()
    }
  })

  it('waits rather than queueing a second pick while one is in flight', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn(), busy: true })
    const celtic = screen.getByRole('button', { name: 'Celtic' })
    expect(celtic).toHaveProperty('disabled', true)
  })
})

/* ------------------------------------------------------------------ *
 * 2. Survival is the standing
 * ------------------------------------------------------------------ */

describe('survival is the standing, never the result', () => {
  it('says eliminated even though the picked club won', () => {
    renderLms(lmsScenarios.wonButEliminated)

    expect(zone('standing').textContent).toContain('You have been eliminated')
    // The club's result is still shown as the fact it is.
    expect(document.body.textContent).toContain('Celtic')
  })

  it('says still in even though the picked club lost', () => {
    renderLms(lmsScenarios.lostButAlive)
    expect(zone('standing').textContent).toContain('You are still in')
  })

  it('does not read a postponed pick as bad news', () => {
    renderLms(lmsScenarios.postponedPick)
    expect(zone('standing').textContent).toContain('You are still in')
  })

  it('says nothing about a standing the page does not have', () => {
    renderLms(lmsScenarios.notEntered)
    expect(document.querySelector('[data-vnext-zone="standing"]')).toBeNull()
  })

  it('names the champion', () => {
    renderLms(lmsScenarios.champion)
    expect(zone('standing').textContent).toContain('last one standing')
  })
})

/* ------------------------------------------------------------------ *
 * 3. It is not Match Predictor
 * ------------------------------------------------------------------ */

describe('it is a choice, not a form', () => {
  it('has no numeric input anywhere, in any world', () => {
    // THE STRUCTURAL DIFFERENCE. Match Predictor takes a score on every
    // fixture; this takes one club and no numbers at all.
    for (const name of lmsScenarioNames) {
      const { unmount } = renderLms(lmsScenarios[name], { onIntent: vi.fn() })
      expect(document.querySelectorAll('input'), `${name} has an input`).toHaveLength(0)
      unmount()
    }
  })

  it('prints no scoreline in the pick list', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn() })
    expect(zone('pick-list').textContent).not.toMatch(/\d\s*[–-]\s*\d/)
  })

  it('says what the game costs, in one line', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn() })
    expect(document.body.textContent).toContain('You cannot use it again')
  })
})

/* ------------------------------------------------------------------ *
 * 4. The deadline is said, not counted
 * ------------------------------------------------------------------ */

describe('the deadline is said rather than counted', () => {
  it('prints when picks close for an open round', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn() })
    expect(zone('round').textContent).toContain('Picks close')
  })

  it('prints when they closed for a locked one', () => {
    renderLms(lmsScenarios.lockedRound)
    expect(zone('round').textContent).toContain('Picks closed')
  })

  it('says there is no deadline rather than inventing one', () => {
    renderLms(lmsScenarios.unscheduled)
    expect(zone('round').textContent).toContain('No deadline set yet')
  })
})

/* ------------------------------------------------------------------ *
 * 5–6. Four sentences, and three write outcomes
 * ------------------------------------------------------------------ */

describe('four different sentences about four different subjects', () => {
  it('says the competition does not run this game', () => {
    renderLms(lmsScenarios.notOffered)
    expect(document.body.textContent).toContain('does not run Last Man Standing')
  })

  it('says the player has not entered, and offers no join door', () => {
    renderLms(lmsScenarios.notEntered)
    expect(document.body.textContent).toContain('not entered')
    // Stage 11 does not own entry; a button here would be a door onto a
    // corridor that has not been built.
    expect(screen.queryByRole('button', { name: /join/i })).toBeNull()
  })

  it('says there is no round right now', () => {
    renderLms(lmsScenarios.noRound)
    expect(document.body.textContent).toContain('no round to play')
  })

  it('says the read did not answer, and only that one offers a retry', () => {
    const onRetry = vi.fn()
    const failed = renderLms(lmsScenarios.unavailable, { onRetry })
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    // UNMOUNTED BEFORE THE LOOP. `screen` queries the whole document, so a
    // render left standing would answer for the world being checked next.
    failed.unmount()

    for (const name of ['notOffered', 'notEntered', 'noRound', 'lockedRound'] as const) {
      const { unmount } = renderLms(lmsScenarios[name], { onRetry })
      expect(screen.queryByRole('button', { name: 'Try again' }), name).toBeNull()
      unmount()
    }
  })
})

describe('a write that did not land says which kind it was', () => {
  it('tells a conflict from a refusal from a fault', () => {
    const conflict = renderLms(lmsScenarios.openRound, { notice: 'conflict' })
    expect(document.body.textContent).toContain('changed somewhere else')
    conflict.unmount()

    const refused = renderLms(lmsScenarios.openRound, { notice: 'refused' })
    expect(document.body.textContent).toContain('would not take that pick')
    refused.unmount()

    renderLms(lmsScenarios.openRound, { notice: 'failed' })
    expect(document.body.textContent).toContain('Nothing has changed')
  })

  it('announces it to a reader who cannot see it', () => {
    renderLms(lmsScenarios.openRound, { notice: 'conflict' })
    const status = screen.getAllByRole('status')
    expect(status.some((node) => /changed somewhere else/.test(node.textContent ?? ''))).toBe(true)
  })

  it('says nothing at all when the last pick landed', () => {
    renderLms(lmsScenarios.pickMade, { onIntent: vi.fn() })
    expect(document.body.textContent).not.toContain('changed somewhere else')
    expect(document.body.textContent).not.toContain('could not save')
  })
})

/* ------------------------------------------------------------------ *
 * 7. Structure and the accessibility floor
 * ------------------------------------------------------------------ */

describe('every world is one page', () => {
  it.each(lmsScenarioNames)('%s has one main and one h1', (name) => {
    renderLms(lmsScenarios[name], { onIntent: vi.fn() })
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('lists the clubs already spent', () => {
    renderLms(lmsScenarios.manyUsed, { onIntent: vi.fn() })
    expect(zone('used').textContent).toContain('Hearts')
    expect(zone('used').textContent).toContain('Dundee United')
  })

  it('counts what is still pickable', () => {
    renderLms(lmsScenarios.oneClubLeft, { onIntent: vi.fn() })
    // THE SINGULAR, because this is the round where the count is the warning.
    expect(zone('round').textContent).toContain('1 club still available')
    expect(zone('round').textContent).not.toContain('1 clubs')
  })
})

describe('the accessibility floor', () => {
  it.each(lmsScenarioNames)('%s has no critical or serious violation', async (name) => {
    await scan(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextLms model={lmsScenarios[name]} onIntent={vi.fn()} onRetry={vi.fn()} />
        </VNextShellProvider>
      </VNextRoot>,
    )
  })
})
