import { db } from './client'
import { mapSeasonLmsField, type SeasonLmsField } from './seasonLmsFieldModel'

/**
 * Query wrapper for contract 164's `get_season_lms_field`.
 *
 * THE REVEAL BOUNDARY IS ENFORCED SERVER-SIDE AND IS NOT RE-DECIDED HERE. The
 * function resolves it against its own clock and nulls another entrant's pick,
 * lives, saves and even whether they have picked at all until the round locks.
 * Nothing in this module or its decoder may fill one of those nulls in.
 *
 * `p_window_sequence` SELECTS A PAST ROUND. Omitted, the server answers about
 * the current one, which is what every surface wants by default.
 */

export type {
  LmsEntrant,
  LmsFieldCounts,
  LmsPick,
  LmsRound,
  LmsRules,
  SeasonLmsField,
} from './seasonLmsFieldModel'
export { isConcealed, myEntrant } from './seasonLmsFieldModel'

export async function fetchSeasonLmsField(
  tournamentId: string,
  windowSequence?: number,
): Promise<SeasonLmsField> {
  const { data, error } = await db.rpc('get_season_lms_field', {
    p_tournament_id: tournamentId,
    p_window_sequence: windowSequence,
  })
  if (error) throw error
  return mapSeasonLmsField(data)
}
