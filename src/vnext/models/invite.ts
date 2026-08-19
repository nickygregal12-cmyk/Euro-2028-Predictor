/**
 * vNEXT INVITE — what an invite code turns out to be, and what can be done.
 *
 * ============================ IT PRESENTS A FLOW IT DOES NOT OWN ========
 *
 * `useInviteCode` already resolves a code and accepts it, and its header says
 * why it is one place rather than two: with two container kinds and a
 * server-chosen join function, a second copy is "exactly how one surface starts
 * joining a Championship through the league path". This lane adds a
 * presentation and no second flow. `joinWith` is dispatched on by that hook,
 * never here — nothing in this model names a database function.
 *
 * ============================ NOT FOUND IS DELIBERATELY UNINFORMATIVE ===
 *
 * An unknown code, a malformed one and a rotated one produce ONE state and ONE
 * sentence, because `resolve_invite_code` has already made them
 * indistinguishable. A surface that helpfully told them apart would undo that,
 * and would turn an invite code into an oracle for which codes exist.
 *
 * ============================ `closed` IS NOT RECOMPUTED ================
 *
 * The decoder resolves it server-side and says why: "a device clock deciding
 * whether registration has closed is a disagreement waiting to happen." There
 * is no instant in this model to recompute it from, on purpose.
 */

/** What kind of thing the code opened. The server's word. */
export type InviteContainer = 'league' | 'competition'

/**
 * WHAT THE PLAYER CAN DO ABOUT THIS INVITE.
 *
 * The order these are decided in is the design, and it follows what the server
 * will actually accept:
 *
 *   1. ALREADY IN outranks everything. A player who is in does not care that
 *      registration later closed, and offering them a join is offering a
 *      button that does nothing.
 *   2. CLOSED outranks joinable, because the server refuses.
 *   3. NEEDS THE GAME FIRST outranks joinable, and this one is the reason the
 *      decoder carries `requiresGameEntry` at all: "so a league invite can send
 *      a player to join the underlying game FIRST, instead of offering a button
 *      the database will refuse."
 *
 * `owner` is stated separately from `already-in` because it is a different
 * sentence to a person, even though both mean there is nothing to accept.
 */
export type InviteAction =
  | { readonly kind: 'accept' }
  | { readonly kind: 'already-in' }
  | { readonly kind: 'owner' }
  | { readonly kind: 'closed' }
  /** The league's underlying game must be joined first. Its name, where known. */
  | { readonly kind: 'needs-game-first'; readonly gameName: string | null }

export type InviteDetails = {
  readonly container: InviteContainer
  readonly name: string
  /** The season it is played in, by name. Null where the read has none. */
  readonly season: string | null
  /** The underlying game's display name, as the catalogue holds it. */
  readonly game: string | null
  readonly action: InviteAction
}

/**
 * THE INVITE PANEL.
 *
 * `not-found` carries nothing — not the code, not a reason, not a suggestion.
 * `failed` is the lookup itself not answering, which is a different fact and
 * the only one here that is worth retrying.
 */
export type InvitePanel =
  | { readonly kind: 'looking' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'invite'; readonly details: InviteDetails }

export type InvitePageModel = {
  readonly generatedAt: string
  readonly panel: InvitePanel
  /** True while an accept is in flight. */
  readonly accepting: boolean
}

/* ==========================================================================
   SELECTORS
   ========================================================================== */

/**
 * Whether the page may offer to accept.
 *
 * ONE PLACE, so the rule the surface renders and the rule a test asserts cannot
 * drift — and so no state that the server would refuse is ever given a button.
 */
export function offersAccept(panel: InvitePanel): boolean {
  return panel.kind === 'invite' && panel.details.action.kind === 'accept'
}
