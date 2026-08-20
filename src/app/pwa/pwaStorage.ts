/**
 * The two small facts the install invitation needs to remember, and nothing
 * else.
 *
 * `localStorage` is touched rather than assumed available: Safari's private
 * mode has historically thrown on ACCESS rather than on write, and a throw
 * during a render would take the frame down for a feature whose entire purpose
 * is an optional suggestion. Every read fails to a neutral value and every
 * write is allowed to do nothing.
 *
 * No account is involved and no account may be. Whether this browser has been
 * here before, and whether the person using it said "Not now", are device
 * facts; keying them to a player would make a shared device leak one player's
 * choice to another and would mean a signed-out visitor had no answer at all.
 */

const VISITS_KEY = 'predictor.pwa.visits'
const DISMISSED_KEY = 'predictor.pwa.installDismissedAt'
const SESSION_KEY = 'predictor.pwa.visitCounted'

function localStore(): Storage | null {
  try {
    const storage = window.localStorage
    const probe = 'predictor.pwa.probe'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Count this visit once, and report the running total.
 *
 * A VISIT IS A BROWSING SESSION, NOT A PAGE VIEW. The session flag is what
 * makes the difference: without it a single afternoon of navigating between
 * Matches and the Match Predictor would count as a dozen visits and the
 * "came back at least once" signal would mean nothing. Returns 1 when nothing
 * can be stored, which reads as a first visit and offers nothing — the correct
 * failure direction for an unsolicited suggestion.
 */
export function recordVisit(): number {
  const storage = localStore()
  if (!storage) return 1

  const session = sessionStore()
  const alreadyCounted = session?.getItem(SESSION_KEY) === '1'

  const previous = Number.parseInt(storage.getItem(VISITS_KEY) ?? '0', 10)
  const visits = Number.isFinite(previous) && previous > 0 ? previous : 0
  if (alreadyCounted) return Math.max(visits, 1)

  const next = visits + 1
  try {
    storage.setItem(VISITS_KEY, String(next))
    session?.setItem(SESSION_KEY, '1')
  } catch {
    // A full or refusing store is not a reason to fail a render.
  }
  return next
}

export function readInstallDismissedAt(): number | null {
  const storage = localStore()
  if (!storage) return null
  const raw = storage.getItem(DISMISSED_KEY)
  if (raw === null) return null
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) ? value : null
}

export function writeInstallDismissedAt(at: number): void {
  try {
    localStore()?.setItem(DISMISSED_KEY, String(at))
  } catch {
    // See above.
  }
}
