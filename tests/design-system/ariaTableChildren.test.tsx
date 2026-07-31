import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GroupTable } from '../../src/design-system/GroupTable'
import { LeagueTable } from '../../src/design-system/LeagueTable'
import { ThirdPlaceTable } from '../../src/design-system/ThirdPlaceTable'

/**
 * ARIA child roles inside every grid-based table in the design system.
 *
 * `role="table"` may only contain `row` and `rowgroup` children. These
 * components replace native table layout with a CSS grid and re-declare the
 * semantics by hand, so nothing in the type system or the browser stops a
 * wrongly-roled child being added — it renders identically and reads wrongly.
 *
 * This is not hypothetical. `ThirdPlaceTable`'s elimination-line divider was
 * `role="separator"` inside `role="table"`, which axe reports as
 * `aria-required-children` at **critical** impact against WCAG 2.0 A (1.3.1).
 * It went unnoticed because `/predict/third-place` was outside the axe scan
 * until the route coverage was extended, and the divider looks correct.
 *
 * The rule is asserted here as well as in the browser scan because a unit test
 * runs in seconds against every table at once, including states a route scan
 * may not reach — an empty table, or one where the divider does not render.
 */

const TEAM = { countryCode: 'gb-eng', name: 'England' }

/** Every child of a `role="table"` must be a row or a rowgroup. */
const ALLOWED_CHILD_ROLES = new Set(['row', 'rowgroup'])

function invalidChildRolesIn(container: HTMLElement): string[] {
  const offenders: string[] = []

  for (const table of container.querySelectorAll('[role="table"]')) {
    for (const child of Array.from(table.children)) {
      const role = child.getAttribute('role')
      // An element with no role at all is a presentational wrapper as far as
      // the accessibility tree is concerned, and axe does not flag it.
      if (role === null) continue
      if (!ALLOWED_CHILD_ROLES.has(role)) {
        offenders.push(`role="${role}" inside role="table"`)
      }
    }
  }

  return offenders
}

describe('grid tables declare only valid ARIA children', () => {
  it('ThirdPlaceTable, including the elimination divider', () => {
    // `qualifyCount` is set so the divider actually renders — the regression
    // this guards is invisible when it does not.
    const { container } = render(
      <ThirdPlaceTable
        rows={[1, 2, 3].map((position) => ({
          position,
          groupLetter: 'A',
          team: TEAM,
          played: 3,
          goalDifference: 0,
          points: 4,
        }))}
        qualifyCount={2}
      />,
    )

    expect(container.querySelector('[role="table"]')).toBeTruthy()
    // Positive control: without the divider present, the assertion below would
    // pass against a table that simply never renders the offending node.
    expect(container.textContent).toContain('Elimination line')
    expect(invalidChildRolesIn(container)).toEqual([])
  })

  it('LeagueTable, including the split divider', () => {
    const { container } = render(
      <LeagueTable
        caption="Scottish Premiership"
        rows={[1, 2, 3, 4].map((position) => ({
          position,
          name: `Club ${position}`,
          club: { monogram: 'ABC', primary: '#EF0107' },
          played: 33,
          goalDifference: 0,
          points: 40,
        }))}
        splitAfter={2}
        splitLabels={{ top: 'Top half', bottom: 'Bottom half' }}
      />,
    )

    expect(container.textContent).toContain('Bottom half')
    expect(invalidChildRolesIn(container)).toEqual([])
  })

  it('GroupTable', () => {
    const { container } = render(
      <GroupTable
        caption="Group A"
        rows={[1, 2, 3, 4].map((position) => ({
          position,
          team: TEAM,
          played: 3,
          goalDifference: 0,
          points: 4,
        }))}
      />,
    )

    expect(container.querySelector('[role="table"]')).toBeTruthy()
    expect(invalidChildRolesIn(container)).toEqual([])
  })

  it('detects an invalid child when one is present', () => {
    // The detector's own positive control. Without this, a helper that always
    // returned an empty array would satisfy every assertion above — which is
    // exactly how the original defect survived a green suite.
    const { container } = render(
      <div role="table" aria-label="Deliberately wrong">
        <div role="separator" aria-label="Elimination line" />
      </div>,
    )

    expect(invalidChildRolesIn(container)).toEqual(['role="separator" inside role="table"'])
  })
})
