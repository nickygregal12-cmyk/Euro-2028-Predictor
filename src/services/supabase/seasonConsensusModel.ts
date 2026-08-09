/**
 * Season prediction consensus parsing. Pure: no Supabase import, no network,
 * no clock — the configured wrapper is `seasonConsensus.ts`.
 *
 * SHARES ARE DERIVED HERE AND COUNTS COME FROM THE SERVER. The read returns how
 * many entries picked a home win, a draw and an away win; turning three counts
 * into three percentages is arithmetic over one fixture, not a rule, and doing
 * it here keeps the same numbers out of three call sites. What is NOT derived
 * is the cohort, the minimum or which fixtures appear — those are contract
 * 130's and arrive as given.
 *
 * A FIXTURE WHOSE COUNTS DISAGREE WITH ITSELF IS DROPPED, not repaired. If the
 * three outcomes do not sum to the predicted total the payload is describing
 * something this parser does not understand, and a bar chart normalised over a
 * wrong denominator is a confident picture of nothing.
 */

/**
 * Raised by the read before the matchweek locks — a rule, not a fault.
 *
 * It lives in the PURE module rather than beside the fetch so a component can
 * tell the two apart without importing the configured Supabase client. A page
 * that imports the client is a page that cannot be rendered in a test, and
 * CLAUDE.md's rule is plainer than that: components never call Supabase.
 */
export class ConsensusHiddenError extends Error {
  constructor() {
    super('Prediction consensus is hidden until the matchweek locks')
    this.name = 'ConsensusHiddenError'
  }
}

export type ConsensusScoreline = {
  home: number
  away: number
  picks: number
}

export type SeasonConsensusFixture = {
  id: string
  homeName: string
  awayName: string
  kickoffAt: string | null
  /** Both present or both null; the server sends them only when played. */
  resultHome: number | null
  resultAway: number | null
  predicted: number
  homeWin: number
  draw: number
  awayWin: number
  /** Percentages of `predicted`, rounded, in the same three-way order. */
  shares: { homeWin: number; draw: number; awayWin: number }
  /** Most-picked scorelines, at most five, server-ordered. */
  topScores: readonly ConsensusScoreline[]
}

export type SeasonConsensus = {
  suppressed: boolean
  matchweek: number
  minimumEntries: number
  submittedEntries: number
  lockedAt: string | null
  fixtures: readonly SeasonConsensusFixture[]
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function integerOr(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

function share(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

function mapScoreline(value: unknown): ConsensusScoreline | null {
  const row = objectOf(value)
  const home = integerOr(row.home, null)
  const away = integerOr(row.away, null)
  const picks = integerOr(row.picks, null)
  if (home === null || away === null || picks === null) return null
  return { home, away, picks }
}

function mapFixture(value: unknown): SeasonConsensusFixture | null {
  const row = objectOf(value)
  const id = typeof row.id === 'string' ? row.id : null
  const homeName = typeof row.home_name === 'string' ? row.home_name : null
  const awayName = typeof row.away_name === 'string' ? row.away_name : null
  if (!id || !homeName || !awayName) return null

  const predicted = integerOr(row.predicted, null)
  const homeWin = integerOr(row.home_win, null)
  const draw = integerOr(row.draw, null)
  const awayWin = integerOr(row.away_win, null)
  if (predicted === null || homeWin === null || draw === null || awayWin === null) return null
  if (homeWin + draw + awayWin !== predicted) return null

  const resultHome = integerOr(row.result_home, null)
  const resultAway = integerOr(row.result_away, null)
  const complete = resultHome !== null && resultAway !== null

  const rawTop = Array.isArray(row.top_scores) ? row.top_scores : []
  const topScores = rawTop.map(mapScoreline).filter((entry): entry is ConsensusScoreline => entry !== null)

  return {
    id,
    homeName,
    awayName,
    kickoffAt: typeof row.kickoff_at === 'string' ? row.kickoff_at : null,
    resultHome: complete ? resultHome : null,
    resultAway: complete ? resultAway : null,
    predicted,
    homeWin,
    draw,
    awayWin,
    shares: {
      homeWin: share(homeWin, predicted),
      draw: share(draw, predicted),
      awayWin: share(awayWin, predicted),
    },
    topScores,
  }
}

export function mapSeasonConsensus(value: unknown): SeasonConsensus {
  const payload = objectOf(value)
  const matchweek = integerOr(payload.matchweek, null)
  const minimum = integerOr(payload.minimum_entries, null)
  const submitted = integerOr(payload.submitted_entries, null)

  if (matchweek === null || minimum === null || submitted === null) {
    throw new Error('The season consensus response was not in the expected shape.')
  }

  const raw = Array.isArray(payload.fixtures) ? payload.fixtures : []

  return {
    suppressed: payload.suppressed === true,
    matchweek,
    minimumEntries: minimum,
    submittedEntries: submitted,
    lockedAt: typeof payload.locked_at === 'string' ? payload.locked_at : null,
    fixtures: raw
      .map(mapFixture)
      .filter((fixture): fixture is SeasonConsensusFixture => fixture !== null),
  }
}
