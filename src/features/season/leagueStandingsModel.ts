import type {
  SeasonLeagueStandingsPage,
  SeasonLeagueStandingsRow,
  SeasonLeagueStandingsYou,
} from '../../services/supabase/seasonLeagueStandings'
import { userFacingError } from '../../shared/errors/userFacingError'

/**
 * Presentation model for a season private league's own table.
 *
 * A PRIVATE LEAGUE IS ITS OWN TABLE, and that is the decision the whole file
 * turns on. ADR 0012 ranks a season on cumulative points; contract 128 takes
 * those totals from `season_standings` so a league can never disagree with the
 * season, and recomputes the RANK within the league because a league of eight
 * is not a slice of a table of eight hundred. So a row here shows a league
 * rank beside a season total, and neither number is derived in the browser —
 * deriving either would put a second ranking authority in the client, which is
 * precisely what ADR 0011 forbids.
 *
 * A MEMBER WHO HAS NOT ENTERED THE GAME IS SHOWN AS SUCH, NOT AS A ZERO. The
 * read includes them on purpose: league membership rather than game entry is
 * its boundary, because the alternative hides a league from the person who
 * created it. But a row reading "0 points, 0 matchweeks" beside players who
 * have actually played says something false about them — they have not lost,
 * they have not started. The row says "Not entered" instead, and the
 * accessible sentence says it too, so the distinction survives without sight.
 *
 * THE NOTE THIS FILE REPLACES was honest and is worth remembering: until
 * contract 128 the surface stated that no table was shown because the only
 * read available was written against the tournament scoring tables and would
 * have returned zero for every member. That sentence is now wrong rather than
 * merely stale, which is why it is deleted rather than softened.
 */

export type LeagueStandingsRow = {
  key: string
  /** "4", or "=4" when the rank is shared. */
  rankLabel: string
  rank: number
  displayName: string
  /** Null when the member holds no entry — a total would misrepresent them. */
  points: number | null
  matchweeksPlayed: number | null
  /** Shown in place of the numbers when the member has not entered the game. */
  notEnteredLabel: string | null
  isYou: boolean
  isOwner: boolean
  /** Screen-reader sentence; the visual row is a grid of numbers. */
  accessibleSummary: string
}

export type LeagueStandingsView = {
  rows: readonly LeagueStandingsRow[]
  /**
   * The caller's own row when it fell outside the pages loaded, so a member of
   * a large league still sees where they stand without paging to find out.
   */
  pinnedYou: LeagueStandingsRow | null
  totalCount: number
  hasMore: boolean
  nextCursor: string | null
  /** "8 members, ranked on points from settled matchweeks." */
  captionLine: string
  /**
   * Where the caller stands, in words, or null when they hold no entry in the
   * game — there is no position to state, and inventing one would be worse
   * than silence.
   */
  yourStandingLine: string | null
}

const NOT_ENTERED = 'Not entered'

function summarise(
  source: SeasonLeagueStandingsYou,
  isYou: boolean,
): string {
  const who = isYou ? `${source.displayName} (you)` : source.displayName
  const owner = source.isOwner ? ', league owner' : ''

  if (!source.hasEntry) {
    // No rank is read out either: the server ranks them last on zero, and
    // reading that out would assert a standing they never took part in.
    return `${who}${owner}, has not entered this game`
  }

  const rank = source.tied ? `joint ${source.rank}` : `${source.rank}`
  const played =
    source.matchweeksPlayed === 1 ? '1 matchweek' : `${source.matchweeksPlayed} matchweeks`
  return `${who}${owner}, ${rank}, ${source.points} points from ${played}`
}

function toRow(source: SeasonLeagueStandingsYou, isYou: boolean): LeagueStandingsRow {
  return {
    // Position, not rank: ranks repeat on a tie and would collide as keys.
    key: `row-${source.position}`,
    rankLabel: source.tied ? `=${source.rank}` : `${source.rank}`,
    rank: source.rank,
    displayName: source.displayName,
    points: source.hasEntry ? source.points : null,
    matchweeksPlayed: source.hasEntry ? source.matchweeksPlayed : null,
    notEnteredLabel: source.hasEntry ? null : NOT_ENTERED,
    isYou,
    isOwner: source.isOwner,
    accessibleSummary: summarise(source, isYou),
  }
}

function memberCountLine(total: number): string {
  const members = total === 1 ? '1 member' : `${total} members`
  return `${members}, ranked on points from settled matchweeks.`
}

function yourStandingLine(
  you: SeasonLeagueStandingsYou | null,
  totalCount: number,
): string | null {
  if (!you) return null
  if (!you.hasEntry) {
    return 'You have not entered this game yet, so you are not ranked in this league.'
  }
  const rank = you.tied ? `joint ${you.rank}` : `${you.rank}`
  const points = you.points === 1 ? '1 point' : `${you.points} points`
  return `You are ${rank} of ${totalCount} on ${points}.`
}

/**
 * Present accumulated pages as one table.
 *
 * Takes the rows already accumulated rather than a single page, because "is
 * the caller's own row already on screen" can only be answered against
 * everything loaded so far — asking it of the newest page alone would re-pin a
 * row the member can already see.
 */
export function presentLeagueStandings(
  page: SeasonLeagueStandingsPage,
  accumulatedRows: readonly SeasonLeagueStandingsRow[],
): LeagueStandingsView {
  const rows = accumulatedRows.map((row) => toRow(row, row.isYou))
  const youIsVisible = rows.some((row) => row.isYou)

  return {
    rows,
    pinnedYou: page.you && !youIsVisible ? toRow(page.you, true) : null,
    totalCount: page.totalCount,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
    captionLine: memberCountLine(page.totalCount),
    yourStandingLine: yourStandingLine(page.you, page.totalCount),
  }
}

/**
 * Turn a league standings refusal into the sentence that explains it.
 *
 * Keyed on the error code and never on the server's message, the same
 * discipline `leagueCreateRefusal` and `lmsRefusal` use: the copy belongs to
 * this repository, and a code this table does not know degrades to
 * `userFacingError` rather than leaking a database sentence to a player.
 */
const STANDINGS_REFUSALS: Record<string, string> = {
  // Not a member of this league, or not authenticated at all.
  '42501': 'You are no longer a member of this league.',
  insufficient_privilege: 'You are no longer a member of this league.',
  // The league belongs to a tournament, whose table comes from another read.
  // Unreachable from this surface by construction; stated rather than generic
  // so that if the surface is ever reused it fails loudly instead of vaguely.
  '23514': 'This league is not ranked here. Its table belongs to a tournament.',
  check_violation: 'This league is not ranked here. Its table belongs to a tournament.',
  // The league id matched nothing.
  '02000': 'That league no longer exists.',
  no_data_found: 'That league no longer exists.',
  // A rejected cursor. The player never typed one, so this is ours to fix, and
  // the copy points at the only action that helps.
  '22023': 'We lost our place in the table. Reload it to start again.',
  invalid_parameter_value: 'We lost our place in the table. Reload it to start again.',
}

export function leagueStandingsRefusal(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === 'string' && STANDINGS_REFUSALS[code]) return STANDINGS_REFUSALS[code]
  return userFacingError(error)
}

/** Everything the table may ask of the world. Injected, so the view stays pure. */
export type SeasonLeagueStandingsGateway = {
  load(leagueId: string, cursor: string | null): Promise<SeasonLeagueStandingsPage>
}
