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
  /**
   * The member's account id, carried through so a row can open a head-to-head.
   * Null for the caller's own row, because there is no comparison to make.
   */
  userId: string | null
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
  /**
   * The gap to the member immediately above the caller, and to the leader when
   * that is somebody else: "6 points behind Jamie · 14 behind Priya".
   *
   * WHY IT IS HERE AND NOT A NEW READ. The owner's 10 August direction asks the
   * product to answer "how are the people I play with doing" without burying
   * it, and names the gap to a leader or a close rival among the things a Hub
   * or league card should say. Every number in it is already on screen — this
   * is subtraction over rows contract 128 returned, not a second ranking
   * authority and not a second request.
   *
   * NULL WHENEVER IT WOULD BE A GUESS. No entry, nobody else entered, or the
   * rows that would answer it are on a page the member has not loaded: a gap
   * derived from a partial table would be confidently wrong, and the standing
   * line above it is still true.
   */
  yourGapLine: string | null
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
    userId: isYou ? null : source.userId,
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

function points(value: number): string {
  return value === 1 ? '1 point' : `${value} points`
}

/**
 * The gap to the nearest rival above, and to the leader.
 *
 * IT READS THE SERVER'S RANK AND SUBTRACTS THE SERVER'S POINTS. Nothing here
 * re-orders anybody: who is above whom is the order contract 128 returned, and
 * every difference is between two totals the server sent.
 *
 * "NEAREST" IS A CLAIM ABOUT LOADED ROWS, so it is only made when the caller's
 * own row is among them. Paging is sequential from the top, so a loaded own row
 * means the row above it is loaded too; a member deep in a long league who has
 * only fetched page one has their own row PINNED rather than listed, and the
 * member immediately above them is on a page nobody asked for. Calling the
 * leader their nearest rival in that state would be confidently wrong, so the
 * sentence becomes the one that is still true — the gap to the leader, named as
 * the leader.
 *
 * A MEMBER WHO HAS NOT ENTERED IS NOT A RIVAL. They are ranked last on zero by
 * the read so that a league is not hidden from the person who created it, and
 * treating that as a lead would be a sentence about somebody who has not
 * played.
 */
function yourGapLine(
  you: SeasonLeagueStandingsYou | null,
  accumulated: readonly SeasonLeagueStandingsRow[],
): string | null {
  if (!you || !you.hasEntry) return null

  const leader = accumulated.find((row) => row.hasEntry && !row.isYou && row.rank === 1) ?? null
  const youIndex = accumulated.findIndex((row) => row.isYou)

  if (youIndex === -1) {
    if (!leader) return null
    const gap = leader.points - you.points
    if (gap <= 0) return null
    return `${points(gap)} behind the leader, ${leader.displayName}.`
  }

  // Above and below the caller, in the server's own order, entrants only.
  const above = accumulated.slice(0, youIndex).filter((row) => row.hasEntry).at(-1) ?? null
  const below = accumulated.slice(youIndex + 1).find((row) => row.hasEntry) ?? null

  if (!above) {
    // Top of the table, or everyone above has not entered.
    if (leader && leader.rank === you.rank) return `Level at the top with ${leader.displayName}.`
    if (!below) return null
    const lead = you.points - below.points
    return lead <= 0
      ? `Level with ${below.displayName} on points.`
      : `Leading ${below.displayName} by ${points(lead)}.`
  }

  const gap = above.points - you.points
  const nearest =
    gap <= 0
      ? `Level with ${above.displayName} on points.`
      : `${points(gap)} behind ${above.displayName}.`

  if (!leader || leader.userId === above.userId) return nearest
  const toLeader = leader.points - you.points
  if (toLeader <= 0) return nearest
  return `${nearest} ${toLeader} behind ${leader.displayName}.`
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
    yourGapLine: yourGapLine(page.you, accumulatedRows),
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
