/**
 * When, and whether, to offer to put this application on a home screen.
 *
 * ONE PURE FUNCTION, BECAUSE THE RULE IS THE PRODUCT DECISION. Every browser
 * detail — whether a `beforeinstallprompt` was captured, whether the window is
 * already standalone, what the platform is — is resolved by the hook and passed
 * in. What is left here is only the policy, which is the part worth arguing
 * about and the part worth testing.
 *
 * THE POLICY, IN ORDER:
 *
 * 1. An installed application never asks to be installed. Standalone display
 *    mode is the answer, not a stored flag: a player who installed on one
 *    device and opened the site on another should still be offered it there.
 *
 * 2. A dismissal is honoured for two months. "Not now" from someone who has
 *    just been asked is an answer, and asking again next Saturday is how an
 *    install prompt becomes the thing a player learns to close without reading.
 *    It expires rather than being permanent because a season is long and a
 *    player's mind changes; two months means at most a handful of asks a year.
 *
 * 3. NOTHING IS OFFERED ON A FIRST VISIT. The browser's own installability
 *    heuristics are not a product decision, and firing a prompt at somebody who
 *    arrived thirty seconds ago from an invite link is the intrusive pattern
 *    this deliberately does not do. Two separate visits is the floor: it means
 *    the player came back, which is the only signal available that the
 *    application is worth a home-screen slot.
 *
 * 4. Only then does the platform decide WHAT is offered — the browser's own
 *    install flow where one exists, concise Safari instructions on iOS where
 *    one does not, and nothing at all anywhere else. There is no third state
 *    where the application pretends iOS has an install API.
 */

export type InstallPlatform =
  /** A Chromium-family browser that has given us a deferred install prompt. */
  | 'prompt'
  /** iOS or iPadOS Safari, which installs only through its own share sheet. */
  | 'ios'
  /** Everything else, including browsers that simply do not install. */
  | 'unsupported'

export type InstallInvitation =
  | { readonly kind: 'prompt' }
  | { readonly kind: 'ios-guidance' }
  | {
      readonly kind: 'none'
      readonly reason: 'installed' | 'dismissed' | 'not-engaged' | 'unsupported'
    }

export type InstallSignals = {
  /** The window is already running as an installed application. */
  readonly standalone: boolean
  readonly platform: InstallPlatform
  /** Separate visits recorded for this browser, including the current one. */
  readonly visits: number
  /** Epoch milliseconds of the last dismissal, or null. */
  readonly dismissedAt: number | null
  readonly now: number
}

/** Visits before anything is offered. Two means "came back at least once". */
export const VISITS_BEFORE_INVITING = 2

/** How long "Not now" is respected. */
export const DISMISSAL_QUIET_DAYS = 60

const DAY_MS = 24 * 60 * 60 * 1000

export function resolveInstallInvitation(
  signals: InstallSignals,
): InstallInvitation {
  if (signals.standalone) return { kind: 'none', reason: 'installed' }

  if (
    signals.dismissedAt !== null &&
    signals.now - signals.dismissedAt < DISMISSAL_QUIET_DAYS * DAY_MS
  ) {
    return { kind: 'none', reason: 'dismissed' }
  }

  if (signals.visits < VISITS_BEFORE_INVITING) {
    return { kind: 'none', reason: 'not-engaged' }
  }

  if (signals.platform === 'prompt') return { kind: 'prompt' }
  if (signals.platform === 'ios') return { kind: 'ios-guidance' }
  return { kind: 'none', reason: 'unsupported' }
}

/**
 * Is this iOS or iPadOS?
 *
 * iPadOS 13 and later report a Macintosh user agent, so the touch-point count
 * is the only distinguishing signal available without asking for a permission.
 * A desktop Mac reports `maxTouchPoints` of 0; an iPad reports 5. Getting this
 * wrong in the false-positive direction shows a Mac user instructions for a
 * share sheet they do not have, so the check is the narrow one.
 */
export function isIosPlatform(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true
  return /Mac/.test(platform) && maxTouchPoints > 1
}
