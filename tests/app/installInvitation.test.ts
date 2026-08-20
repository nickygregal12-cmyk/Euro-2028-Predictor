import { describe, expect, it } from 'vitest'
import {
  DISMISSAL_QUIET_DAYS,
  VISITS_BEFORE_INVITING,
  isIosPlatform,
  resolveInstallInvitation,
  type InstallSignals,
} from '../../src/app/pwa/installInvitation'

/**
 * When the application is allowed to suggest a home-screen install.
 *
 * The interesting cases are all the ones where the answer is NO. An install
 * prompt is the easiest thing in a product to make annoying, and every rule
 * below exists to stop one particular way of doing that: asking somebody who
 * has already installed, asking somebody who just said no, asking on a first
 * visit, or offering an "Add" button on a platform that has no such thing.
 */

const NOW = Date.UTC(2026, 7, 20, 12, 0, 0)
const DAY = 24 * 60 * 60 * 1000

function signals(overrides: Partial<InstallSignals> = {}): InstallSignals {
  return {
    standalone: false,
    platform: 'prompt',
    visits: VISITS_BEFORE_INVITING,
    dismissedAt: null,
    now: NOW,
    ...overrides,
  }
}

describe('nothing is offered when it should not be', () => {
  it('never asks an installed application to install itself', () => {
    expect(resolveInstallInvitation(signals({ standalone: true }))).toEqual({
      kind: 'none',
      reason: 'installed',
    })
  })

  it('never asks on a first visit, however installable the browser thinks it is', () => {
    expect(resolveInstallInvitation(signals({ visits: 1 }))).toEqual({
      kind: 'none',
      reason: 'not-engaged',
    })
  })

  it('respects "Not now" for two months, then asks once more', () => {
    const justSaidNo = signals({ dismissedAt: NOW - DAY })
    expect(resolveInstallInvitation(justSaidNo)).toEqual({
      kind: 'none',
      reason: 'dismissed',
    })

    const longAgo = signals({
      dismissedAt: NOW - (DISMISSAL_QUIET_DAYS + 1) * DAY,
    })
    expect(resolveInstallInvitation(longAgo)).toEqual({ kind: 'prompt' })
  })

  it('offers nothing at all on a browser that does not install', () => {
    expect(
      resolveInstallInvitation(signals({ platform: 'unsupported' })),
    ).toEqual({ kind: 'none', reason: 'unsupported' })
  })

  it('puts being installed ahead of every other reason', () => {
    // A standalone window that also happens to hold a deferred prompt, on a
    // first visit, is still installed. Order matters because the reasons are
    // reported and a wrong one would send a reader looking in the wrong place.
    const confusing = signals({
      standalone: true,
      visits: 1,
      dismissedAt: NOW - DAY,
    })
    expect(resolveInstallInvitation(confusing)).toEqual({
      kind: 'none',
      reason: 'installed',
    })
  })
})

describe('what is offered, once it may be', () => {
  it('uses the browser’s own install flow where one exists', () => {
    expect(resolveInstallInvitation(signals({ platform: 'prompt' }))).toEqual({
      kind: 'prompt',
    })
  })

  it('describes Safari’s own steps on iOS rather than pretending to have an API', () => {
    expect(resolveInstallInvitation(signals({ platform: 'ios' }))).toEqual({
      kind: 'ios-guidance',
    })
  })
})

describe('recognising iOS, including the iPad that says it is a Mac', () => {
  it('recognises an iPhone', () => {
    expect(isIosPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', 'iPhone', 5)).toBe(
      true,
    )
  })

  it('recognises an iPad reporting a Macintosh user agent', () => {
    expect(
      isIosPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5),
    ).toBe(true)
  })

  it('does not mistake a desktop Mac for one', () => {
    expect(
      isIosPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0),
    ).toBe(false)
  })

  it('does not mistake a touchscreen Windows laptop for one', () => {
    expect(
      isIosPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 10),
    ).toBe(false)
  })
})
