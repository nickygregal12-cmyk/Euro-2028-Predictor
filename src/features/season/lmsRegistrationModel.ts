import { userFacingError } from '../../shared/errors/userFacingError'

/**
 * Registration for a season Last Man Standing competition.
 *
 * WHY THIS EXISTS AT ALL. `SeasonLmsPage` has been telling a non-entrant
 * "Join Last Man Standing to make a pick" while offering no way to join — a
 * refusal that names an action the interface does not provide. The writes have
 * existed since the game catalogue landed (`register_bonus_competition`, which
 * is competition-neutral: it resolves a competition by id and delegates to
 * `join_competition_game`), so this closes a surface gap rather than a rule
 * gap. No rule moves here.
 *
 * STATES ARE RESOLVED FROM STORED INSTANTS, NOT GUESSED. The games hub read
 * already returns `registration_opens_at`, `registration_closes_at` and
 * `completed_at` alongside the caller's own entrant row, so this surface can
 * say precisely where registration stands instead of offering a button and
 * discovering the answer from a refusal.
 *
 * IT RESOLVES AGAINST THE SERVER'S INSTANT, not the browser's clock, because
 * the hub read supplies one and a device with a wrong clock would otherwise
 * offer a closed registration or hide an open one. It is captured at load, so
 * a page left open goes stale — which is safe, because the server refuses
 * authoritatively regardless and the panel reloads after every attempt.
 *
 * THE ORDER OF THE CHECKS IS THE DESIGN. Finished outranks everything;
 * membership outranks the registration window, because a player who is already
 * in does not care that registration later closed; and "not open" is
 * distinguished from "closed" because they ask opposite things of the player —
 * come back, versus do not wait.
 */

export type LmsRegistrationFacts = {
  competitionId: string
  entered: boolean
  joinedAt: string | null
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  completedAt: string | null
  /** The server's instant, from the same read. States resolve against it. */
  serverNow: string
}

/** Reachable through `LmsRegistrationPresentation`; not exported separately,
 *  so it does not become a needless public name. */
type LmsRegistrationState =
  | 'finished'
  | 'entered'
  | 'not_open'
  | 'closed'
  | 'open'

export type LmsRegistrationPresentation = {
  state: LmsRegistrationState
  headline: string
  explanation: string
  canJoin: boolean
  /** ISO instant the view may format; the model prints no localised date. */
  opensAt: string | null
  closesAt: string | null
}

export function presentLmsRegistration(
  facts: LmsRegistrationFacts,
): LmsRegistrationPresentation {
  const now = new Date(facts.serverNow).getTime()
  const opensAt = facts.registrationOpensAt
  const closesAt = facts.registrationClosesAt

  // Both windows fail CLOSED on an absent or unreadable instant: the server
  // refuses a competition with no opening instant on exactly that condition,
  // so offering a button that cannot succeed would be the surface disagreeing
  // with the rule it is describing.
  const opensAtMs = opensAt === null ? null : new Date(opensAt).getTime()
  const notYetOpen =
    opensAtMs === null || Number.isNaN(opensAtMs) || opensAtMs > now

  const closesAtMs = closesAt === null ? null : new Date(closesAt).getTime()
  const hasClosed =
    closesAtMs !== null && (Number.isNaN(closesAtMs) || closesAtMs <= now)

  const base = { opensAt, closesAt }

  if (facts.completedAt !== null) {
    return {
      ...base,
      state: 'finished',
      headline: 'This competition has finished',
      explanation: 'Last Man Standing is over for this season. A new one can start later.',
      canJoin: false,
    }
  }

  if (facts.entered) {
    return {
      ...base,
      state: 'entered',
      headline: 'You are entered',
      explanation: 'You are entered in this Last Man Standing competition.',
      canJoin: false,
    }
  }

  if (notYetOpen) {
    return {
      ...base,
      state: 'not_open',
      headline: 'Registration has not opened',
      explanation: 'You will be able to join once registration opens.',
      canJoin: false,
    }
  }

  if (hasClosed) {
    return {
      ...base,
      state: 'closed',
      headline: 'Registration has closed',
      explanation:
        'This competition is no longer accepting entries. You can join the next one when it opens.',
      canJoin: false,
    }
  }

  return {
    ...base,
    state: 'open',
    headline: 'Join Last Man Standing',
    explanation: 'Pick one club a round to win. Use a club once and it is spent for the cycle.',
    canJoin: true,
  }
}

/**
 * Turn a registration refusal into the sentence that explains it.
 *
 * IT IS NOT `lmsRefusal`, AND MUST NOT BECOME IT. That classifier maps `55000`
 * onto "You have been eliminated", which is correct for a pick and wrong for a
 * join — the same code, a different write, a different rule.
 *
 * `55000` IS DELIBERATELY VAGUE HERE, and that is the honest reading rather
 * than a lazy one. `join_competition_game` raises it for FIVE distinct rules:
 * the game has finished, registration has not opened, registration has closed,
 * a disqualified entry cannot be rejoined, and a game that forbids rejoining
 * after leaving. The code alone cannot tell them apart and the server's own
 * message string is never passed through, so claiming one would be a guess
 * printed as fact. The panel reloads after a failed attempt, and the reloaded
 * state — resolved from stored instants — is what tells the player which of
 * them applies.
 */
const BY_CODE: Record<string, string> = {
  // Already an active member. Not a failure worth alarming anybody about.
  '23505': 'You are already entered in this competition.',
  unique_violation: 'You are already entered in this competition.',
  // Five different server rules share this code; see above.
  '55000': 'You cannot join this competition right now.',
  // Not published, not active, or gone.
  '02000': 'This competition is no longer available.',
  no_data_found: 'This competition is no longer available.',
  // Not authenticated.
  '42501': 'Sign in to join this competition.',
  insufficient_privilege: 'Sign in to join this competition.',
}

export function lmsRegistrationRefusal(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === 'string' && BY_CODE[code]) return BY_CODE[code]
  return userFacingError(error)
}

/** Everything the panel may ask of the world. Injected, so the panel stays pure. */
export type SeasonLmsRegistrationGateway = {
  load(): Promise<LmsRegistrationFacts>
  join(): Promise<void>
}
