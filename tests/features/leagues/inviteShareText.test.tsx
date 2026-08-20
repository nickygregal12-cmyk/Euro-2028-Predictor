import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InvitePanel } from '../../../src/features/leagues/InvitePanel'
import { SiteProvider } from '../../../src/app/site/SiteProvider'
import { siteConfiguration } from '../../../src/app/site/siteConfiguration'

/**
 * What a shared invite says about the product it invites you to.
 *
 * THE DEFECT THIS GUARDS. `shareInvite` carried the literal string
 * "Euro 2028 Predictor", and `InvitePanel` is mounted by league creation, the
 * private-play journey and the organiser panel — all weekly Predictor Hub
 * surfaces. Every private league invited from the Hub told the person receiving
 * it they were joining a tournament that is not published, on a domain they
 * would never land on.
 *
 * The general rule, and the reason this is a test rather than a corrected
 * string: one hard-coded product name replaced by another is the same bug with
 * a different value. The assertion is that the text follows the SITE, proved by
 * rendering both deployments in one process.
 */

function shareSpy() {
  // Typed with its argument, so the assertions below read the real payload
  // rather than an untyped tuple.
  const share = vi.fn((_data: ShareData) => Promise.resolve())
  Object.defineProperty(navigator, 'share', {
    value: share,
    configurable: true,
    writable: true,
  })
  return share
}

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'share')
})

async function shareFrom(variant: 'hub' | 'euro') {
  const share = shareSpy()
  render(
    <SiteProvider configuration={siteConfiguration(variant)}>
      <InvitePanel leagueName="The Office Sweepstake" code="ABC234" mode="chip" />
    </SiteProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Share invite' }))
  return share.mock.calls[0]?.[0]
}

describe('a shared league invite names its own product', () => {
  it('invites to the Hub from the Hub', async () => {
    const shared = await shareFrom('hub')
    expect(shared?.text).toContain('Predictor Hub')
    expect(shared?.text).toContain('The Office Sweepstake')
    expect(shared?.text?.toLowerCase()).not.toContain('euro')
  })

  it('invites to the tournament from the tournament build', async () => {
    const shared = await shareFrom('euro')
    expect(shared?.text).toContain('Euro 2028 Predictor')
  })

  it('carries the invite link rather than only the code', async () => {
    const shared = await shareFrom('hub')
    expect(shared?.url).toContain('/join/ABC234')
  })
})
