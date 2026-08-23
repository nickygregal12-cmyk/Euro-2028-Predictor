import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextAccountScreen } from '../../src/vnext/integration/account/VNextAccountScreen'

/**
 * The shipping shell renders both physical account controls at once and CSS
 * chooses the phone avatar or desktop rail row. jsdom intentionally sees both,
 * which makes this the right place to pin their shared loading fallback without
 * pretending a network-delayed profile is a separate player identity.
 */
describe('Account affordance while profile state is unresolved', () => {
  it('keeps both shell variants recognisable as Your account / YA', () => {
    render(
      <VNextRoot>
        <VNextAccountScreen
          userId={null}
          authLoading
          displayName={null}
          onShellIntent={() => {}}
        />
      </VNextRoot>,
    )

    expect(screen.getByText('Loading your account', { exact: true })).toBeTruthy()
    const controls = screen.getAllByRole('button', { name: 'Your account' })
    expect(controls).toHaveLength(2)
    for (const control of controls) {
      const text = control.textContent?.trim() ?? ''
      expect(text).toContain('YA')
      expect(text).not.toMatch(/^[.·•]$/)
    }
  })
})
