import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyIllustration, Masthead } from '../../src/design-system'

/**
 * The masthead and empty-state marks are decoration, and the two rules that
 * make them safe are easy to lose in a refactor:
 *
 *   1. the masthead never owns the page title (design-system §6, one title
 *      system — `PageShell`'s title props were retired in 2026-07-28 so no
 *      surface could carry two header systems);
 *   2. decorative SVG is hidden from assistive technology, unfocusable and
 *      carries no text (§11.3).
 *
 * Both are asserted here rather than left to review, because a `title` prop
 * added "for convenience" would look entirely reasonable in a diff.
 */

describe('Masthead', () => {
  it('renders the page-owned header content it is given', () => {
    render(
      <Masthead>
        <span>Football Prediction Hub</span>
        <h1>Choose your competition</h1>
      </Masthead>,
    )

    expect(screen.getByRole('heading', { name: 'Choose your competition' })).toBeInTheDocument()
    expect(screen.getByText('Football Prediction Hub')).toBeInTheDocument()
  })

  it('exposes no heading of its own, so the page keeps sole ownership of the title', () => {
    const { container } = render(
      <Masthead>
        <span>eyebrow only</span>
      </Masthead>,
    )

    expect(container.querySelectorAll('h1,h2,h3,h4,h5,h6')).toHaveLength(0)
  })

  it('hides its decoration from assistive technology and from the keyboard', () => {
    const { container } = render(
      <Masthead>
        <h1>Title</h1>
      </Masthead>,
    )

    const decoration = container.querySelector('[aria-hidden="true"]')
    expect(decoration).not.toBeNull()

    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true')
      expect(svg.getAttribute('focusable')).toBe('false')
      expect(svg.querySelector('title, desc, text')).toBeNull()
    }
  })

  it('leaves no focusable element in the decoration', () => {
    const { container } = render(
      <Masthead>
        <h1>Title</h1>
      </Masthead>,
    )

    const decoration = container.querySelector('[aria-hidden="true"]')
    expect(
      decoration?.querySelectorAll('a, button, input, select, textarea, [tabindex]'),
    ).toHaveLength(0)
  })
})

describe('EmptyIllustration', () => {
  it.each(['list', 'complete'] as const)(
    'renders the %s variant as decoration only',
    (variant) => {
      const { container } = render(<EmptyIllustration variant={variant} />)
      const svg = container.querySelector('svg')

      expect(svg).not.toBeNull()
      expect(svg?.getAttribute('aria-hidden')).toBe('true')
      expect(svg?.getAttribute('focusable')).toBe('false')
      expect(svg?.querySelector('title, desc, text')).toBeNull()
      expect(svg?.textContent).toBe('')
    },
  )

  it('defaults to the list variant', () => {
    const { container } = render(<EmptyIllustration />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('distinguishes the two variants, so "complete" is not silently the same drawing', () => {
    const list = render(<EmptyIllustration variant="list" />).container.innerHTML
    const complete = render(<EmptyIllustration variant="complete" />).container.innerHTML
    expect(list).not.toEqual(complete)
  })
})
