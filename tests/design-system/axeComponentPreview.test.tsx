import { render } from '@testing-library/react'
import axe from 'axe-core'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

/**
 * Automated accessibility over the whole component gallery, in jsdom.
 *
 * `src/dev/ComponentsPreview.tsx` renders the design system and several feature
 * screens — welcome, profile, head-to-head, match centre, the auth forms — with
 * realistic props, no router state and no database. That makes it the one place
 * every component can be scanned at once, in seconds, with nothing to seed.
 *
 * It found a real defect on its first run: `ProgressBar` rendered
 * `role="progressbar"` with values but no accessible name whenever it was used
 * without a `label`, announced as a bare percentage with nothing saying what was
 * progressing (WCAG 2.0 A, 4.1.2). Every production call site happened to pass a
 * label, so no route scan could have reached it — the gallery's unlabelled
 * variant was the only render of that state anywhere. The props now require a
 * name, so the shape is rejected at compile time as well as here.
 *
 * ## What this does not do
 *
 * It is not a substitute for the browser scans in `e2e/axe-accessibility.spec.ts`
 * and `e2e/axe-unauthenticated.spec.ts`, and it does not clear any deferral in
 * `tests/app/axeRouteCoverage.test.ts`:
 *
 * - jsdom has no layout, so `color-contrast` cannot run at all. It is reported
 *   as incomplete rather than as a pass.
 * - A component in the gallery is not the component in its page. Route-level
 *   composition — landmark structure, heading order across a real layout,
 *   focus order through the app shell — is only visible to the browser scans.
 * - The gallery renders one representative state per component, chosen by
 *   whoever added it, not the states a user reaches.
 *
 * What it does give is breadth and speed: every component, including states a
 * route scan cannot reach, on every run of the unit suite.
 */

/** Same thresholds as the browser scans — WCAG A and AA, serious and critical. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])

describe('component gallery accessibility', () => {
  it(
    'renders every component with no serious or critical WCAG A/AA violations',
    async () => {
      // The gallery reaches the Supabase client through a feature screen's
      // import chain. The values are never used — nothing here makes a request —
      // but the client refuses to construct without them.
      vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'unit-test-anon-key')

      const { ComponentsPreview } = await import('../../src/dev/ComponentsPreview')
      const { container } = render(
        <MemoryRouter>
          <ComponentsPreview />
        </MemoryRouter>,
      )

      const results = await axe.run(container, { runOnly: { type: 'tag', values: TAGS } })

      // Positive controls. An empty container has no violations, and so does a
      // scan that ran no rules — both would report the same clean result as a
      // gallery that is genuinely accessible.
      expect(container.querySelectorAll('*').length).toBeGreaterThan(500)
      expect(results.passes.length).toBeGreaterThan(10)

      const failing = results.violations.filter(
        (violation) => violation.impact && FAIL_IMPACTS.has(violation.impact),
      )
      const summary = failing
        .map(
          (violation) =>
            `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
              .slice(0, 3)
              .map((node) => node.target.join(' '))
              .join(' | ')}`,
        )
        .join('\n')

      expect(failing, summary).toEqual([])
    },
    120_000,
  )
})
