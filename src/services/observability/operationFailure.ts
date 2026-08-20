import { reportClientError } from './clientObservability'

/**
 * A competitive action that failed, made observable.
 *
 * THE GAP THIS CLOSES, STATED EXACTLY. Before this, `reportClientError` was
 * called from two places in the entire application: the entry point and the
 * startup instrument. Everything a player actually does — saving a prediction,
 * arming a Joker, spending a Last Man Standing club, joining a league — fails
 * by being CAUGHT, turned into a sentence by `userFacingError`, and shown on
 * screen. A caught error reaches neither `window.onerror` nor an unhandled
 * rejection, so none of it was ever reported. A matchweek in which every
 * prediction save failed would have produced a completely silent Sentry
 * project.
 *
 * AN ALLOW-LIST, NOT A CONTEXT BAG. `SafeOperationContext` names the few fields
 * a report may carry and the type refuses the rest, which is what makes "no
 * prediction contents, no hidden picks, no invite codes, no free text" a
 * property of the code rather than a rule every call site has to remember.
 * `reportClientError` then redacts identity, credential and path data from the
 * message on top of that.
 *
 * WHAT IS DELIBERATELY ABSENT, AND WHY EACH ONE:
 *
 *   - THE SCORELINE, or any prediction content. It is the competitive secret
 *     the whole reveal model exists to protect, and knowing a save failed does
 *     not require knowing what it said.
 *   - THE INVITE CODE. It is a bearer credential: anyone holding one can join.
 *   - THE LEAGUE OR COMPETITION NAME. Player-authored free text, so it can
 *     contain anything at all, including somebody's real name.
 *   - THE ACCOUNT ID. Sentry's own user context is where an identity belongs if
 *     one is ever attached, under that decision rather than smuggled through
 *     here.
 *
 * WHAT IS PRESENT IS THE PART THAT MAKES A REPORT ACTIONABLE: which operation,
 * which season and competition (opaque ids, which name nothing), which
 * matchweek, and the server's own error code.
 */

/**
 * The competitive operations worth a report, named rather than free-form.
 *
 * A closed union so the reports group. A string parameter would have produced
 * `save failed`, `Save failed`, `prediction save failed` and `predictionSave`
 * as four unrelated issues within a season.
 */
export type OperationName =
  | 'prediction.save'
  | 'prediction.joker'
  | 'lms.pick'
  | 'league.join'
  | 'league.create'
  | 'championship.action'

export type SafeOperationContext = {
  /** Opaque identifier. Names nothing and is meaningless without the database. */
  readonly competitionId?: string
  /** Opaque identifier, as above. */
  readonly seasonId?: string
  /** An integer. Carries no content. */
  readonly matchweek?: number
  /**
   * The server's own code — a PostgREST code, an HTTP status, a raised
   * `errcode`. Never the message: a database message can quote the row that
   * caused it.
   */
  readonly serverCode?: string
  /**
   * Whether the failure is terminal or the application will try again. A
   * transient failure that recovered is noise; one that gave up is the signal.
   */
  readonly outcome: 'failed' | 'conflict'
}

/**
 * Report a failed competitive action.
 *
 * Returns nothing and throws nothing: an observability call that could break
 * the thing it observes is worse than no observability. `reportClientError`
 * already isolates a failing reporter, and this adds no new way to fail.
 */
export function reportOperationFailure(
  operation: OperationName,
  context: SafeOperationContext,
): void {
  const parts = [
    `operation=${operation}`,
    `outcome=${context.outcome}`,
    context.serverCode ? `code=${sanitiseCode(context.serverCode)}` : null,
    context.competitionId ? `competition=${context.competitionId}` : null,
    context.seasonId ? `season=${context.seasonId}` : null,
    context.matchweek !== undefined ? `matchweek=${context.matchweek}` : null,
  ].filter((part): part is string => part !== null)

  // An Error rather than a string, because the reporter's own contract is an
  // error and because the stack names the call site — which is the one piece of
  // context this cannot be handed.
  const error = new Error(`Competitive operation failed: ${parts.join(' ')}`)
  error.name = 'OperationFailure'
  reportClientError(error, 'operation-failure')
}

/**
 * A server code, reduced to the shape a code has.
 *
 * Codes are short and alphanumeric. Anything else arriving here is not a code —
 * it is a message that reached the wrong argument — and letting it through
 * would be exactly the leak this module exists to prevent. So the value is
 * constrained rather than trusted.
 */
function sanitiseCode(value: string): string {
  const trimmed = value.trim().slice(0, 32)
  return /^[A-Za-z0-9_.-]+$/.test(trimmed) ? trimmed : 'unrecognised'
}

/**
 * The server's code for a rejected call, where it exposed one.
 *
 * Supabase rejects with an object carrying `code` (PostgREST or SQLSTATE) or
 * `status` (HTTP). Neither is content. A rejection with neither — a dropped
 * connection, an aborted fetch — reports as `network`, which is the honest
 * answer and a genuinely different failure from a refused write.
 */
export function serverCodeOf(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'unknown'
  const shape = error as { code?: unknown; status?: unknown; name?: unknown }
  if (typeof shape.code === 'string' && shape.code) return shape.code
  if (typeof shape.status === 'number' && shape.status) return String(shape.status)
  if (shape.name === 'TypeError') return 'network'
  return 'unknown'
}
