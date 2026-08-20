// Match Centre reads (design-system §6). Two SECURITY DEFINER RPCs whose gates
// live server-side (20260721130000_match_centre.sql): league-scoped per-match
// picks (post-lock + co-membership) and the overall anonymous distribution
// (post-lock). These wrappers only shape the jsonb payloads; a pre-lock call
// returns counts only, never picks.

import { reportReadFailure } from '../observability/readFailure'
import { db } from './client'
import type { KnockoutStage } from '../../domain/tournament/scoringConfig'

const STAGE_FROM_DB: Record<string, KnockoutStage> = {
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  final: 'FINAL',
  champion: 'CHAMPION',
}
const stage = (s: string | null): KnockoutStage | null => (s ? (STAGE_FROM_DB[s] ?? null) : null)

export type LeagueMatchPicks = {
  kind: 'group' | 'knockout'
  locked: boolean
  totalMembers: number
  predictedCount: number
  /**
   * CONTRACT 171. How many pick rows this payload carried, and whether that was
   * all of them. `get_league_match_picks` caps at 250 rows in display-name order
   * and, until contract 171, said nothing about having done so — so a league of
   * 300 returned 250 rows beside a total of 300 and this surface could not tell
   * truncation from members who had not predicted.
   *
   * They are decoded rather than derived: `picksReturned < totalMembers` is the
   * ORDINARY case for a group match, because only members who predicted appear.
   */
  picksReturned: number
  picksTruncated: boolean
  groupPicks: { displayName: string; isYou: boolean; homeScore: number; awayScore: number; joker: boolean }[]
  koPicks: { displayName: string; isYou: boolean; homeStage: KnockoutStage | null; awayStage: KnockoutStage | null }[]
}

/** League-scoped per-match picks. Throws if the server refuses (not a member). */
export async function fetchLeagueMatchPicks(leagueId: string, matchId: string): Promise<LeagueMatchPicks> {
  const { data, error } = await db.rpc('get_league_match_picks', {
    p_league_id: leagueId,
    p_match_id: matchId,
  })
  if (error) {
    reportReadFailure('match-centre.league-picks', error)
    throw error
  }
  const d = data as {
    kind: 'group' | 'knockout'
    locked: boolean
    total_members: number
    predicted_count: number
    picks_returned?: number
    picks_truncated?: boolean
    picks: {
      display_name: string
      is_you: boolean
      home_score?: number
      away_score?: number
      joker?: boolean
      home_stage?: string | null
      away_stage?: string | null
    }[]
  }
  return {
    kind: d.kind,
    locked: d.locked,
    totalMembers: d.total_members,
    predictedCount: d.predicted_count,
    // A server that predates contract 171 sends neither key. The row count it
    // actually sent is still a fact, and "not truncated" is the safe reading:
    // it adds no notice rather than asserting a loss nobody reported.
    picksReturned: typeof d.picks_returned === 'number' ? d.picks_returned : d.picks.length,
    picksTruncated: d.picks_truncated === true,
    groupPicks:
      d.kind === 'group'
        ? d.picks.map((p) => ({
            displayName: p.display_name,
            isYou: p.is_you,
            homeScore: p.home_score as number,
            awayScore: p.away_score as number,
            joker: Boolean(p.joker),
          }))
        : [],
    koPicks:
      d.kind === 'knockout'
        ? d.picks.map((p) => ({
            displayName: p.display_name,
            isYou: p.is_you,
            homeStage: stage(p.home_stage ?? null),
            awayStage: stage(p.away_stage ?? null),
          }))
        : [],
  }
}

export type MatchDistribution = {
  kind: 'group' | 'knockout'
  locked: boolean
  totalEntries: number
  predictedCount: number
  buckets: { homeScore: number; awayScore: number; count: number }[]
  homeCount: number
  awayCount: number
}

/** Overall anonymous distribution across all submitted entries (post-lock). */
export async function fetchMatchDistribution(matchId: string): Promise<MatchDistribution> {
  const { data, error } = await db.rpc('get_match_prediction_distribution', {
    p_match_id: matchId,
  })
  if (error) {
    reportReadFailure('match-centre.distribution', error)
    throw error
  }
  const d = data as {
    kind: 'group' | 'knockout'
    locked: boolean
    total_entries: number
    predicted_count: number
    buckets?: { home_score: number; away_score: number; count: number }[]
    home_count?: number
    away_count?: number
  }
  return {
    kind: d.kind,
    locked: d.locked,
    totalEntries: d.total_entries,
    predictedCount: d.predicted_count,
    buckets: (d.buckets ?? []).map((b) => ({ homeScore: b.home_score, awayScore: b.away_score, count: b.count })),
    homeCount: d.home_count ?? 0,
    awayCount: d.away_count ?? 0,
  }
}
