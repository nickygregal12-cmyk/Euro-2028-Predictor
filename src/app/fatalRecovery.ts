/**
 * Recovery from a fatal render failure that a reload cannot clear.
 *
 * THE DEFECT THIS EXISTS FOR (`UX-004`). The fatal fallback offered one remedy:
 * reload. That is the right first move for a transient fault and the wrong one
 * for a deterministic fault — corrupt local state, an incompatible cached
 * session, a malformed server response or a broken route fails again on every
 * reload, so a single user can be locked out indefinitely by something nobody
 * else sees. Reload is a retry, and retrying a deterministic failure is a loop.
 *
 * So this module answers the second question: what can be discarded that might
 * make the next attempt different, WITHOUT destroying anything the user would
 * miss?
 *
 * WHAT IT CLEARS, AND WHY THE LIST IS SHORT. This application writes no
 * `localStorage` or `sessionStorage` key of its own — verified rather than
 * assumed. The only browser-persisted state is the Supabase auth session, which
 * the client stores under `sb-<project-ref>-auth-token`. Clearing that is a
 * LOCAL sign-out: the session on this device is discarded and the user signs in
 * again. It is also, in practice, the state most likely to be the problem, since
 * an incompatible or half-written session survives every reload.
 *
 * WHAT IT MUST NEVER DO:
 *   - delete server data. There is no network call here at all. Predictions,
 *     entries, leagues and results are untouched by construction, not by
 *     promise;
 *   - call the server to sign out. The whole premise is that the application
 *     failed, so anything requiring working application code is unavailable;
 *   - clear storage indiscriminately. `clear()` would remove keys belonging to
 *     anything else sharing this origin, and a recovery path that destroys
 *     unrelated state is a worse bug than the one it recovers from.
 *
 * The functions here are pure over an injected storage, so both the selection
 * rule and the escalation rule are testable without a browser.
 */

/** The narrow slice of the Storage interface this needs. */
export interface KeyValueStore {
  readonly length: number
  key(index: number): string | null
  removeItem(key: string): void
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * Supabase's auth-token key shape. Deliberately anchored at both ends: a
 * substring match on `sb-` would also catch keys another library happened to
 * name that way, and this is a destructive operation.
 */
const SUPABASE_AUTH_KEY = /^sb-[a-z0-9]+-auth-token(\.\d+)?$/

/** How many consecutive fatal renders before recovery is offered rather than reload. */
export const RECOVERY_THRESHOLD = 2

/** Where the consecutive-failure count lives. Session-scoped: closing the tab resets it. */
export const CRASH_COUNT_KEY = 'fph.fatal-crash-count'

/**
 * Keys this recovery is willing to remove, in the order found.
 *
 * Returned rather than removed so the decision can be asserted directly — a
 * test that had to observe the removal could not tell "removed the right keys"
 * from "removed everything".
 */
export function recoverableKeys(store: Pick<KeyValueStore, 'length' | 'key'>): string[] {
  const keys: string[] = []
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index)
    if (key !== null && SUPABASE_AUTH_KEY.test(key)) keys.push(key)
  }
  return keys
}

/**
 * Discard the local session. Returns the keys removed, so the caller can report
 * honestly rather than claiming a sign-out that removed nothing.
 */
export function clearLocalSession(store: KeyValueStore): string[] {
  const keys = recoverableKeys(store)
  for (const key of keys) store.removeItem(key)
  return keys
}

/**
 * Count this failure and say whether reload is still worth offering.
 *
 * The first failure gets a reload, because most faults are transient and a
 * reload is the cheapest thing that fixes them. The second consecutive failure
 * is evidence the fault is deterministic, and repeating the same remedy is the
 * loop this module exists to break.
 */
export function recordFailure(store: KeyValueStore): {
  readonly failures: number
  readonly offerRecovery: boolean
} {
  const previous = Number.parseInt(store.getItem(CRASH_COUNT_KEY) ?? '0', 10)
  const failures = (Number.isFinite(previous) && previous > 0 ? previous : 0) + 1
  store.setItem(CRASH_COUNT_KEY, String(failures))
  return { failures, offerRecovery: failures >= RECOVERY_THRESHOLD }
}

/** Clear the counter once the application renders again. */
export function clearFailureCount(store: KeyValueStore): void {
  store.removeItem(CRASH_COUNT_KEY)
}

/**
 * A correlation reference the user can quote to support.
 *
 * Not a crash identifier and deliberately not derived from the error: it exists
 * so a person can say "this happened to me" and be matched against a Sentry
 * event by time, without the page displaying a message that may contain
 * anything the failure put in it.
 */
export function correlationReference(now: Date, entropy: number): string {
  const stamp = now.toISOString().replaceAll(/[-:T.]/g, '').slice(0, 14)
  const suffix = Math.floor(entropy * 0x10000)
    .toString(16)
    .padStart(4, '0')
    .toUpperCase()
  return `FPH-${stamp}-${suffix}`
}
