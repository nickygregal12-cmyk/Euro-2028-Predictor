import type { PersistentPlayerAction } from '../../../services/supabase/playerActions'
import {
  actionClassOf,
  actionKindOf,
  type VNextActionItem,
  type VNextActionKind,
  type VNextActionsModel,
} from '../../models/actions'
import type { ActionsSource } from './actionsSource'

/**
 * `ActionsSource` → `VNextActionsModel`. PURE: no network, no storage, no clock
 * and no React — the four rules every vNext mapper is written under.
 *
 * ============================ IT COMPOSES COPY AND NOTHING ELSE ==========
 *
 * The server sends an `action_type` and a `context` object; it does not send a
 * sentence. So this file is where the two become words, and the single rule it
 * is written under is that EVERY WORD MUST BE BACKED BY A FIELD THAT ARRIVED.
 *
 * A settled matchweek whose context carries no `points` says so by omission —
 * it gets a headline and no detail — rather than showing "0 points", which is a
 * different and much worse claim. A card with no `fixtures` count does not get
 * "0 to predict". Every reader below returns `null` on a missing or wrongly
 * typed value, and every sentence is built only where its inputs are present.
 *
 * ============================ THE ORDER IS THE SERVER'S ==================
 *
 * `get_my_actions` orders by `priority`, then `deadline_at` nulls last, then
 * `action_key`, and returns an `ordinal` recording it. This mapper preserves
 * the array order it was given and sorts nothing. An LMS pick outranks a
 * matchweek because the migration says a pick that is never made ELIMINATES the
 * entrant — that is a game rule, it lives in the database, and re-deciding it
 * here would be a second opinion about elimination.
 *
 * ============================ AND NO CLOCK IS READ ======================
 *
 * `deadlineAt` is carried through as the server's instant. Nothing here
 * compares it to now, formats it, or decides that anything is urgent. The
 * surface formats; the shell's own deadline mechanism is the only thing in this
 * lane permitted to make a countdown current.
 */

/* ==========================================================================
   CONTEXT READERS — every one returns null rather than a plausible default
   ========================================================================== */

function textOf(context: Record<string, unknown>, key: string): string | null {
  const value = context[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function countOf(context: Record<string, unknown>, key: string): number | null {
  const value = context[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function flagOf(context: Record<string, unknown>, key: string): boolean {
  return context[key] === true
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`
}

/* ==========================================================================
   THE FIVE KINDS, EACH IN ITS OWN WORDS
   ========================================================================== */

/**
 * WHAT THE ITEM SAYS.
 *
 * The headline is the thing that needs doing or the thing that happened; the
 * detail is the supporting fact, and it is `null` far more often than it is
 * present. A round label is the one field almost every generator carries, so it
 * anchors most headlines — and where even that is absent the kind's own generic
 * sentence is used, which is a description of the KIND rather than an invented
 * fact about this row.
 */
function copyOf(
  kind: VNextActionKind,
  context: Record<string, unknown>,
): { headline: string; detail: string | null } {
  const round = textOf(context, 'round_label')

  switch (kind) {
    case 'matchweek-predictions-due': {
      // `fixtures` and `predicted` are contract 163's progress, and they are
      // the reason this feed beats a derived deadline: "4 of 10 predicted" is
      // a state, where "predictions due" is only a category.
      const fixtures = countOf(context, 'fixtures')
      const predicted = countOf(context, 'predicted')
      const headline = round === null ? 'Predictions needed' : `${round} predictions needed`

      if (fixtures === null) return { headline, detail: null }
      if (predicted === null) {
        return { headline, detail: `${plural(fixtures, 'fixture')} on this card` }
      }
      // A CARD WITH NOTHING ON IT YET reads better as the count than as "0 of
      // 10 predicted", which invites the reader to check what they got wrong.
      if (predicted === 0) {
        return { headline, detail: `${plural(fixtures, 'fixture')} to predict` }
      }
      return { headline, detail: `${predicted} of ${fixtures} predicted` }
    }

    case 'lms-pick-due':
      return {
        headline: round === null ? 'Pick your club' : `Pick your club for ${round}`,
        // NO SECOND SENTENCE. The generator's context carries the window id and
        // the label and nothing else, and "miss this and you are out" is a rule
        // this file may describe only if the server said it — which it did not.
        detail: null,
      }

    case 'cup-penalty-number-due': {
      const stage = textOf(context, 'stage')
      return {
        headline: 'Choose your penalty number',
        detail: round ?? stage,
      }
    }

    case 'matchweek-settled': {
      const points = countOf(context, 'points')
      const scored = countOf(context, 'fixtures_scored')
      const joker = flagOf(context, 'joker_applied')
      const headline = round === null ? 'A matchweek was settled' : `${round} is settled`

      // POINTS ARE THE WHOLE NEWS, and a missing value is silence rather than
      // a zero: "0 points" and "we do not know yet" are different sentences and
      // only one of them is true here.
      if (points === null) {
        return { headline, detail: scored === null ? null : `${plural(scored, 'fixture')} scored` }
      }

      const banked = `${plural(points, 'point')} banked`
      return { headline, detail: joker ? `${banked}, Joker applied` : banked }
    }

    case 'game-consequence': {
      // The outcome vocabulary is the server's — `qualified`, `survived`,
      // `eliminated`, `champion` — and an unrecognised one falls through to a
      // sentence that claims nothing rather than to a guess.
      const outcome = textOf(context, 'outcome')
      switch (outcome) {
        case 'champion':
          return { headline: 'You won it', detail: null }
        case 'qualified':
          return { headline: 'You qualified', detail: null }
        case 'survived':
          return { headline: 'You survived the round', detail: null }
        case 'eliminated':
          return {
            headline: 'You were eliminated',
            // Disqualification and elimination are different facts and the
            // server distinguishes them, so this does too.
            detail: flagOf(context, 'disqualified') ? 'Disqualified' : null,
          }
        default:
          return { headline: 'Your game moved on', detail: null }
      }
    }

    case 'unknown':
      // A KIND THIS BUILD DOES NOT KNOW. It is still shown, because the server
      // recorded something for this player and hiding it would be worse than
      // describing it plainly. It claims nothing beyond its own existence.
      return { headline: 'Something happened in one of your games', detail: null }
  }
}

/**
 * Every action the server sent, in the order it sent them.
 *
 * `null` FEED RETURNS `null` MODEL, and the two are different from an empty
 * one. A surface must be able to draw nothing while the read is out and draw
 * "you are up to date" once it lands, and it cannot do that from a single
 * empty array.
 */
export function buildActionsModel(source: ActionsSource): VNextActionsModel | null {
  const feed = source.feed
  if (feed === null) return null

  // The competition names, keyed by the id the feed addresses them with. Built
  // once rather than searched per row.
  const names = new Map<string, string>()
  for (const competition of source.competitions) {
    names.set(competition.tournamentId, competition.name)
  }

  return {
    // THE SERVER'S COUNT, NOT A COUNT OF THIS ARRAY. The read caps at fifty and
    // computes `unseen` over the whole table, so counting the rows here would
    // silently under-report a player with more than fifty items — and the
    // migration's own comment says a badge that disagrees with the list it
    // opens is worse than no badge.
    unseen: feed.unseen,
    items: feed.actions.map((action) => item(action, names)),
  }
}

function item(
  action: PersistentPlayerAction,
  names: ReadonlyMap<string, string>,
): VNextActionItem {
  const kind = actionKindOf(action.actionType)
  const { headline, detail } = copyOf(kind, action.context)

  return {
    key: action.actionKey,
    kind,
    actionClass: actionClassOf(kind),
    contextId: action.tournamentId,
    competitionId: action.competitionId,
    // `null` WHERE THE PLAYER'S LIST DOES NOT COVER IT. Not the tournament id
    // as a fallback label — an id is not a name and showing one would be the
    // product telling a player about a competition it cannot name.
    competitionName: names.get(action.tournamentId) ?? null,
    headline,
    detail,
    deadlineAt: action.deadlineAt,
    seen: action.seen,
  }
}
