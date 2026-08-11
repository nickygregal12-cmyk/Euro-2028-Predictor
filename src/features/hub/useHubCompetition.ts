import { usePlayerCompetitions } from '../../app/providers/PlayerCompetitionsProvider'
import { findHubCompetition, type HubCompetition } from './competitionCatalogue'

/**
 * The competition a `/competitions/:competitionSlug/:seasonSlug/**` route names,
 * resolved from the server's own catalogue (contract 147).
 *
 * WHY IT IS A HOOK AND NOT A LOOKUP. The catalogue used to be a module-level
 * array, so resolving a route's competition was synchronous and could only ever
 * answer "found" or "not found". It is now a value the shell reads from the
 * server, which adds a third answer — **not yet** — and a page that treats that
 * as "not found" tells a player their competition does not exist for as long as
 * the read takes. The three states are kept apart here so no page has to
 * remember to.
 *
 * IT READS THE SHELL'S ONE ANSWER rather than issuing its own request. The
 * provider already holds the catalogue for the rail and the three global
 * destinations; a fourth read would be a fourth chance to disagree about which
 * competitions exist.
 */

export type HubCompetitionState =
  | { status: 'loading' }
  /** The catalogue could not be read at all. Not the same as "no such season". */
  | { status: 'failed' }
  /** The catalogue was read and holds no such competition season. */
  | { status: 'missing' }
  | { status: 'ready'; competition: HubCompetition }

export function useHubCompetition(
  competitionSlug: string | undefined,
  seasonSlug: string | undefined,
): HubCompetitionState {
  const { status, player } = usePlayerCompetitions()

  if (status === 'loading') return { status: 'loading' }
  if (status === 'failed' || player === null) return { status: 'failed' }

  const competition = findHubCompetition(player.catalogue, competitionSlug, seasonSlug)
  return competition ? { status: 'ready', competition } : { status: 'missing' }
}
