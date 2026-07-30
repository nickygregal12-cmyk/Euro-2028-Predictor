import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClubIdentity, type ClubIdentityTokens } from '../../src/design-system/ClubIdentity'

/**
 * `ClubIdentity` is the only path by which a club is rendered (ADR 0017), so the
 * cases below are the ones where getting it wrong is invisible in the happy
 * path: a pattern with a missing colour, and the accessible name diverging from
 * the club actually shown.
 */

const SOLID: ClubIdentityTokens = { monogram: 'ars', primary: '#EF0107' }

describe('ClubIdentity', () => {
  it('falls back to solid when a pattern has no secondary colour', () => {
    // The degenerate case. Without the fallback the component renders a
    // gradient against `undefined`, which is a visible defect that no type
    // check catches — `secondary` is legitimately optional for 'solid'.
    const { container } = render(
      <ClubIdentity name="Pattern without secondary" tokens={{ ...SOLID, pattern: 'stripes' }} />,
    )

    const mark = container.querySelector('[role="img"]')
    expect(mark).toBeTruthy()

    const className = mark?.getAttribute('class') ?? ''
    expect(className).toContain('solid')
    expect(className).not.toContain('stripes')
  })

  it('keeps the pattern when a secondary colour is present', () => {
    // The positive control for the assertion above. Without it, a component
    // that always rendered solid would pass the fallback test.
    const { container } = render(
      <ClubIdentity
        name="Newcastle United"
        tokens={{ ...SOLID, pattern: 'stripes', secondary: '#FFFFFF' }}
      />,
    )

    const className = container.querySelector('[role="img"]')?.getAttribute('class') ?? ''
    expect(className).toContain('stripes')
  })

  it('always exposes the full club name, never the monogram', () => {
    // The monogram is a three-letter visual shorthand. A screen reader
    // announcing "ARS" instead of "Arsenal" would be a regression that looks
    // fine on screen.
    render(<ClubIdentity name="Arsenal" tokens={SOLID} />)

    expect(screen.getByRole('img', { name: 'Arsenal' })).toBeTruthy()
  })

  it('uppercases the monogram it was given', () => {
    render(<ClubIdentity name="Arsenal" tokens={SOLID} />)

    expect(screen.getByText('ARS')).toBeTruthy()
  })

  it('hides the monogram without affecting the accessible label', () => {
    // `hideMonogram` exists for rows where adjacent text already names the
    // club. It must remove the visual repetition only — the mark still has to
    // identify itself to assistive technology.
    render(<ClubIdentity name="Arsenal" tokens={SOLID} hideMonogram />)

    expect(screen.queryByText('ARS')).toBeNull()
    expect(screen.getByRole('img', { name: 'Arsenal' })).toBeTruthy()
  })

  it('marks the monogram decorative so it is not announced twice', () => {
    const { container } = render(<ClubIdentity name="Arsenal" tokens={SOLID} />)

    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('ARS')
  })
})
