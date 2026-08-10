import type { EuroPublicationState } from '../../services/supabase/euroPublicationModel'

/**
 * What the Euro publication operator surface says, as pure text.
 *
 * SEPARATE FROM `euroPublicationModel.ts` FOR TWO REASONS. The first is
 * ownership: the lifecycle order is a fact about the server that the route
 * guard and this page share, while every sentence below is operator copy that
 * only an administrator sees — the same split `seasonAdminModel.ts` already
 * makes for `/admin/season`.
 *
 * The second is measured rather than aesthetic. `TournamentJourney` is in the
 * application's entry chunk, so anything it can reach is too. Putting these
 * strings beside the lifecycle put roughly 0.7 KB gzipped of administrator copy
 * into every player's first download and took the entry chunk over its budget.
 * The admin page is lazily routed; this file follows it there.
 *
 * Nothing here decides anything. Contract 143 owns who may act, which step is
 * legal, whether the expected state still holds and that a reason was given.
 */

/** What each state means for a player, in one sentence an operator can act on. */
export function euroPublicationStateSummary(state: EuroPublicationState): string {
  switch (state) {
    case 'hidden':
      return 'Euro 2028 is absent from the weekly platform. Player-facing tournament routes are refused.'
    case 'prelaunch':
      return 'Euro 2028 is announced. Player-facing tournament routes are reachable; entry is not implied by that.'
    case 'registration-open':
      return 'Euro 2028 accepts entries.'
    case 'live':
      return 'Euro 2028 is being played.'
    case 'completed':
      return 'Euro 2028 has finished and remains readable.'
    case 'archived':
      return 'Euro 2028 is archived. There is no further state.'
    default:
      return assertNever(state)
  }
}

/**
 * The server's refusal, turned into a sentence, without inventing a cause.
 *
 * `40001` is the interesting one: the expected state is checked under a row
 * lock, so a mismatch means the state moved between this page's read and its
 * write — another operator, or another tab. Reloading is the answer, and
 * silently retrying against the new state would be this surface deciding a
 * publication step nobody asked for.
 */
export function euroPublicationRefusal(error: unknown, fallback: string): string {
  const code = (error as { code?: unknown } | null)?.code
  switch (typeof code === 'string' ? code : '') {
    case '42501':
    case 'insufficient_privilege':
      return 'Your account does not hold the owner capability publication needs.'
    case '40001':
    case 'serialization_failure':
      return 'The publication state changed while this page was open. Reload before acting again.'
    case '22023':
    case 'invalid_parameter_value':
      return 'The server refused that transition: it requires a reason and a step the lifecycle permits.'
    case '55000':
    case 'object_not_in_prerequisite_state':
      return 'This environment holds no Euro publication state row.'
    default:
      return fallback
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Euro publication state: ${String(value)}`)
}
