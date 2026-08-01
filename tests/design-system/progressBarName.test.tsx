import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from '../../src/design-system/ProgressBar'

/**
 * `ProgressBar` always reaches the accessibility tree with a name.
 *
 * The props now make an unnamed bar a type error, which is the stronger half of
 * the fix. This is the other half: a type is erased at runtime, so a JavaScript
 * consumer, a cast, or a later refactor that widens the union would restore the
 * defect with nothing to notice. Both ways of naming are asserted here through
 * the accessible name rather than through the attribute that carries it, so
 * swapping `aria-labelledby` for `aria-label` — or the reverse — stays passing
 * only while the announcement survives.
 */

describe('ProgressBar accessible name', () => {
  it('names the bar from the visible label', () => {
    render(<ProgressBar value={18} max={36} label="Predictions" showValue />)

    expect(screen.getByRole('progressbar', { name: 'Predictions' })).toBeInTheDocument()
  })

  it('names the bar directly when there is no visible label', () => {
    render(<ProgressBar value={0} max={36} ariaLabel="Predictions complete" />)

    expect(screen.getByRole('progressbar', { name: 'Predictions complete' })).toBeInTheDocument()
  })

  it('carries the value semantics alongside the name', () => {
    // A named bar with no values is a different defect, and the name assertions
    // above would pass on one.
    render(<ProgressBar value={9} max={36} label="Entry completion" />)
    const bar = screen.getByRole('progressbar', { name: 'Entry completion' })

    expect(bar).toHaveAttribute('aria-valuenow', '9')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '36')
  })

  it('clamps the reported value into the declared range', () => {
    // `aria-valuenow` outside min..max is invalid, and the fill width would go
    // with it. Asserted here because the clamp is the only thing preventing a
    // caller's out-of-range value from reaching assistive technology.
    render(<ProgressBar value={99} max={36} label="Overshoot" />)

    expect(screen.getByRole('progressbar', { name: 'Overshoot' })).toHaveAttribute(
      'aria-valuenow',
      '36',
    )
  })
})
