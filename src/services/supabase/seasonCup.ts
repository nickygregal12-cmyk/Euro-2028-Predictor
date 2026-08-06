import { supabase } from './client'
import type {
  CupPhaseKind,
  CupPhasePage,
  SeasonCupGateway,
} from '../../features/season/cupPhaseModel'

/**
 * The real Predictor Championship phase gateway, over contract 120's bounded
 * read.
 *
 * IT TAKES A COMPETITION, NOT A SEASON. A season can hold several Championship
 * instances — one public plus organiser-created private ones — and which one
 * the player means is already resolved by the games hub listing they arrived
 * from. Re-deciding it here would put a second answer in the browser, so the
 * caller passes the competition it already holds, exactly as the RPC does.
 *
 * WHICH AUTHORITY PRODUCED THE TABLE IS NOT VISIBLE HERE, DELIBERATELY. The
 * server reads the phase and answers from the authority that owns it; this
 * module maps one payload shape regardless. A gateway that branched on phase
 * would be re-implementing the lookup the RPC exists to own.
 */

type TableRowPayload = {
  user_id: string
  is_you: boolean
  group_rank: number
  table_points: number
  points_for: number
  points_against: number
  window_points: number
  exacts: number
  corrects: number
  scoreline_error: number
}

type PhasePayload = {
  competition_id: string
  entered: boolean
  phase_kind?: CupPhaseKind
  group?: {
    id: string
    ordinal: number
    size: number
    phase_kind: CupPhaseKind
    parent_group_id: string | null
  }
  table?: readonly TableRowPayload[]
}

function requireShape(payload: unknown): PhasePayload {
  const phase = payload as PhasePayload
  if (
    phase === null ||
    typeof phase !== 'object' ||
    typeof phase.entered !== 'boolean' ||
    typeof phase.competition_id !== 'string'
  ) {
    // Malformed data fails loudly rather than rendering a guessed table. An
    // empty-looking answer that is really a defect is exactly the silent
    // failure contracts 86/98/116/118/120 exist to end.
    throw new Error('The Predictor Championship response was not in the expected shape.')
  }
  if (phase.entered && (!phase.group || !Array.isArray(phase.table))) {
    throw new Error('The Predictor Championship response was not in the expected shape.')
  }
  return phase
}

export function createSeasonCupRpcGateway(options: {
  competitionId: string
}): SeasonCupGateway {
  return {
    async load(): Promise<CupPhasePage> {
      const { data, error } = await supabase.rpc('get_season_cup_phase', {
        p_competition_id: options.competitionId,
      })
      if (error) throw error
      const phase = requireShape(data)

      if (!phase.entered) {
        return {
          competitionId: phase.competition_id,
          entered: false,
          phaseKind: null,
          group: null,
          table: [],
        }
      }

      const group = phase.group!
      return {
        competitionId: phase.competition_id,
        entered: true,
        phaseKind: phase.phase_kind ?? group.phase_kind,
        group: {
          id: group.id,
          ordinal: group.ordinal,
          size: group.size,
          phaseKind: group.phase_kind,
          parentGroupId: group.parent_group_id,
        },
        table: (phase.table ?? []).map((row) => ({
          userId: row.user_id,
          isYou: row.is_you,
          groupRank: row.group_rank,
          tablePoints: row.table_points,
          pointsFor: row.points_for,
          pointsAgainst: row.points_against,
          windowPoints: row.window_points,
          exacts: row.exacts,
          corrects: row.corrects,
          scorelineError: row.scoreline_error,
        })),
      }
    },
  }
}
