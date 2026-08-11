import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * What a visitor gets when the security check cannot load.
 *
 * THE DEFECT. Every auth form gates submit on holding a Turnstile token, and
 * the only failure signal was `onToken(null)` — indistinguishable from "not
 * solved yet". A content blocker, a corporate proxy or an offline device
 * therefore produced a sign-up page with a permanently disabled button, no
 * widget and no message. The visitor could not create an account and could not
 * find out why.
 *
 * These assertions drive the widget through `onStatusChange`, which is the
 * seam. Loading a real cross-origin script is not something jsdom can do, and
 * a test that mocked the script tag would be testing the mock.
 */

vi.mock('../../../src/features/auth/turnstileConfig', () => ({
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  turnstileEnabled: true,
}))

let reportStatus: ((status: 'loading' | 'ready' | 'failed') => void) | null = null
let mountCount = 0

vi.mock('../../../src/features/auth/TurnstileWidget', () => ({
  TurnstileWidget: ({
    onStatusChange,
  }: {
    onStatusChange?: (status: 'loading' | 'ready' | 'failed') => void
  }) => {
    mountCount += 1
    reportStatus = onStatusChange ?? null
    return <div data-testid="turnstile-widget" />
  },
}))

import { TurnstileField } from '../../../src/features/auth/TurnstileField'

afterEach(() => {
  reportStatus = null
  mountCount = 0
})

function renderField() {
  const onToken = vi.fn()
  const result = render(<TurnstileField resetKey={0} onToken={onToken} />)
  return { onToken, result }
}

describe('while the check is loading or working', () => {
  it('says nothing, because there is nothing wrong yet', () => {
    renderField()
    expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument()
    expect(screen.queryByText(/could not load the security check/i)).not.toBeInTheDocument()
  })

  it('stays quiet once the widget renders', async () => {
    renderField()
    reportStatus?.('ready')
    await waitFor(() =>
      expect(screen.queryByText(/could not load the security check/i)).not.toBeInTheDocument(),
    )
  })
})

describe('when the check cannot load', () => {
  it('explains it, in terms a visitor can act on', async () => {
    renderField()
    reportStatus?.('failed')

    expect(await screen.findByText(/could not load the security check/i)).toBeInTheDocument()
    expect(screen.getByText(/ad or script blocker/i)).toBeInTheDocument()
  })

  it('offers a retry that mounts a fresh challenge', async () => {
    renderField()
    reportStatus?.('failed')
    const mountsBefore = mountCount

    fireEvent.click(await screen.findByRole('button', { name: /try the check again/i }))

    await waitFor(() => expect(mountCount).toBeGreaterThan(mountsBefore))
    // The failure clears while the retry is in flight, so the visitor is not
    // reading a stale error over a working widget.
    expect(screen.queryByText(/could not load the security check/i)).not.toBeInTheDocument()
  })

  it('reports the failure again if the retry fails too', async () => {
    renderField()
    reportStatus?.('failed')
    fireEvent.click(await screen.findByRole('button', { name: /try the check again/i }))
    reportStatus?.('failed')

    expect(await screen.findByText(/could not load the security check/i)).toBeInTheDocument()
  })

  // The point of the whole change is that verification is not weakened. No
  // token is produced, so the form's own submit gate is unaffected.
  it('never produces a token, so submit stays refused', async () => {
    const { onToken } = renderField()
    reportStatus?.('failed')
    await screen.findByText(/could not load the security check/i)
    expect(onToken).not.toHaveBeenCalledWith(expect.any(String))
  })
})
