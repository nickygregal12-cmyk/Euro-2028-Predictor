// The first-party product event vocabulary. CLOSED, on purpose.
//
// `captureProductEvent` takes a free string and a bag of properties, which is
// the right shape for a transport and the wrong shape for a caller: a typo
// silently becomes a new event nobody is counting, and a careless property
// silently becomes a privacy incident. Everything the application emits goes
// through this module instead, where the name and its properties are checked
// together at compile time.
//
// TWO RULES HOLD THIS DOWN, and both are structural rather than remembered.
//
// NO FREE STRINGS. Every property below is a boolean, a bounded number or a
// closed literal union. There is deliberately nowhere to put a display name, an
// email, a league name or -- the one that would actually matter -- an INVITE
// CODE, which contracts 152/158/159 treat as a guessable bearer token. A
// property that cannot hold a secret cannot leak one.
//
// NOTHING COMES BACK. `recordProductEvent` returns void. Analytics must never
// become result, scoring, lock, membership or model-selection authority, and
// the cheapest way to guarantee that is to give callers no value to be tempted
// by. It is fire-and-forget: it never throws, never rejects, and is never
// awaited, so a slow or broken analytics endpoint cannot delay or fail a
// player's action.

import { captureProductEvent } from './productAnalytics'

/**
 * Every event this product emits, with exactly the properties it may carry.
 *
 * Adding a moment means adding a line here. That is the point: the vocabulary
 * is reviewable in one place, and `specs/first-party-product-events.md` explains
 * what each one is for.
 */
type ProductEventProperties = {
  /**
   * A player committed their predictions. The act the whole product exists for,
   * and the denominator every other number is read against.
   */
  entry_submitted: Record<string, never>

  /**
   * A player landed on an invitation. Paired with `league_joined` this is the
   * only way to see how many invitations actually convert -- the question an
   * acquisition change is trying to answer.
   *
   * The code itself is NEVER carried. Whether the visitor already had a session
   * is the thing that changes the journey.
   */
  invite_opened: { signedIn: boolean }

  /** A player joined a league. Carries no code and no league identity. */
  league_joined: Record<string, never>

  /** A player turned reminder emails on or off. Retention, in one boolean. */
  reminders_changed: { enabled: boolean }
}

export type ProductEventName = keyof ProductEventProperties

/**
 * Record a product event. Returns nothing, never throws, never blocks.
 *
 * Deliberately not `async`: an `await` here would let a caller sequence a
 * player's action behind an analytics request, which is exactly the coupling
 * the fire-and-forget rule exists to prevent.
 */
export function recordProductEvent<Name extends ProductEventName>(
  name: Name,
  properties: ProductEventProperties[Name],
): void {
  // `captureProductEvent` already fails quiet and returns false when analytics
  // is unconfigured. The catch is for the promise itself: an unhandled
  // rejection from a fire-and-forget call surfaces as a global error, and the
  // observability layer would report a analytics hiccup as an application
  // fault.
  void captureProductEvent(name, properties).catch(() => false)
}
