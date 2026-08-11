/**
 * Season period-standings response parsing (contract 122). Pure: no Supabase
 * import, no network, no clock — the configured wrapper is
 * `seasonPeriodStandings.ts`.
 *
 * ONE READ, TWO SHAPES, AND THE SHAPE IS DECLARED BY THE PAYLOAD ITSELF.
 * `get_season_period_standings` answers both retention views ADR 0012 names,
 * and says which one it answered in `period`. The form reply carries `rows`
 * and a null `months`; the month reply carries `months` and a null `rows`. This
 * parser trusts `period` for that decision rather than sniffing which key is
 * populated, because an empty season legitimately produces an empty array on
 * either side and sniffing would then read a month as a form table.
 *
 * MATCHWEEKS PLAYED IS NOT OPTIONAL, for the same reason it is not optional on
 * the cumulative table: ADR 0012 pairs it with points because "two players on
 * 84 points from 22 and 23 matchweeks are not tied in meaning". A retention
 * view is where that matters most — a month in which a player appeared twice
 * and a month in which they appeared four times are not comparable totals — so
 * a row missing the count throws rather than defaulting to zero.
 *
 * THE ENTRY ID IS IDENTITY, NEVER A LABEL. It exists so the caller can find
 * their own row; a raw identifier is not a name and must never reach the
 * interface.
 *
 * THE NAME IS OPTIONAL AND THE SERVER DECIDES WHETHER TO SEND IT. Contract 122
 * returned no name at all, deliberately, and contract 131 added `display_name`
 * behind a flag that is off by default. So `displayName` is null in three
 * different situations that a surface must not tell apart by guessing: the
 * caller did not ask for names, the entry has no profile, or the profile has no
 * display name. In every one of them the surface renders its own fallback —
 * a server-invented name would be indistinguishable from a real one, which is
 * why contract 131 sends null rather than a placeholder.
 */

export type SeasonPeriodRow = {
  /** Identity for keys and self-matching only. Never rendered. */
  entryId: string
  rank: number
  points: number
  matchweeksPlayed: number
  /** Contract 131's optional name. Null whenever the server did not supply one. */
  displayName: string | null
}

export type SeasonMonthTable = {
  /** `YYYY-MM`, already resolved in the competition's own timezone. */
  month: string
  rows: readonly SeasonPeriodRow[]
}

export type SeasonPeriodStandings =
  | { period: 'form'; window: number; rows: readonly SeasonPeriodRow[] }
  | { period: 'month'; months: readonly SeasonMonthTable[] }

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function mapRow(value: unknown): SeasonPeriodRow | null {
  const row = objectOf(value)
  const entryId = typeof row.entry_id === 'string' ? row.entry_id : null
  const rank = integerOrNull(row.rank)
  const points = integerOrNull(row.points)
  const matchweeksPlayed = integerOrNull(row.matchweeks_played)

  if (!entryId || rank === null || rank < 1 || points === null || matchweeksPlayed === null) {
    return null
  }

  // A blank name is no name. Trimming to null here keeps the "the server sent
  // nothing usable" case in one place rather than in every surface.
  const named = typeof row.display_name === 'string' ? row.display_name.trim() : ''

  return {
    entryId,
    rank,
    points,
    matchweeksPlayed,
    displayName: named.length > 0 ? named : null,
  }
}

function mapRows(value: unknown): readonly SeasonPeriodRow[] {
  // A null array is the SQL's "nothing settled yet", which is an empty table
  // and not a malformed one. A populated array with a bad row is malformed.
  const raw = value === null || value === undefined ? [] : value
  if (!Array.isArray(raw)) {
    throw new Error('Season period standings response was malformed.')
  }
  const rows = raw.map(mapRow)
  if (rows.some((row) => row === null)) {
    throw new Error('Season period standings response contained a malformed row.')
  }
  return rows as SeasonPeriodRow[]
}

export function mapSeasonPeriodStandings(value: unknown): SeasonPeriodStandings {
  const payload = objectOf(value)
  const period = payload.period

  if (period === 'form') {
    const window = integerOrNull(payload.window)
    if (window === null || window < 1) {
      throw new Error('Season period standings response was malformed.')
    }
    return { period: 'form', window, rows: mapRows(payload.rows) }
  }

  if (period === 'month') {
    const raw = payload.months === null || payload.months === undefined ? [] : payload.months
    if (!Array.isArray(raw)) {
      throw new Error('Season period standings response was malformed.')
    }
    const months = raw.map((entry) => {
      const table = objectOf(entry)
      const month = typeof table.month === 'string' ? table.month : null
      // `YYYY-MM` is what `to_char` produced; anything else means the calendar
      // this table is grouped by is not the one the contract derived.
      if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        throw new Error('Season period standings response contained a malformed month.')
      }
      return { month, rows: mapRows(table.rows) }
    })
    return { period: 'month', months }
  }

  throw new Error('Season period standings response was malformed.')
}
