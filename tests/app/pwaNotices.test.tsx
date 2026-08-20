import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PwaNotices } from '../../src/app/pwa/PwaNotices'
import { SiteProvider } from '../../src/app/site/SiteProvider'
import { siteConfiguration } from '../../src/app/site/siteConfiguration'
import type { PwaNoticesState } from '../../src/app/pwa/usePwaNotices'

/**
 * The three notices, and what each one is allowed to say.
 *
 * The hook is mocked because everything it reads — a deferred install event,
 * display mode, a registration — is browser state a jsdom render cannot
 * produce, and because the DECISION about what to show is tested on its own in
 * `installInvitation.test.ts`. What is left here is the presentation contract:
 * one notice at a time, the right words, the right site's product name, and
 * nothing at all in the states where the answer is nothing.
 */

const state = vi.hoisted(() => ({
  current: null as PwaNoticesState | null,
}))

vi.mock('../../src/app/pwa/usePwaNotices', () => ({
  usePwaNotices: () => state.current,
}))

function noticesState(overrides: Partial<PwaNoticesState> = {}): PwaNoticesState {
  return {
    offline: false,
    updateReady: false,
    invitation: { kind: 'none', reason: 'not-engaged' },
    applyUpdate: vi.fn(),
    install: vi.fn(),
    dismissInstall: vi.fn(),
    ...overrides,
  }
}

function renderNotices(
  next: PwaNoticesState,
  variant: 'hub' | 'euro' = 'hub',
) {
  state.current = next
  return render(
    <SiteProvider configuration={siteConfiguration(variant)}>
      <PwaNotices />
    </SiteProvider>,
  )
}

beforeEach(() => {
  state.current = noticesState()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('an available update', () => {
  it('says which product it is, and offers only a refresh', async () => {
    const applyUpdate = vi.fn()
    renderNotices(noticesState({ updateReady: true, applyUpdate }))

    expect(
      screen.getByText('A new version of Predictor Hub is available'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(applyUpdate).toHaveBeenCalledTimes(1)
  })

  it('names the tournament product on the tournament build', () => {
    renderNotices(noticesState({ updateReady: true }), 'euro')
    expect(
      screen.getByText('A new version of Euro 2028 Predictor is available'),
    ).toBeInTheDocument()
  })

  it('is announced politely rather than seizing attention', () => {
    renderNotices(noticesState({ updateReady: true }))
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('outranks an install suggestion, so only one notice is ever on screen', () => {
    renderNotices(
      noticesState({ updateReady: true, invitation: { kind: 'prompt' } }),
    )
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
  })
})

describe('the install suggestion', () => {
  it('offers the browser’s own flow, and a way to decline it', async () => {
    const install = vi.fn()
    const dismissInstall = vi.fn()
    renderNotices(
      noticesState({ invitation: { kind: 'prompt' }, install, dismissInstall }),
    )

    expect(
      screen.getByText('Add Predictor Hub to your home screen'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(install).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(dismissInstall).toHaveBeenCalledTimes(1)
  })

  it('gives iOS the Safari steps and NO button that pretends to install', () => {
    renderNotices(noticesState({ invitation: { kind: 'ios-guidance' } }))

    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Share' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
  })
})

describe('being offline', () => {
  it('says what cannot be saved, and claims nothing about what already was', () => {
    renderNotices(noticesState({ offline: true }))

    expect(screen.getByText('You’re offline')).toBeInTheDocument()
    const body = screen.getByText(/need a connection/)
    expect(body).toHaveTextContent('will not be saved')
    // The words a save state owns must never appear here: this notice has not
    // spoken to the server and cannot report on any particular prediction.
    expect(body).not.toHaveTextContent(/saved ✓|confirmed|submitted/i)
  })

  it('cannot be dismissed, because it is status rather than a suggestion', () => {
    renderNotices(noticesState({ offline: true }))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('outranks both the update and the install suggestion', () => {
    renderNotices(
      noticesState({
        offline: true,
        updateReady: true,
        invitation: { kind: 'prompt' },
      }),
    )
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
  })
})

describe('silence', () => {
  it.each([
    ['installed', 'installed'],
    ['dismissed', 'dismissed'],
    ['not engaged', 'not-engaged'],
    ['unsupported', 'unsupported'],
  ] as const)('renders nothing at all when %s', (_label, reason) => {
    const { container } = renderNotices(
      noticesState({ invitation: { kind: 'none', reason } }),
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('the offline signal itself', () => {
  it('trusts only the direction that is trustworthy', async () => {
    const { useOfflineStatus } = await vi.importActual<
      typeof import('../../src/app/pwa/useOnlineStatus')
    >('../../src/app/pwa/useOnlineStatus')

    function Probe() {
      return <span data-testid="probe">{String(useOfflineStatus())}</span>
    }

    const onLine = vi.spyOn(navigator, 'onLine', 'get')
    onLine.mockReturnValue(true)
    render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('false')

    onLine.mockReturnValue(false)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByTestId('probe')).toHaveTextContent('true')

    onLine.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.getByTestId('probe')).toHaveTextContent('false')
    onLine.mockRestore()
  })
})
