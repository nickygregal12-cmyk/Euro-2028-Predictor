import type { InboxAction, PlayInbox } from '../../../features/hub/playInboxModel'
import type { ShellAttentionItem, ShellGameKey } from '../../models/shell'

/**
 * THE CROSS-COMPETITION ATTENTION LAYER, MAPPED FROM A READ THAT ALREADY EXISTS.
 *
 * ============================ WHY THIS IS A MAPPER AND NOT A FEATURE ======
 *
 * `buildShellModel` set `attention: []` for every connected screen from Stage 8
 * to Stage 13, and the stage that recorded that as a decision also recorded WHY
 * it could not stay one past cutover: the route matrix ABSORBS `/play`, whose
 * whole purpose is that *"a player should never have to choose a competition
 * merely to discover what needs doing"*, and vNext Home is competition-scoped.
 * At cutover a player with games in two competitions would have had nothing at
 * all telling them about the second.
 *
 * `useGlobalPlayInbox` and `presentPlayInbox` build that inbox in production
 * TODAY, from each competition's own week, loaded concurrently and settled
 * independently. This is the join between the two, and it adds no read, no
 * capability and no rule.
 *
 * ============================ IT JOINS ON AN ID, NEVER ON A NAME ==========
 *
 * `ShellAttentionItem.contextId` has to match `contexts[].competition.id`, which
 * is the tournament id. `InboxAction` used to identify its competition only by
 * `competitionName` — its own `key` was built from that name — so a mapper
 * written against it could only have joined on a display name. Two seasons of
 * one competition legitimately share a name and a rename is a caption change,
 * so that join would have silently sent a player to the wrong competition.
 *
 * The id is carried on `InboxAction.tournamentId` instead, and this file reads
 * nothing else to decide which competition an item belongs to.
 *
 * ============================ IT CLAIMS ONLY WHAT THE READS SUPPORT =======
 *
 * The stage contract is explicit that an attention surface *"must only claim
 * event classes the backend can actually produce"*, so:
 *
 *   • only OUTSTANDING actions become items. `settled` is "done, waiting or
 *     settled" — a completed matchweek is news, not a thing that needs you, and
 *     an attention layer that reported it would be a notification feed;
 *   • `urgency` is `urgent` or `soon`, taken from the partition
 *     `presentPlayInbox` already made against its own 24-hour window. **`live`
 *     is never emitted**, because nothing in the inbox reports a match in play.
 *     Two of three is the honest subset rather than a strained third;
 *   • `detail` is the action's own deadline sentence or its own words. Nothing
 *     here reads a clock, formats an instant or decides what is urgent.
 *
 * ============================ AND THE CURRENT COMPETITION IS NOT ITS JOB ==
 *
 * Nothing is filtered out here. `attentionElsewhere` in `models/shell.ts` is
 * the one place that removes the active context, and it also drops any item
 * naming a competition the shell has no context for — so this mapper hands over
 * everything it was told and the model decides what is "elsewhere". Two filters
 * for one rule is how they start disagreeing.
 *
 * PURE: no network, no storage, no clock, no React.
 */

/**
 * The inbox's game vocabulary and the shell's, which are the same three games
 * in two spellings. Written as a total record so a fourth game added to
 * `WeekActionKind` fails to compile here rather than silently vanishing from
 * the attention layer.
 */
const GAME_BY_ACTION_KIND: Readonly<Record<InboxAction['kind'], ShellGameKey>> = {
  match_predictor: 'match-predictor',
  last_man_standing: 'last-man-standing',
  championship: 'championship',
}

/**
 * Every competition the player has work in, and the work.
 *
 * `PlayInbox` is the whole of it. The mapper takes the model rather than the
 * hook so it stays pure and so a story can hand it a world.
 */
export function buildShellAttention(inbox: PlayInbox | null): readonly ShellAttentionItem[] {
  if (inbox === null) return []

  return [
    // URGENT FIRST, then the rest — but only because the two source lists are
    // already partitioned and each already sorted by soonest deadline.
    // `attentionElsewhere` re-sorts by urgency and then by this order, so what
    // matters here is that the order is deterministic and clock-free.
    ...inbox.urgent.map((action) => item(action, 'urgent')),
    ...inbox.thisWeek.map((action) => item(action, 'soon')),
  ].filter((entry): entry is ShellAttentionItem => entry !== null)
}

function item(
  action: InboxAction,
  urgency: 'urgent' | 'soon',
): ShellAttentionItem | null {
  // AN ACTION WITH NO COMPETITION CANNOT BE ADDRESSED, and the one way that
  // happens is a competition whose week failed to read AND whose catalogue row
  // was missing too. It is dropped rather than given a placeholder id, because
  // a row that cannot go anywhere is a control that teaches the player the
  // product is broken.
  if (action.tournamentId === '') return null

  // Not outstanding is not attention. `presentPlayInbox` only ever puts
  // outstanding actions in these two lists, and this is the assertion of that
  // rather than a second opinion about it.
  if (!action.outstanding) return null

  return {
    id: action.key,
    contextId: action.tournamentId,
    game: GAME_BY_ACTION_KIND[action.kind],
    // THE GAME'S OWN WORDS. `title` is what the game said needs doing —
    // "3 predictions needed", "Pick your club" — and nothing here rewrites it.
    headline: action.title,
    detail: detailOf(action, urgency),
    urgency,
  }
}

/**
 * WHY NOW, WITHOUT READING A CLOCK.
 *
 * `presentPlayInbox` already decided which of its two windows an action is in,
 * against a `now` it was handed. This turns that decision into copy and does no
 * comparison of its own — a countdown here would be stale the moment the player
 * stopped interacting, which is the rule `useDeadlineClock` exists for and
 * which the shell explicitly does not take part in.
 *
 * An action with no deadline the game could supply gets no invented one.
 */
function detailOf(action: InboxAction, urgency: 'urgent' | 'soon'): string {
  if (action.locksAt === null) {
    return `${action.seasonLabel} · still open`.trim()
  }
  return urgency === 'urgent' ? 'Locks within a day' : 'Locks later this week'
}
