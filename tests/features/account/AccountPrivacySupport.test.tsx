import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccountPrivacySupport } from '../../../src/features/account/AccountPrivacySupport'
import {
  buildAdminSupportHref,
  normaliseSupportEmail,
} from '../../../src/features/account/accountSupport'

describe('Account privacy and administrator support', () => {
  it('explains the pre-lock and post-lock visibility boundary', () => {
    render(<AccountPrivacySupport supportEmail={null} accountEmail="player@example.test" />)

    expect(screen.getByRole('heading', { name: 'What other players can see' })).toBeVisible()
    expect(screen.getByText(/before entries lock, only you can see/i)).toBeVisible()
    expect(screen.getByText(/after lock, signed-in players can inspect frozen entries/i)).toBeVisible()
    expect(screen.getByText(/email address and private account settings are never shown/i)).toBeVisible()
  })

  it('renders a configuration-driven administrator mail link', () => {
    render(
      <AccountPrivacySupport
        supportEmail="support@example.test"
        accountEmail="player@example.test"
      />,
    )

    const link = screen.getByRole('link', { name: 'Contact admin' })
    expect(link).toHaveAttribute(
      'href',
      buildAdminSupportHref('support@example.test', 'player@example.test'),
    )
    expect(link.getAttribute('href')).toContain('Account%20email%3A%20player%40example.test')
  })

  it('shows an honest unavailable state without a valid configured address', () => {
    render(<AccountPrivacySupport supportEmail="not-an-email" accountEmail={null} />)

    expect(screen.queryByRole('link', { name: 'Contact admin' })).not.toBeInTheDocument()
    expect(screen.getByText(/support address has not been configured/i)).toBeVisible()
  })

  it('normalises only valid support addresses', () => {
    expect(normaliseSupportEmail(' support@example.test ')).toBe('support@example.test')
    expect(normaliseSupportEmail('')).toBeNull()
    expect(normaliseSupportEmail('wrong')).toBeNull()
  })
})
