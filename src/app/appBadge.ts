/**
 * `INNOV-023` — the installed app's icon badge, as progressive enhancement.
 *
 * THE COUNT IS NOT COMPUTED HERE AND NEVER WILL BE. It is whatever
 * `outstandingCount` says, which is whatever each game's own read said is due.
 * A badge that counted independently would be a second answer to "what do you
 * owe", visible on the home screen, and it would be the one the player saw
 * first.
 *
 * NOTHING DEPENDS ON IT. The Badging API is absent on most desktop browsers and
 * on iOS Safari outside an installed app, and where it is absent this module
 * does nothing at all. Every outstanding action remains discoverable through the
 * AppBar count, the Action Centre and `/play`, exactly as before — the badge is
 * a shortcut to information the product already gives, never the only route to
 * it.
 *
 * IT FAILS SILENTLY, DELIBERATELY. `setAppBadge` rejects on some platforms when
 * the document is not installed or permission is absent. A rejected promise is
 * not a fault the player can act on, and reporting it would be noise about a
 * decoration.
 *
 * ZERO CLEARS RATHER THAN SHOWING A NOUGHT. `setAppBadge(0)` is specified to
 * clear the badge, but `clearAppBadge` says so unambiguously and is what a
 * reader of this file would expect, so it is called explicitly.
 */

type BadgingNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

export function appBadgeSupported(target: Navigator | undefined = globalThis.navigator): boolean {
  const badging = target as BadgingNavigator | undefined
  return typeof badging?.setAppBadge === 'function' && typeof badging.clearAppBadge === 'function'
}

/**
 * Apply an outstanding count to the installed app icon.
 *
 * Returns whether the platform accepted the call at all, which is what a test
 * can assert on; a caller has nothing useful to do with the answer.
 */
export function applyAppBadge(
  count: number,
  target: Navigator | undefined = globalThis.navigator,
): boolean {
  const badging = target as BadgingNavigator | undefined
  if (!appBadgeSupported(target) || !badging) return false
  // A negative or fractional count is a caller bug rather than a state to
  // render. Clearing is the safe reading of "we do not know how many".
  const whole = Number.isInteger(count) && count > 0 ? count : 0
  const call = whole > 0 ? badging.setAppBadge?.(whole) : badging.clearAppBadge?.()
  void call?.catch(() => {
    // See the header: an unavailable badge is not a fault the player can act on.
  })
  return true
}
