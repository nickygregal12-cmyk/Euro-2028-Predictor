import type { SeasonPlayerProfile } from '../../services/supabase/seasonPlayerProfileModel'
import type { SeasonLeagueMovement } from '../../services/supabase/seasonLeagueMovementModel'

/**
 * The Matchweek Recap: what the player's last settled matchweek did to them.
 *
 * WHY IT CAN EXIST NOW. It was outstanding because two facts had no read.
 * Contract 151 supplies the player's own season — banked matchweek points, the
 * season total, rank and field size, and exact/correct counts over settled
 * matchweeks. Contract 150 supplies movement inside a private league. Neither
 * is recomputed here and nothing is estimated: every number below came from one
 * of those two reads.
 *
 * IT IS NOT SEASON WRAPPED. This is the CURRENT settled matchweek, derived live
 * each time. `MIG-UI-08` still owns the permanent, immutable end-of-season
 * archive — a snapshot that must not change when a later formula does — and
 * building this does not build that.
 *
 * A MATCHWEEK COUNTS AS SETTLED WHEN ITS POINTS ARE BANKED. Contract 151
 * returns `points: null` for a matchweek that has not settled, so "the latest
 * settled matchweek" is the most recent history entry with points — never a
 * comparison against a clock, and never the most recent matchweek that merely
 * has predictions in it.
 *
 * MOVEMENT IS LEAGUE-SCOPED, BECAUSE THAT IS WHERE IT IS AUTHORITATIVE.
 * Contract 150 answers for a private league. There is no season-wide "34th →
 * 29th" read, so this model does not claim one: the season line carries the
 * CURRENT rank and field size, and movement appears only beside the league it
 * was measured in.
 *
 * PURE.
 */

export type RecapLeagueMovement = {
  leagueId: string
  leagueName: string
  rankBefore: number
  rankAfter: number
  /** Positive is a climb. */
  movement: number
  fieldSize: number
  gapToLeaderAfter: number
}

export type MatchweekRecap = {
  competitionKey: string
  competitionName: string
  /** Where the competition lives, for the link onward. */
  href: string
  matchweekLabel: string
  matchweekOrdinal: number
  points: number
  jokerPlayed: boolean
  /** The season so far. Current position, not a movement. */
  seasonPoints: number | null
  seasonRank: number | null
  fieldSize: number | null
  /** Over settled matchweeks only, from the read's own counts. */
  exactScores: number | null
  correctOutcomes: number | null
  /** Empty unless a league of the player's settled this matchweek. */
  leagues: readonly RecapLeagueMovement[]
}

/**
 * One competition's recap, or null when there is nothing settled to recap.
 *
 * `movements` is keyed by league id and may be empty; an unsettled or
 * unreadable league simply contributes nothing rather than an empty row.
 */
export function presentMatchweekRecap(
  competitionKey: string,
  competitionName: string,
  href: string,
  profile: SeasonPlayerProfile,
  movements: readonly { leagueId: string; leagueName: string; movement: SeasonLeagueMovement }[] = [],
): MatchweekRecap | null {
  if (!profile.entered) return null

  // History is most recent first, so the first entry with banked points IS the
  // latest settled matchweek. A matchweek that has locked but not settled is
  // skipped rather than reported with a blank score.
  const latest = profile.history.find((matchweek) => matchweek.points !== null)
  if (!latest || latest.points === null) return null

  const leagues: RecapLeagueMovement[] = []
  for (const entry of movements) {
    if (!entry.movement.settled) continue
    // Only the matchweek this recap is about. A league whose most recent
    // settled matchweek is a different one would be describing another week.
    if (entry.movement.matchweek?.ordinal !== latest.ordinal) continue
    const you = entry.movement.members.find((member) => member.isSelf)
    if (!you) continue
    leagues.push({
      leagueId: entry.leagueId,
      leagueName: entry.leagueName,
      rankBefore: you.rankBefore,
      rankAfter: you.rankAfter,
      movement: you.movement,
      fieldSize: entry.movement.members.length,
      gapToLeaderAfter: you.gapToLeaderAfter,
    })
  }

  return {
    competitionKey,
    competitionName,
    href,
    matchweekLabel: latest.label,
    matchweekOrdinal: latest.ordinal,
    points: latest.points,
    jokerPlayed: latest.jokerPlayed,
    seasonPoints: profile.season?.points ?? null,
    seasonRank: profile.season?.rank ?? null,
    fieldSize: profile.season?.fieldSize ?? null,
    exactScores: profile.accuracy?.exactScores ?? null,
    correctOutcomes: profile.accuracy?.correctOutcomes ?? null,
    leagues,
  }
}
