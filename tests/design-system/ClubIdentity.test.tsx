import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClubIdentity, type ClubIdentityTokens } from '../../src/design-system/ClubIdentity'

const SOLID: ClubIdentityTokens = { monogram: 'ars', primary: '#EF0107' }

function shirt(container: HTMLElement): HTMLElement {
  const node = container.querySelector<HTMLElement>('[data-club-shirt="true"]')
  if (!node) throw new Error('ClubIdentity did not render its shirt mark')
  return node
}

describe('ClubIdentity', () => {
  it('renders the accepted shirt-style mark inside a stable accessible identity box', () => {
    const { container } = render(<ClubIdentity name="Arsenal" tokens={SOLID} />)

    const mark = screen.getByRole('img', { name: 'Arsenal' })
    expect(mark.getAttribute('data-club-shape')).toBe('shirt')
    expect(shirt(container)).toBeTruthy()
  })

  it('falls back to solid when a pattern has no secondary colour', () => {
    const { container } = render(
      <ClubIdentity name="Pattern without secondary" tokens={{ ...SOLID, pattern: 'stripes' }} />,
    )

    const className = shirt(container).getAttribute('class') ?? ''
    expect(className).toContain('solid')
    expect(className).not.toContain('stripes')
  })

  it('keeps the pattern when a secondary colour is present', () => {
    const { container } = render(
      <ClubIdentity
        name="Newcastle United"
        tokens={{ ...SOLID, pattern: 'stripes', secondary: '#FFFFFF' }}
      />,
    )

    expect(shirt(container).getAttribute('class') ?? '').toContain('stripes')
  })

  it('always exposes the full club name, never the monogram, as the accessible name', () => {
    render(<ClubIdentity name="Arsenal" tokens={SOLID} />)

    expect(screen.getByRole('img', { name: 'Arsenal' })).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'ARS' })).toBeNull()
  })

  it('uppercases the visual monogram it was given', () => {
    render(<ClubIdentity name="Arsenal" tokens={SOLID} />)

    expect(screen.getByText('ARS')).toBeTruthy()
  })

  it('hides the monogram without affecting the accessible label', () => {
    render(<ClubIdentity name="Arsenal" tokens={SOLID} hideMonogram />)

    expect(screen.queryByText('ARS')).toBeNull()
    expect(screen.getByRole('img', { name: 'Arsenal' })).toBeTruthy()
  })

  it('keeps the visual shirt decorative so the full club name is announced once', () => {
    const { container } = render(<ClubIdentity name="Arsenal" tokens={SOLID} />)

    expect(shirt(container).getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('img', { name: 'Arsenal' })).toBeTruthy()
  })
})
