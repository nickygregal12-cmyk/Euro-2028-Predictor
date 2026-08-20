import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VNextReducedMotionContext } from '../../src/vnext/foundations/motion'
import { ScopeMarker } from '../../src/vnext/components/navigation/ScopeMarker'

/**
 * THE TRAVELLING SELECTION, AND THE THREE THINGS IT MUST NOT COST.
 *
 * A segmented control's chosen option now carries a pill that MOVES rather
 * than a background that appears. That is the only change, and each of these
 * holds one thing it must not have changed as well: what a screen reader is
 * told, what a player who has asked for less motion gets, and whether the
 * label is still legible over the thing painted behind it.
 */

const root = resolve(__dirname, '../..')

function markerOf(container: HTMLElement): HTMLElement {
  const marker = container.querySelector('[data-vnext-scope-marker]')
  expect(marker, 'the marker should render').not.toBeNull()
  return marker as HTMLElement
}

describe('the segmented-control marker', () => {
  it('is scenery: it carries no name and no role', () => {
    const { container } = render(<ScopeMarker group="probe" />)

    expect(markerOf(container)).toHaveAttribute('aria-hidden', 'true')
    // Nothing about the selection may be said by the pill. `aria-pressed` on
    // the button is the whole of what assistive technology is told, and it was
    // already there before the pill existed.
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('still renders when the player has asked for less motion', () => {
    const { container } = render(
      <VNextReducedMotionContext.Provider value={true}>
        <ScopeMarker group="probe" />
      </VNextReducedMotionContext.Provider>,
    )

    // THE PILL IS NOT THE MOTION. Under the preference the shared layout id is
    // dropped so it stops travelling, but the highlight itself is state and
    // must survive — a reduced-motion player who could no longer see which
    // option was chosen would have lost information, not an animation.
    expect(markerOf(container)).toBeInTheDocument()
  })
})

describe('the surfaces that use it', () => {
  const sources = [
    'src/vnext/matches/MatchesBrowse.tsx',
    'src/vnext/leagues/VNextLeagues.tsx',
  ] as const

  it.each(sources)('%s renders the marker only for the pressed option', (file) => {
    const source = readFileSync(resolve(root, file), 'utf8')
    const markers = source.match(/<ScopeMarker/g) ?? []
    expect(markers.length).toBeGreaterThan(0)

    // Every occurrence is guarded by the same condition that drives
    // `aria-pressed`. Two pills in one group would fight over the layout id.
    for (const line of source.split('\n')) {
      if (!line.includes('<ScopeMarker')) continue
      expect(line, `${file}: an unguarded marker`).toMatch(/\?\s*<ScopeMarker/)
    }
  })

  it.each(sources)('%s gives its option a positioning context', (file) => {
    const styleFile = file.includes('matches')
      ? 'src/vnext/matches/matches.module.css'
      : 'src/vnext/leagues/leagues.module.css'
    const css = readFileSync(resolve(root, styleFile), 'utf8')

    // The marker is `position: absolute; inset: 0`, so without this it would
    // size itself against the page rather than the button it belongs to.
    expect(css).toMatch(/\.scopeOption \{\n(?:[^}]*\n)?\s*position: relative;/)
  })

  it('never lets the pill paint over the words', () => {
    // A positioned element paints above its parent's inline content, so every
    // label sharing a button with the marker needs its own positioning. This
    // is the rule `ScopeMarker`'s docblock states, held here rather than
    // discovered as an unreadable control in a screenshot.
    const matches = readFileSync(resolve(root, 'src/vnext/matches/matches.module.css'), 'utf8')
    const leagues = readFileSync(resolve(root, 'src/vnext/leagues/leagues.module.css'), 'utf8')

    expect(matches).toMatch(/\.scopeLabel \{\n\s*position: relative;/)
    expect(leagues).toMatch(/\.scopeName \{\n\s*position: relative;/)
    expect(leagues).toMatch(/\.scopeCount \{\n\s*position: relative;/)
  })
})
