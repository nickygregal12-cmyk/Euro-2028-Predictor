import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClubIdentity, type ClubIdentityTokens } from '../../src/design-system/ClubIdentity'

const SOLID: ClubIdentityTokens = { monogram: 'ars', primary: '#EF0107' }

describe('ClubIdentity', () => {
  it('falls back to solid when a pattern has no secondary colour', () => {
    render(
      <ClubIdentity name="Pattern without secondary" tokens={{ ...SOLID, pattern: 'stripes' }} />,
    )

    const className = screen.getByRole('img').getAttribute('class') ?? ''
    expect(className).toContain('solid')
    expect(className).not.toContain('stripes')
  })

  it('keeps the pattern when a secondary colour is present', () => {
    render(
      <ClubIdentity
        name="Newcastle United"
        tokens={{ ...SOLID, pattern: 'stripes', secondary: '#FFFFFF' }}
      />,
    )

    expect(screen.getByRole('img').getAttribute('class') ?? '').toContain('stripes')
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

  it('marks the monogram decorative so the full club name is announced once', () => {
    const { container } = render(<ClubIdentity name="Arsenal" tokens={SOLID} />)

    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('ARS')
    expect(screen.getByRole('img', { name: 'Arsenal' })).toBeTruthy()
  })
})
