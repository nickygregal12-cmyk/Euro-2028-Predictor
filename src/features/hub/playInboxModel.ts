import type { CompetitionWeek, WeekAction, WeekActionKind } from './competitionWeekModel'

/**
 * The cross-competition action inbox: everything this player owes, in one list,
 * across every competition they play in.
 *
 * WHY IT REPLACES A CHOOSER. `/play` used to ask which competition, then show
 * that competition's games. The 10 August 2026 authority is explicit that a
 * player must never have to choose a competition merely to discover what needs
 * doing — the chooser made the answer to "what do I need to do?" cost one
 * decision before it cost any information, and it got worse with every
 * competition added.
 *
 * IT IS ASSEMBLED FROM EACH GAME'S OWN ANSWER. Every action here came from
 * `presentCompetitionWeek`, which came from the game's own read. This model
 * groups and orders; it computes no deadline, no lock and no progress, because
 * five copies of "what is due" is how they start disagreeing.
 *
 * ONLY JOINED GAMES APPEAR. An available game the player has not joined is not
 * an action and never appears here — it belongs to discovery. That is what
 * keeps the inbox the same size on a twenty-competition platform as on a
 * two-competition one: it is a function of what the player plays.
 *
 * A COMPETITION THAT FAILED TO LOAD IS NAMED, NOT DROPPED. Silently omitting it
 * would tell a player they are up to date when a lock is passing. The others
 * still render, because one unreadable competition must not hide four readable
 * ones.
 *
 * URGENCY IS PRESENTATION, NEVER AUTHORITY. The deadline is the server's; the
 * only thing decided here is which heading it sits under, and `now` is an input
 * like everything time-dependent in this repository. No grouping decision here
 * opens, closes or extends anything.
 *
 * A COMPETITION IS IDENTIFIED BY ITS TOURNAMENT ID, AND THE NAME IS A LABEL.
 * `competitionName` used to be the only competition fact on these types, and
 * even `InboxAction.key` was built from it — so anything downstream wanting to
 * join an action back to the competition it belongs to could only join on a
 * display name, which is the one thing this codebase refuses everywhere else it
 * comes up. Two seasons of the same competition legitimately share a name, and
 * a rename is a caption change that would silently become an identity change.
 *
 * The id was always available: `presentPlayInbox` is fed entries the caller
 * builds from `PlayerCompetitions`, which holds `tournamentId` beside each
 * competition, and `loadCompetitionWeek` returns it as well. Carrying it costs
 * one field and is what lets the vNext shell's cross-competition attention
 * layer address a competition rather than describe one.
 *
 * PURE.
 */

export type InboxAction = {
  key: string
  kind: WeekActionKind
  /**
   * The season row id every season read is addressed by. THE IDENTITY.
   * `competitionName` is the caption beside it and never a key.
   */
  tournamentId: string
  competitionName: string
  seasonLabel: string
  gameName: string
  /** What to do, or where they stand. The game's own words. */
  title: string
  locksAt: string | null
  href: string | null
  outstanding: boolean
}

export type PlayInboxEntry = {
  /** The season row id. Present even for a competition whose week failed to
   * read, because it comes from the player's competition list rather than from
   * the read — which is what lets an unreadable competition still be addressed. */
  tournamentId: string
  competitionName: string
  seasonLabel: string
  /** Null when this competition's week could not be read. */
  week: CompetitionWeek | null
}

export type PlayInbox = {
  /** Outstanding and locking within the urgent window, soonest first. */
  urgent: readonly InboxAction[]
  /** Outstanding and further out, or with no deadline the game could supply. */
  thisWeek: readonly InboxAction[]
  /** Nothing outstanding: done, waiting or settled. */
  settled: readonly InboxAction[]
  /**
   * Competitions whose week could not be read. Named AND addressed: a surface
   * that can only say "something went wrong in the Premier League" cannot offer
   * to take the player there.
   */
  unreadable: readonly { tournamentId: string; competitionName: string }[]
  /** True when nothing at all is outstanding and something was readable. */
  allClear: boolean
  /** True when there is nothing to show and nothing failed. */
  empty: boolean
}

const GAME_NAME: Record<WeekActionKind, string> = {
  match_predictor: 'Match Predictor',
  last_man_standing: 'Last Man Standing',
  championship: 'Predictor Championship',
}

/**
 * How far ahead counts as urgent.
 *
 * A day, because a matchweek locks at its first kickoff and the useful
 * distinction for a weekly game is "today or tomorrow" against "later this
 * week". It is a presentation threshold and nothing depends on it being exact.
 */
const URGENT_WINDOW_MS = 24 * 60 * 60 * 1000

function instantOf(value: string | null): number | null {
  if (!value) return null
  const at = new Date(value).getTime()
  return Number.isNaN(at) ? null : at
}

function toAction(
  entry: PlayInboxEntry,
  action: WeekAction,
  index: number,
): InboxAction {
  return {
    // KEYED ON THE ID, not the caption. Two competitions sharing a display name
    // produced colliding React keys and colliding attention items.
    key: `${entry.tournamentId}-${action.kind}-${index}`,
    kind: action.kind,
    tournamentId: entry.tournamentId,
    competitionName: entry.competitionName,
    seasonLabel: entry.seasonLabel,
    gameName: GAME_NAME[action.kind],
    title: action.title,
    locksAt: action.locksAt,
    href: action.href,
    outstanding: action.outstanding,
  }
}

/** Soonest deadline first; an action with no instant sorts after every one that has. */
function bySoonest(left: InboxAction, right: InboxAction): number {
  const a = instantOf(left.locksAt)
  const b = instantOf(right.locksAt)
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a - b
}

export function presentPlayInbox(
  entries: readonly PlayInboxEntry[],
  now: Date,
): PlayInbox {
  const urgent: InboxAction[] = []
  const thisWeek: InboxAction[] = []
  const settled: InboxAction[] = []
  const unreadable: { tournamentId: string; competitionName: string }[] = []
  let readable = 0

  for (const entry of entries) {
    if (entry.week === null) {
      unreadable.push({
        tournamentId: entry.tournamentId,
        competitionName: entry.competitionName,
      })
      continue
    }
    readable += 1
    entry.week.actions.forEach((action, index) => {
      const item = toAction(entry, action, index)
      if (!action.outstanding) {
        settled.push(item)
        return
      }
      const at = instantOf(action.locksAt)
      // Already past its stated lock and still outstanding: the server may have
      // extended the window under contract 119, and only the server knows. It
      // is the most urgent thing on the page either way.
      if (at !== null && at - now.getTime() <= URGENT_WINDOW_MS) urgent.push(item)
      else thisWeek.push(item)
    })
  }

  urgent.sort(bySoonest)
  thisWeek.sort(bySoonest)

  return {
    urgent,
    thisWeek,
    settled,
    unreadable,
    allClear: readable > 0 && urgent.length === 0 && thisWeek.length === 0,
    empty: entries.length === 0,
  }
}
