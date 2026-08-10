/**
 * When this device last showed the player their Hub.
 *
 * WHY LOCAL, AND WHY THAT IS ENOUGH FOR NOW. "Since you were last here" needs a
 * marker to measure from. The direction says a first release may derive it from
 * recent authoritative state plus a local last-viewed marker, with a
 * server-side cursor later for cross-device continuity — so this is the
 * accepted first shape rather than a shortcut. What it costs is honest and
 * small: a player who reads the recap on their phone still sees it on their
 * laptop.
 *
 * IT IS NEVER AN AUTHORITY ON ANYTHING. It selects which true facts to show
 * first. No lock, reveal, settlement or score depends on it, and a wrong or
 * missing value makes the Hub show more or less recent football — never
 * something untrue.
 *
 * THE FIRST VISIT SHOWS NOTHING RATHER THAN EVERYTHING. With no stored marker
 * there is no "since", and a summary of the whole season pretending to be
 * "what changed" would be the worst possible first impression of the feature.
 */

const KEY = 'predictor.ui.last-visit'

export function readLastVisit(): string | null {
  try {
    const value = globalThis.localStorage?.getItem(KEY)
    if (!value) return null
    return Number.isNaN(new Date(value).getTime()) ? null : value
  } catch {
    return null
  }
}

export function writeLastVisit(at: Date): void {
  try {
    globalThis.localStorage?.setItem(KEY, at.toISOString())
  } catch {
    /* A marker that cannot be stored simply means no "since" next time. */
  }
}
