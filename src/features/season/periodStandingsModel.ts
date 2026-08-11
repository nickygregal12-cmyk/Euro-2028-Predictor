import type {
  SeasonPeriodRow,
  SeasonPeriodStandings,
} from '../../services/supabase/seasonPeriodStandings'

/**
 * Presentation model for the two derived season tables (contract 122).
 *
 * THESE NEVER DECIDE THE SEASON, and saying so is part of the surface rather
 * than a comment. ADR 0012 is explicit that the cumulative total is the only
 * ranking that settles a league season; the monthly table and rolling form are
 * retention views over the same settled scores. A player who is first in
 * January and eleventh overall is eleventh. The view carries the sentence that
 * states it, because a table headed "January" beside a table headed
 * "Standings" would otherwise read as two competing claims about the same
 * season.
 *
 * ROWS ARE NAMED ONLY WHERE THE SERVER NAMES THEM. Contract 122 returned
 * `entry_id` and no profile join, so every row here read "Entrant" — a rank
 * against a word, which is close to useless as a retention view. Contract 131
 * added the name behind a flag that is off by default, and the surface asks for
 * it because the season's own leaderboard sits directly above these tables and
 * already names every entrant: this discloses nothing new, and a monthly table
 * of anonymous ranks beside a named leaderboard is a gap rather than a
 * boundary. Where the server still sends no name — a row with no profile — the
 * fallback is "Entrant", never the raw identifier, which is not a person.
 *
 * THE CALLER IS FOUND BY THEIR OWN ENTRY ID, supplied by the caller of this
 * model. When it is unknown — a competition member who never joined the Match
 * Predictor — no row is marked, and the view says nothing about where they
 * stand rather than guessing at a row.
 *
 * ONLY THE TOP OF EACH TABLE IS RENDERED, with the caller's row pinned beneath
 * when it falls outside. A season's month can hold every entrant, the read is
 * not paginated, and a retention view answering "how did my month go" does not
 * need two hundred rows to answer it. The count is always stated, so a
 * truncated table never reads as a complete one.
 */

export type PeriodRowView = {
  key: string
  /** "4", or "=4" when the server gave the same rank to more than one row. */
  rankLabel: string
  rank: number
  /**
   * "You", contract 131's display name, or "Entrant" where the server sent
   * none. Never the entry id, which is an identifier rather than a person.
   */
  label: string
  isYou: boolean
  points: number
  matchweeksPlayed: number
  /** Screen-reader sentence; the visual row is a table of numbers. */
  accessibleSummary: string
}

export type PeriodTableView = {
  /** `YYYY-MM` for a month, null for form. The view formats it. */
  month: string | null
  rows: readonly PeriodRowView[]
  totalCount: number
  /** The caller's row when it fell outside `rows`; null when visible or absent. */
  pinnedYou: PeriodRowView | null
  /** One sentence placing the caller in this table, or null when they are absent. */
  yourLine: string | null
}

export type PeriodStandingsView = {
  period: 'month' | 'form'
  /** Form's window in matchweeks; null for a month. */
  window: number | null
  /** Most recent first for months; exactly one table for form. */
  tables: readonly PeriodTableView[]
  /** True when nothing has settled into this view yet. */
  empty: boolean
  /** The standing reminder that neither view settles anything. */
  derivedNote: string
}

const DEFAULT_VISIBLE_ROWS = 10

const DERIVED_NOTE =
  'These are views of the same settled matchweeks. The season is decided by the overall table above — nothing here changes it.'

function ordinal(rank: number, tied: boolean): string {
  return tied ? `joint ${rank}` : `${rank}`
}

function toRow(row: SeasonPeriodRow, tied: boolean, isYou: boolean): PeriodRowView {
  const played =
    row.matchweeksPlayed === 1 ? '1 matchweek' : `${row.matchweeksPlayed} matchweeks`
  // "You" outranks a name, because a player looking for themselves scans for
  // that word. Otherwise contract 131's name if the server sent one, and
  // "Entrant" when it did not — which is not a placeholder standing in for a
  // name we could have had, but the honest rendering of a row whose name the
  // server chose not to disclose.
  const who = isYou ? 'You' : (row.displayName ?? 'Entrant')

  return {
    key: row.entryId,
    rankLabel: tied ? `=${row.rank}` : `${row.rank}`,
    rank: row.rank,
    label: who,
    isYou,
    points: row.points,
    matchweeksPlayed: row.matchweeksPlayed,
    accessibleSummary: `${who}, ${ordinal(row.rank, tied)}, ${row.points} ${
      row.points === 1 ? 'point' : 'points'
    } from ${played}`,
  }
}

function presentTable(
  month: string | null,
  source: readonly SeasonPeriodRow[],
  yourEntryId: string | null,
  visibleRows: number,
): PeriodTableView {
  // A rank is shared when more than one row holds it; the server already
  // assigned it, so this only counts, never re-ranks.
  const shared = new Map<number, number>()
  for (const row of source) shared.set(row.rank, (shared.get(row.rank) ?? 0) + 1)

  const all = source.map((row) =>
    toRow(row, (shared.get(row.rank) ?? 0) > 1, row.entryId === yourEntryId),
  )
  const rows = all.slice(0, visibleRows)
  const you = yourEntryId === null ? null : (all.find((row) => row.isYou) ?? null)
  const youIsVisible = rows.some((row) => row.isYou)

  return {
    month,
    rows,
    totalCount: all.length,
    pinnedYou: you && !youIsVisible ? you : null,
    yourLine:
      you === null
        ? null
        : `You are ${ordinal(you.rank, you.rankLabel.startsWith('='))} of ${all.length} on ${
            you.points
          } ${you.points === 1 ? 'point' : 'points'} from ${
            you.matchweeksPlayed === 1 ? '1 matchweek' : `${you.matchweeksPlayed} matchweeks`
          }.`,
  }
}

export function presentPeriodStandings(
  standings: SeasonPeriodStandings,
  yourEntryId: string | null,
  visibleRows: number = DEFAULT_VISIBLE_ROWS,
): PeriodStandingsView {
  if (standings.period === 'form') {
    const table = presentTable(null, standings.rows, yourEntryId, visibleRows)
    return {
      period: 'form',
      window: standings.window,
      // An empty form table is one table with no rows, not no table: the view
      // still has a heading to hang "nothing settled yet" from.
      tables: table.totalCount === 0 ? [] : [table],
      empty: table.totalCount === 0,
      derivedNote: DERIVED_NOTE,
    }
  }

  // Most recent month first. The read returns them ascending because that is
  // the natural key order; a retention view is read newest-first.
  const tables = standings.months
    .map((table) => presentTable(table.month, table.rows, yourEntryId, visibleRows))
    .filter((table) => table.totalCount > 0)
    .sort((left, right) => (right.month ?? '').localeCompare(left.month ?? ''))

  return {
    period: 'month',
    window: null,
    tables,
    empty: tables.length === 0,
    derivedNote: DERIVED_NOTE,
  }
}

/** Everything the panel may ask of the world. Injected, so the page stays pure. */
export type SeasonPeriodStandingsGateway = {
  load(period: 'month' | 'form'): Promise<SeasonPeriodStandings>
  /** The caller's own entry, so their row can be found. Null when they hold none. */
  myEntryId(): Promise<string | null>
}
