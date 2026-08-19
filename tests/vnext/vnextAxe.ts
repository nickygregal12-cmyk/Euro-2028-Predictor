import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { expect } from 'vitest'
import axe from 'axe-core'

/**
 * THE ACCESSIBILITY SCAN EVERY vNEXT SURFACE RUNS.
 *
 * Stages 8–12 each carried their own copy of this block. Stage 13 added six
 * surfaces and carried none of them, so the stage that introduced a brand-new
 * interactive control — the rules segmented control — shipped with no axe gate
 * at all. Extracting it is what makes "every surface scans" a property of the
 * suite rather than of whoever wrote the last test file.
 *
 * WHAT IT FAILS ON. Critical and serious only, over WCAG 2.0 A/AA, 2.1 AA and
 * 2.2 AA. `incomplete` results count, because "axe could not decide" is not
 * evidence of passing — except for contrast, which jsdom genuinely cannot
 * evaluate because it has no layout. That exception is named rather than
 * blanket-ignored so it cannot quietly grow.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])
/** jsdom has no layout, so it can neither confirm nor deny a contrast ratio. */
const JSDOM_CANNOT_EVALUATE = new Set(['color-contrast'])

export async function expectNoAxeViolations(ui: ReactElement): Promise<void> {
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
