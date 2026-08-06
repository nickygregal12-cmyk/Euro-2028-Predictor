/**
 * Season matchweek fixture parsing. Pure: no Supabase import, no network, no
 * clock — the configured wrapper is `seasonFixtures.ts`.
 *
 * WHY THIS EXISTS BESIDE THE MATCH PREDICTOR GATEWAY, which reads the same
 * RPC. That gateway turns `get_season_matchweek_card` into a *prediction* card:
 * it resolves the lock state, computes the Joker allowance for the half, and
 * holds the per-fixture version map that makes a concurrent edit refuse instead
 * of overwriting. A fixtures list needs none of that and must not hold it — a
 * browse surface that kept a version map would be one render away from sending
 * a stale version on somebody else's behalf. So this takes the same payload and
 * keeps only the football.
 *
 * IT DELIBERATELY DROPS `prediction`. What the caller predicted belongs to the
 * game surface, not to the competition's fixture list: §7.3 separates Matches
 * ("fixtures/results") from Play ("actions for all games joined"), and a
 * fixture list that quietly showed predictions would make Matches a second
 * entry surface with none of the lock rules that govern the first.
 *
 * A RESULT IS ONLY A RESULT WHEN THE SERVER SAYS SO. The RPC returns the score
 * only for a fixture whose status is `played`, and this keeps that shape: a
 * score is present or it is absent, and there is no third state the view has to
 * interpret. Nothing here infers that a fixture has finished because its
 * kickoff has passed — a fixture kicks off, and the result arrives when the
 * result arrives.
 */

export type SeasonFixtureStatus = 'scheduled' | 'played' | string

export type SeasonFixture = {
  id: string
  /** ISO instant, or null for a fixture with no scheduled kickoff yet. */
  kickoffAt: string | null
  status: SeasonFixtureStatus
  homeName: string
  awayName: string
  /** Both present or both null; the server sends them only when played. */
  homeScore: number | null
  awayScore: number | null
}

export type SeasonMatchweekFixtures = {
  matchweek: number
  matchweekCount: number
  fixtures: readonly SeasonFixture[]
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function mapFixture(value: unknown): SeasonFixture | null {
  const row = objectOf(value)
  const id = typeof row.id === 'string' ? row.id : null
  const status = typeof row.status === 'string' ? row.status : null
  const homeName = typeof row.home_name === 'string' ? row.home_name : null
  const awayName = typeof row.away_name === 'string' ? row.away_name : null

  // Both club names are required. A fixture rendered as "Celtic v —" is not a
  // fixture, and guessing the missing side is not available to a parser.
  if (!id || !status || !homeName || !awayName) return null

  const homeScore = integerOrNull(row.result_home)
  const awayScore = integerOrNull(row.result_away)

  return {
    id,
    kickoffAt: typeof row.kickoff_at === 'string' ? row.kickoff_at : null,
    status,
    homeName,
    awayName,
    // A half-score is not a score. One side present without the other means
    // the payload disagrees with itself, and neither number is shown.
    homeScore: homeScore !== null && awayScore !== null ? homeScore : null,
    awayScore: homeScore !== null && awayScore !== null ? awayScore : null,
  }
}

export function mapSeasonMatchweekFixtures(value: unknown): SeasonMatchweekFixtures {
  const payload = objectOf(value)
  const matchweek = objectOf(payload.matchweek)
  const number = integerOrNull(matchweek.number)
  const count = integerOrNull(matchweek.of)
  const raw = Array.isArray(payload.fixtures) ? payload.fixtures : null

  if (number === null || count === null || count < 1 || raw === null) {
    throw new Error('The season matchweek response was not in the expected shape.')
  }

  const fixtures = raw.map(mapFixture)
  if (fixtures.some((fixture) => fixture === null)) {
    throw new Error('The season matchweek response contained a malformed fixture.')
  }

  return {
    matchweek: number,
    matchweekCount: count,
    fixtures: fixtures as SeasonFixture[],
  }
}
