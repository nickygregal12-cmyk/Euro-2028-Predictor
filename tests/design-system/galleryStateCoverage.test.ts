import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The component gallery, against the state matrix it is supposed to render.
 *
 * `ComponentsPreview` is the declared component-and-state harness — the
 * modernisation execution authority names it instead of a second component
 * workshop. That only means something if the states it renders are related to
 * the states the plan defines; otherwise "the gallery covers the states" is a
 * claim nobody checks, which is how offline, unavailable and conflict stayed
 * missing across roughly seventy sections while the harness looked complete.
 *
 * §9.1 (page data states) and §9.2 (user action states) are the authority. Each
 * state below is either rendered by a section of its own, covered by the
 * ordinary component sections, or outstanding with the reason it is not there
 * yet. An unlisted state fails, and so does a stale entry.
 */

const source = readFileSync(
  resolve(process.cwd(), 'src/dev/ComponentsPreview.tsx'),
  'utf8',
)

type Disposition =
  /** Has a dedicated `State — <name>` section in the gallery. */
  | { kind: 'section' }
  /** Rendered as a by-product of the ordinary component sections. */
  | { kind: 'covered'; where: string }
  /** Not rendered yet, with the reason. */
  | { kind: 'outstanding'; reason: string }

const STATE_MATRIX: ReadonlyArray<readonly [state: string, disposition: Disposition]> = [
  // §9.1 — page data states.
  [
    'initial loading',
    { kind: 'covered', where: 'the Skeleton section and the layout-shaped card skeletons' },
  ],
  [
    'refreshing',
    {
      kind: 'outstanding',
      reason:
        'needs a component that shows content while newer data is requested; no shared primitive expresses subtle in-place progress yet',
    },
  ],
  ['ready', { kind: 'covered', where: 'every component section renders its ready state first' }],
  ['partial', { kind: 'covered', where: 'the LeagueTable no-movement-data and no-zones sections' }],
  [
    'empty',
    { kind: 'covered', where: 'the EmptyState section, the empty Matches tab and the no-leagues snapshot' },
  ],
  ['unavailable', { kind: 'section' }],
  ['error retryable', { kind: 'covered', where: 'the Alert section’s dismissible error' }],
  [
    'error blocking',
    {
      kind: 'outstanding',
      reason:
        'a full-page contract or security failure with correlation information — it is a route-level surface rather than a component, so it belongs with the route work',
    },
  ],
  [
    'stale',
    {
      kind: 'outstanding',
      reason:
        'needs a freshness-timestamp treatment that no component owns yet; the label and the write restriction have to be decided together',
    },
  ],
  ['offline', { kind: 'section' }],

  // §9.2 — user action states.
  ['conflict', { kind: 'section' }],
]

/** A dedicated section is declared as `<Section title="State — <name> ...">`. */
function hasSection(state: string): boolean {
  return new RegExp(`<Section title="State — ${state}\\b`).test(source)
}

describe('component gallery state coverage', () => {
  it('reads the harness, so the sweep is not vacuous', () => {
    // A renamed file or a changed Section idiom would empty this and make
    // every assertion below pass by checking nothing.
    expect(source.length).toBeGreaterThan(10_000)
    expect(source).toMatch(/<Section title="/)
  })

  it('renders a section for every state that claims one', () => {
    const missing = STATE_MATRIX.filter(
      ([state, disposition]) => disposition.kind === 'section' && !hasSection(state),
    ).map(([state]) => state)

    expect(
      missing,
      `these states are recorded as having their own gallery section but none is ` +
        `declared in ComponentsPreview: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('closes the three states the inventory named as the gap', () => {
    // Named individually rather than left to the sweep above: these three are
    // the ones the cross-stage inventory called out, and a future edit that
    // deletes one should fail against that item rather than against a list.
    for (const state of ['offline', 'unavailable', 'conflict']) {
      expect(hasSection(state), `the ${state} state has no gallery section`).toBe(true)
    }
  })

  it('does not claim a state is outstanding once it has a section', () => {
    const contradictory = STATE_MATRIX.filter(
      ([state, disposition]) => disposition.kind === 'outstanding' && hasSection(state),
    ).map(([state]) => state)

    expect(contradictory, 'states listed as outstanding that are actually rendered').toEqual([])
  })

  it('gives every outstanding state a reason, and every covered state a location', () => {
    for (const [state, disposition] of STATE_MATRIX) {
      if (disposition.kind === 'outstanding') {
        expect(disposition.reason.length, `${state} is outstanding without a reason`).toBeGreaterThan(
          30,
        )
      }
      if (disposition.kind === 'covered') {
        expect(disposition.where.length, `${state} is covered without saying where`).toBeGreaterThan(
          15,
        )
      }
    }
  })

  it('records how much of the matrix is still missing', () => {
    // Three remain: refreshing, blocking error and stale. Asserted as a number
    // so closing one without updating this file fails, rather than the gap
    // quietly shrinking with nobody noticing it had.
    const outstanding = STATE_MATRIX.filter(([, d]) => d.kind === 'outstanding').map(([s]) => s)

    expect(outstanding).toEqual(['refreshing', 'error blocking', 'stale'])
  })
})
