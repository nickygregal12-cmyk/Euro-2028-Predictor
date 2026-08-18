import type { SeasonPlayerProfile } from '../../../services/supabase/seasonPlayerProfileModel'
import type { SeasonRankHistory } from '../../../services/supabase/seasonRankHistoryModel'
import type { SeasonRivalry } from '../../../services/supabase/seasonRivalryModel'

/**
 * WHAT THE REAL APPLICATION HANDS A vNEXT PLAYER PROFILE.
 *
 * ============================ THREE READS, EACH ALREADY AUTHORITATIVE =====
 *
 *   contract 151  `get_season_player_profile`   who they are and what they did
 *   contract 192  `get_season_rank_history`     where they stood, week by week
 *   contract 192  `get_season_rivalry`          how the two of you compare
 *
 * ============================ THREE OUTCOMES, NOT ONE ====================
 *
 * Each read carries its OWN outcome, because their permission boundaries
 * differ: the profile needs a shared private league, the other two need only
 * contract 191's `compare`. A single page-level outcome could not express
 * "you may plot them but not open them", which is a real and reachable state.
 *
 * The unions below mirror the model's three panels exactly, so the mapper
 * CONVERTS PAYLOADS and never decides a state. Deciding one there would put a
 * permission rule two layers from the server that issued it.
 *
 * ============================ THREE READS, AND THAT IS THE CEILING =======
 *
 * The whole page costs three calls whatever the season's length. Stage 10's
 * predicate forbids "one RPC per matchweek", and contract 129's per-matchweek
 * head-to-head is exactly the read that would have produced one — which is why
 * the comparison here is `get_season_rivalry`, whose window the SERVER
 * truncates. There is no field in this file that a per-matchweek, per-fixture
 * or per-row request would fill, so a surface cannot start asking by accident.
 *
 * ============================ NOTHING HERE IS A CLOCK ====================
 *
 * `generatedAt` is supplied, so the mapper is pure and a test can pin an
 * instant.
 */

type PlayerProfileSourceContext = {
  readonly tournamentId: string
  readonly competitionName: string
  readonly seasonLabel: string
  /** The game this season's standings rank. Never merged with the competition. */
  readonly gameName: string
}

/**
 * THE TWO SERVER-ISSUED ADDRESSES THE PAGE WAS OPENED WITH.
 *
 * `ref` is nullable: contract 191 issues it and a doorway built below that
 * contract has none. Where it is absent the two contract-192 reads CANNOT BE
 * ADDRESSED — a different state from refused, and the panels say so.
 */
export type PlayerProfileTarget = {
  readonly playerId: string
  readonly ref: string | null
  readonly isYou: boolean
}

/*
 * THERE IS NO `displayName` ON THE TARGET, AND THAT IS THE POINT.
 *
 * Stage 9's `openPlayer` intent carries two identifiers and no name field, so a
 * host routing here has none to pass. The page is named by whichever read
 * answered — see `buildPlayerProfileModel` — which means no caller, no route
 * and no query string can decide what this player is called.
 */

/** Contract 151. `refused` is "you share no private league with this player". */
export type ProfileRead =
  | { readonly kind: 'ok'; readonly profile: SeasonPlayerProfile }
  | { readonly kind: 'refused' }
  | { readonly kind: 'failed' }

/** Contract 192's rank history. `refused` is contract 191's `none`. */
export type RankHistoryRead =
  | { readonly kind: 'ok'; readonly history: SeasonRankHistory }
  | { readonly kind: 'unaddressable' }
  | { readonly kind: 'refused' }
  | { readonly kind: 'failed' }

/**
 * Contract 192's rivalry.
 *
 * `self` is not a failure to compare — it is the page being your own, where the
 * RPC refuses in terms ("you cannot compare yourself with yourself") and the
 * answer would render one column twice.
 */
export type RivalryRead =
  | { readonly kind: 'ok'; readonly rivalry: SeasonRivalry }
  | { readonly kind: 'self' }
  | { readonly kind: 'unaddressable' }
  | { readonly kind: 'not-entered' }
  | { readonly kind: 'refused' }
  | { readonly kind: 'failed' }

export type PlayerProfileSource = {
  readonly generatedAt: string
  readonly context: PlayerProfileSourceContext
  readonly target: PlayerProfileTarget
  readonly profile: ProfileRead
  readonly rankHistory: RankHistoryRead
  readonly rivalry: RivalryRead
}
