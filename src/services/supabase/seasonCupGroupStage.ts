import { db } from './client'
import {
  mapSeasonCupGroupStage,
  type SeasonCupGroupStage,
} from './seasonCupGroupStageModel'
import { mapCupLaunchResult, type CupLaunchResult } from './privateCompetitionsModel'

/**
 * Contract 167's group-stage read, and contract 166's draw beside it.
 *
 * THEY ARE IN ONE MODULE BECAUSE THEY SHIPPED AS A PAIR. 166 draws the
 * multi-group field `launch_season_cup` refused by name — deterministically,
 * from entrant ids dealt round the groups, with no randomness and no seeding —
 * and 167 reads it. The repository's own history is of authorities landing
 * without a reader; keeping the call and the read together is the cheapest way
 * to notice if that ever happens again.
 *
 * THE DRAW REFUSES A SECOND LAUNCH RATHER THAN REDRAWING, which is the
 * behaviour a surface must present: it is not a retry, and an organiser
 * pressing it twice has not reshuffled anybody.
 *
 * WHO REACHES A BRACKET IS NOT THIS. Contract 166 creates the group stage only;
 * qualification is ADR 0014's rule and lives with the authority that owns it.
 */

export type {
  CupGroup,
  CupGroupRow,
  CupGroupStageCompetition,
  SeasonCupGroupStage,
} from './seasonCupGroupStageModel'
export { myGroup } from './seasonCupGroupStageModel'

export async function fetchSeasonCupGroupStage(
  competitionId: string,
  groupOrdinal?: number,
): Promise<SeasonCupGroupStage> {
  const { data, error } = await db.rpc('get_season_cup_group_stage', {
    p_competition_id: competitionId,
    ...(groupOrdinal === undefined ? {} : { p_group_ordinal: groupOrdinal }),
  })
  if (error) throw error
  return mapSeasonCupGroupStage(data)
}

/**
 * Draw the multi-group stage.
 *
 * IRREVERSIBLE, AND THE INTERFACE MUST SAY SO FIRST. It decodes through
 * contract 154's launch decoder because the outcome vocabulary is the same one
 * — launched, already drawn, no viable format — and two decoders over one
 * vocabulary is how they start disagreeing about what `already_drawn` means.
 */
export async function launchCupGroupStage(competitionId: string): Promise<CupLaunchResult> {
  const { data, error } = await db.rpc('admin_launch_cup_group_stage', {
    p_competition_id: competitionId,
  })
  if (error) throw error
  return mapCupLaunchResult(data)
}
