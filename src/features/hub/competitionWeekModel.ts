import type { MatchPredictorPage } from '../season/matchPredictorModel'
import type { LmsRoundPage } from '../season/lmsRoundModel'
import type { ChampionshipPlayerView } from '../../services/supabase/seasonCupPlayer'

/**
 * "What do I need to do this week?" for one competition season (`DFA-006`).
 *
 * WHERE THIS SITS, AND WHY NOT ON PLAY. `SeasonPlayPage` carries a written
 * decision that it computes no deadline, rank or next action — each game's own
 * read already answers that, and gathering four of them there would put a fifth
 * copy of "what is due" beside the four that know. That decision is kept. This
 * is Overview, whose §7.3 job is exactly the summary Play declines to be, and
 * which until now had nothing to show — its intro paragraph used to promise
 * this in future tense and was deleted for saying so.
 *
 * IT DERIVES NOTHING IT COULD BE TOLD. Every fact below comes out of a game's
 * own authoritative read: the lock instant is the one `get_season_matchweek_card`
 * resolved, the round's deadline is the one `get_season_lms_round` returned, and
 * whether a pick is in is the pick the server holds. This model counts and
 * orders; it does not compute a lock, a rank or a score. A second copy of a
 * deadline is a second thing that can be wrong, and the wrong one is always the
 * one nearer the player.
 *
 * PURE. No clock read, no storage, no network: `now` is an input, as everything
 * time-dependent in this repository is.
 */

export type WeekActionKind = 'match_predictor' | 'last_man_standing' | 'championship'

export type WeekAction = {
  kind: WeekActionKind
  /** What to do, or where they stand when there is nothing to do. */
  title: string
  /** The deadline, or null when the game's read supplied no instant. */
  locksAt: string | null
  /** True when something is still outstanding before that deadline. */
  outstanding: boolean
  href: string | null
}

export type CompetitionWeek = {
  /** The one thing to do first, or null when nothing is outstanding. */
  primary: WeekAction | null
  /** At most two more, per ADR 0023's shape for this surface. */
  secondary: readonly WeekAction[]
  /** Every joined game reported as settled, with nothing outstanding. */
  allClear: boolean
  /** True when no joined game supplied a read at all. */
  empty: boolean
}

export type CompetitionWeekInput = {
  matchPredictor?: { page: MatchPredictorPage; href: string | null } | null
  lms?: { page: LmsRoundPage; href: string | null } | null
  championship?: { view: ChampionshipPlayerView; href: string | null } | null
  now: Date
}

function instantOf(value: string | null): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function matchPredictorAction(
  page: MatchPredictorPage,
  href: string | null,
): WeekAction {
  const total = page.fixtures.length
  const entered = page.fixtures.filter((fixture) => fixture.prediction !== null).length
  // The server's own lock resolution, not a comparison against the clock. A
  // rescheduled fixture can extend an editing window (contract 119) and only
  // the resolver knows.
  const open = !page.lock.locked
  const outstanding = open && entered < total

  return {
    kind: 'match_predictor',
    title: outstanding
      ? `Matchweek ${page.matchweek.number}: ${total - entered} of ${total} still to predict`
      : open
        ? `Matchweek ${page.matchweek.number} card is complete`
        : `Matchweek ${page.matchweek.number} is locked`,
    locksAt: page.lock.lockAt,
    outstanding,
    href,
  }
}

function lmsAction(page: LmsRoundPage, href: string | null): WeekAction | null {
  // Not an entrant, or no round to pick in. Nothing to say rather than an
  // action with no verb — Overview is a summary of what is due, and a game the
  // player has not joined is due nothing.
  if (!page.entered || page.round === null) return null

  // Eliminated is a state, not a task. It is still worth stating, because a
  // player who stops seeing their game entirely assumes something broke.
  const eliminated = page.entryOutcome === 'eliminated'
  const picked = page.pick !== null
  const outstanding = !eliminated && !picked

  return {
    kind: 'last_man_standing',
    title: eliminated
      ? 'Last Man Standing: you are out'
      : picked
        ? `Last Man Standing: ${page.round.label} pick is in`
        : `Last Man Standing: pick a club for ${page.round.label}`,
    locksAt: page.round.locksAt,
    outstanding,
    href,
  }
}

/**
 * The Championship's fixture this round.
 *
 * IT IS NEVER OUTSTANDING, and that is the whole decision. A Championship
 * fixture is won by the Match Predictor points the player is already being told
 * to go and earn — there is no second card, no second pick, nothing else to do.
 * Marking it outstanding would count one task twice and could push the actual
 * task into second place behind its own consequence.
 *
 * So it reports: who they are playing and when it locks. That is worth saying —
 * a player wants to know there is a tie riding on this matchweek — and it is
 * not a thing to do.
 *
 * Contract 120's phase read could not have supplied this: it answers a phase
 * and a table. Contract 133's player view carries the caller's own current
 * fixture with its lock instant and its opponent, which is what makes the
 * Championship expressible here at all.
 */
function championshipAction(
  view: ChampionshipPlayerView,
  href: string | null,
): WeekAction | null {
  if (!view.entered) return null

  const mine = view.fixtures.find((fixture) => fixture.isMyFixture && fixture.status === 'pending')
  if (!mine) return null

  const opponent = mine.isHome ? mine.away : mine.home

  return {
    kind: 'championship',
    title: `Championship: ${mine.windowLabel} against ${opponent.displayName}`,
    locksAt: mine.locksAt,
    outstanding: false,
    href,
  }
}

/**
 * Order the week.
 *
 * URGENCY IS THE DEADLINE, NOT THE GAME. Whatever is outstanding and locks
 * soonest is what a player needs first; a game with no instant sorts last among
 * the outstanding, because "at some point" cannot outrank "at three o'clock".
 * Settled items keep their relative order and follow everything outstanding.
 */
export function presentCompetitionWeek(input: CompetitionWeekInput): CompetitionWeek {
  const actions: WeekAction[] = []

  if (input.matchPredictor) {
    actions.push(matchPredictorAction(input.matchPredictor.page, input.matchPredictor.href))
  }
  if (input.lms) {
    const action = lmsAction(input.lms.page, input.lms.href)
    if (action) actions.push(action)
  }
  if (input.championship) {
    const action = championshipAction(input.championship.view, input.championship.href)
    if (action) actions.push(action)
  }

  if (actions.length === 0) {
    return { primary: null, secondary: [], allClear: false, empty: true }
  }

  const ordered = [...actions].sort((left, right) => {
    if (left.outstanding !== right.outstanding) return left.outstanding ? -1 : 1
    const leftAt = instantOf(left.locksAt)
    const rightAt = instantOf(right.locksAt)
    if (leftAt === rightAt) return 0
    if (leftAt === null) return 1
    if (rightAt === null) return -1
    return leftAt - rightAt
  })

  const outstanding = ordered.filter((action) => action.outstanding)

  return {
    // Nothing outstanding means no primary ACTION, which is different from an
    // empty page: the states still render, they are simply all reports.
    primary: outstanding[0] ?? null,
    secondary: ordered.filter((action) => action !== outstanding[0]).slice(0, 2),
    allClear: outstanding.length === 0,
    empty: false,
  }
}
