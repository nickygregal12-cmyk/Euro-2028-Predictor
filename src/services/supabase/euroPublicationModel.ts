/**
 * The Euro 2028 publication lifecycle, as a pure value.
 *
 * WHY IT IS SEPARATE FROM THE CLIENT. `euroPublication.ts` imports the Supabase
 * client, so anything that imports it initialises a credentialled singleton.
 * The route guard and the administration surface both need to reason about the
 * lifecycle without doing that, and so do their unit tests. Same split as
 * `seasonClubForm.ts`/`seasonClubFormModel.ts`.
 *
 * WHY THE ORDER IS RESTATED HERE AT ALL, given that Contract 143 already holds
 * it. This is not a second authority and it decides nothing: the server refuses
 * every transition it does not permit, checks the expected state under a row
 * lock and demands a reason, and none of that is repeated below. What this
 * supplies is the ONE step an operator may be offered next, so the interface
 * stops rendering controls the server would refuse — the same restraint
 * `gameMembershipAction.ts` and `seasonAdminModel.ts` already apply. If the two
 * ever disagree, the server wins and the operator is shown its refusal
 * verbatim; the cost of the drift is a control that does not work, never a
 * transition that should not have happened.
 */

export const EURO_PUBLICATION_STATES = [
  'hidden',
  'prelaunch',
  'registration-open',
  'live',
  'completed',
  'archived',
] as const

export type EuroPublicationState = (typeof EURO_PUBLICATION_STATES)[number]

export type EuroPublicationSnapshot = {
  state: EuroPublicationState
  changedAt: string
}

export function isEuroPublicationState(value: unknown): value is EuroPublicationState {
  return (
    typeof value === 'string' &&
    (EURO_PUBLICATION_STATES as readonly string[]).includes(value)
  )
}

/**
 * The single state that may follow this one, or null at the end of the
 * lifecycle. The list is linear and one-directional by decision: ADR 0026 has
 * no path back from `live` to `hidden`, and Contract 143 enforces adjacency.
 */
export function nextEuroPublicationState(
  current: EuroPublicationState,
): EuroPublicationState | null {
  const at = EURO_PUBLICATION_STATES.indexOf(current)
  return EURO_PUBLICATION_STATES[at + 1] ?? null
}
