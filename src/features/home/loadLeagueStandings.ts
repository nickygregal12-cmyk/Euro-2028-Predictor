import type { LeagueStanding } from '../../domain/tournament/homeDashboard'

export type HomeLeagueSummary = {
  readonly id: string
  readonly name: string
  readonly memberCount: number
  readonly lastActivityAt: string | null
}

type LeaguePageSummary = {
  readonly rows: ReadonlyArray<{ readonly totalPoints: number }>
  readonly you: { readonly rank: number | null; readonly totalPoints: number } | null
}

export type LeagueStandingLoadResult = {
  readonly standings: LeagueStanding[]
  readonly memberReadFailed: boolean
}

/**
 * Load the Home league snapshots concurrently while preserving partial success.
 *
 * The public/user league limit bounds this fan-out. Serialising the reads made
 * Home latency roughly the sum of every league request; `Promise.allSettled`
 * makes it the slowest request instead, without letting one unavailable league
 * discard the other summaries.
 */
export async function loadLeagueStandingsConcurrently(
  leagues: readonly HomeLeagueSummary[],
  fetchPage: (leagueId: string) => Promise<LeaguePageSummary>,
): Promise<LeagueStandingLoadResult> {
  const results = await Promise.allSettled(
    leagues.map(async (league): Promise<LeagueStanding> => {
      const page = await fetchPage(league.id)
      const meInLeague = page.you
      const topPoints = page.rows[0]?.totalPoints ?? 0
      return {
        id: league.id,
        name: league.name,
        memberCount: league.memberCount,
        rank: meInLeague?.rank ?? null,
        gapToTop: meInLeague ? topPoints - meInLeague.totalPoints : null,
        lastActivityMs: Date.parse(league.lastActivityAt ?? '') || 0,
      }
    }),
  )

  return {
    standings: results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    ),
    memberReadFailed: results.some((result) => result.status === 'rejected'),
  }
}
