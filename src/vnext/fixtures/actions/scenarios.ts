import type { VNextShellActions } from '../../app/VNextActionsProvider'
import type { VNextActionItem, VNextActionsModel } from '../../models/actions'

/**
 * THE ACTION CENTRE'S DETERMINISTIC WORLDS.
 *
 * Deterministic and offline, like every fixture in this directory: no Supabase,
 * no provider call, no clock. A story, a render test and a screenshot all see
 * the same inbox.
 *
 * ============================ WHAT THESE WORLDS ARE FOR ==================
 *
 * Not "a full one" and "an empty one". The states that are hard to get right
 * and easy to get plausibly wrong:
 *
 *   • NOT LOADED versus EMPTY. Two worlds that look similar and mean opposite
 *     things — one is "we have not asked yet" and the other is the CLAIM
 *     "nothing is waiting for you". A surface that draws them the same way has
 *     told a player they are up to date before anybody checked.
 *   • A CONTEXT THAT CARRIED LESS THAN THE HAPPY PATH. `sparseContext` is the
 *     world where the composed copy is most likely to invent a zero.
 *   • A COMPETITION THE PLAYER'S LIST DOES NOT COVER, which must be named as
 *     unknown rather than labelled with an id.
 *   • A KIND THIS BUILD DOES NOT KNOW, which must still be shown.
 *
 * `deadlineAt` values are fixed instants. Nothing in this lane compares them to
 * now, so they are data rather than a clock.
 */

/** A fixed instant, so a story is the same on every run. */
const LOCKS_SOON = '2026-08-29T14:00:00.000Z'

function item(over: Partial<VNextActionItem> & { key: string }): VNextActionItem {
  return {
    kind: 'lms-pick-due',
    actionClass: 'needs-you',
    // STATED PER WORLD RATHER THAN DERIVED FROM THE KIND. The mapper derives
    // it; a fixture that derived it the same way would agree with a mapper that
    // had started deriving it wrongly.
    game: 'last-man-standing',
    contextId: 'tournament-caledonian',
    competitionId: 'comp-lms',
    competitionName: 'Caledonian Premiership',
    headline: 'Pick your club',
    detail: null,
    deadlineAt: null,
    seen: false,
    ...over,
  }
}

function model(items: readonly VNextActionItem[], unseen?: number): VNextActionsModel {
  return {
    // The SERVER's count by default mirrors the unread rows, but a world may
    // state its own — the read caps at fifty and computes `unseen` over the
    // whole table, so the two legitimately differ for a busy player.
    unseen: unseen ?? items.filter((entry) => !entry.seen).length,
    items,
  }
}

function actions(over: Partial<VNextShellActions> = {}): VNextShellActions {
  return { model: model([]), status: 'ready', ...over }
}

/* ==========================================================================
   THE WORLDS
   ========================================================================== */

/**
 * THE ORDINARY MONDAY. Work in two competitions and a weekend's worth of news,
 * in the server's own priority order — the LMS pick first because a pick that
 * is never made eliminates the entrant, which is a rule in the database and not
 * a judgement made by the surface.
 */
const busyWeek = actions({
  model: model([
    item({
      key: 'lms_pick_due:comp-lms:window-9',
      kind: 'lms-pick-due',
      headline: 'Pick your club for Round 9',
      deadlineAt: LOCKS_SOON,
    }),
    item({
      key: 'matchweek_predictions_due:comp-mp:round-12',
      kind: 'matchweek-predictions-due',
      game: 'match-predictor',
      competitionId: 'comp-mp',
      headline: 'Matchweek 12 predictions needed',
      detail: '4 of 10 predicted',
      deadlineAt: LOCKS_SOON,
    }),
    item({
      key: 'cup_penalty_number_due:comp-cup:tie-3',
      kind: 'cup-penalty-number-due',
      game: 'championship',
      contextId: 'tournament-highland',
      competitionId: 'comp-cup',
      competitionName: 'Highland Cup',
      headline: 'Choose your penalty number',
      detail: 'Quarter-final',
    }),
    item({
      key: 'matchweek_settled:comp-mp:round-11',
      kind: 'matchweek-settled',
      actionClass: 'news',
      game: 'match-predictor',
      competitionId: 'comp-mp',
      headline: 'Matchweek 11 is settled',
      detail: '47 points banked',
      seen: true,
    }),
    item({
      key: 'game_consequence:comp-lms:round-8',
      kind: 'game-consequence',
      actionClass: 'news',
      game: 'last-man-standing',
      headline: 'You survived the round',
      seen: true,
    }),
  ]),
})

/** ONLY WORK. The news group must draw no heading at all, not an empty one. */
const onlyWork = actions({
  model: model([
    item({
      key: 'lms_pick_due:comp-lms:window-9',
      headline: 'Pick your club for Round 9',
      deadlineAt: LOCKS_SOON,
    }),
  ]),
})

/** ONLY NEWS. The mirror of the world above, and the commoner of the two. */
const onlyNews = actions({
  model: model([
    item({
      key: 'matchweek_settled:comp-mp:round-11',
      kind: 'matchweek-settled',
      actionClass: 'news',
      game: 'match-predictor',
      headline: 'Matchweek 11 is settled',
      detail: '62 points banked, Joker applied',
      seen: false,
    }),
    item({
      key: 'game_consequence:comp-cup:final',
      kind: 'game-consequence',
      actionClass: 'news',
      game: 'championship',
      contextId: 'tournament-highland',
      competitionName: 'Highland Cup',
      headline: 'You won it',
      seen: true,
    }),
  ]),
})

/**
 * THE SERVER HAS SAID THERE IS NOTHING. Distinct from `notLoaded` below, and
 * the distinction is the whole point of the pair: this world may say "you are
 * up to date" and that one may not.
 */
const upToDate = actions({ model: model([]), status: 'ready' })

/**
 * THE READ HAS NOT ANSWERED. It must NOT say the inbox is empty — "nothing is
 * waiting" is a claim and nobody has made it yet.
 */
const notLoaded = actions({ model: null, status: 'loading' })

/** THE READ FAILED WITH NOTHING ALREADY LOADED. A retry, not an empty inbox. */
const failed = actions({ model: null, status: 'failed' })

/**
 * A LATER READ FAILED AND AN EARLIER ONE HAD LANDED.
 *
 * The rows stay, because the last thing the server actually said beats a blank
 * panel — and the panel says they may be stale rather than presenting them as
 * current.
 */
const staleAfterFailure = actions({
  model: model([
    item({
      key: 'lms_pick_due:comp-lms:window-9',
      headline: 'Pick your club for Round 9',
      deadlineAt: LOCKS_SOON,
    }),
  ]),
  status: 'failed',
})

/**
 * CONTEXTS THAT CARRIED LESS THAN THE HAPPY PATH.
 *
 * The world where composed copy is most likely to invent something: a settled
 * matchweek with no points, a card with no fixture count, a consequence with an
 * outcome word this build does not know. Every row here must say LESS rather
 * than say a zero.
 */
const sparseContext = actions({
  model: model([
    item({
      key: 'matchweek_predictions_due:comp-mp:round-13',
      kind: 'matchweek-predictions-due',
      game: 'match-predictor',
      headline: 'Predictions needed',
      detail: null,
    }),
    item({
      key: 'matchweek_settled:comp-mp:round-12',
      kind: 'matchweek-settled',
      actionClass: 'news',
      game: 'match-predictor',
      headline: 'A matchweek was settled',
      detail: null,
    }),
    item({
      key: 'game_consequence:comp-lms:round-9',
      kind: 'game-consequence',
      actionClass: 'news',
      // THE GENERATOR SENT A `game_key` THIS BUILD HAS NO SURFACE FOR, so the
      // row is information and not a control. `ko_predictor` is the real one.
      game: null,
      headline: 'Your game moved on',
      detail: null,
    }),
  ]),
})

/**
 * A COMPETITION THE PLAYER'S LIST DOES NOT COVER.
 *
 * Real, and not an error: an action exists for a season the membership read did
 * not return. The row is shown — a deadline the player cannot be told the name
 * of is still a deadline — and it is NOT labelled with the tournament id.
 */
const unknownCompetition = actions({
  model: model([
    item({
      key: 'lms_pick_due:comp-unknown:window-2',
      competitionName: null,
      headline: 'Pick your club for Round 2',
      deadlineAt: LOCKS_SOON,
    }),
  ]),
})

/**
 * A KIND THIS BUILD DOES NOT RECOGNISE.
 *
 * A sixth generator added to the database. It is filed as NEWS rather than as
 * work — telling a player they owe something and being unable to say what is
 * worse than reporting it quietly — and it is shown rather than hidden, because
 * the server recorded something for this player.
 */
const unknownKind = actions({
  model: model([
    item({
      key: 'something_new:comp-x:1',
      kind: 'unknown',
      actionClass: 'news',
      game: null,
      headline: 'Something happened in one of your games',
    }),
  ]),
})

/**
 * MORE UNREAD THAN THE READ RETURNS.
 *
 * `get_my_actions` caps at fifty and counts `unseen` over the whole table, so a
 * badge derived from the rows would under-report. The count here deliberately
 * exceeds the row count, and exceeds the badge's display cap.
 */
const manyUnread = actions({
  model: model(
    [
      item({
        key: 'lms_pick_due:comp-lms:window-9',
        headline: 'Pick your club for Round 9',
        deadlineAt: LOCKS_SOON,
      }),
    ],
    250,
  ),
})

/* ==========================================================================
   THE REGISTRY
   ========================================================================== */

export const actionsScenarios = {
  busyWeek,
  onlyWork,
  onlyNews,
  upToDate,
  notLoaded,
  failed,
  staleAfterFailure,
  sparseContext,
  unknownCompetition,
  unknownKind,
  manyUnread,
} as const

export type ActionsScenarioName = keyof typeof actionsScenarios

export const actionsScenarioNames = Object.keys(
  actionsScenarios,
) as readonly ActionsScenarioName[]

/**
 * One sentence per world, for the review surface. Beside the fixtures rather
 * than in the story file so a reviewer reading either sees the same premise.
 */
export const actionsScenarioPremises: Readonly<Record<ActionsScenarioName, string>> = {
  busyWeek:
    'The ordinary Monday. Work in three competitions and a weekend of news, in the server priority order — the LMS pick leads because a missed pick eliminates the entrant, which is a database rule and not the surface deciding.',
  onlyWork:
    'Nothing has settled. The news group must draw no heading at all rather than a heading over blank space.',
  onlyNews: 'Everything is done and the weekend happened. The mirror of onlyWork, and commoner.',
  upToDate:
    'The server has said there is nothing. This world MAY say "you are up to date" — and it is the only empty-looking one that may.',
  notLoaded:
    'The read has not answered. It must not claim an empty inbox: "nothing is waiting" is a claim and nobody has made it yet.',
  failed: 'The read failed with nothing already loaded. A retry, never an empty inbox.',
  staleAfterFailure:
    'An earlier read landed and a later one failed. The rows stay and the panel says they may be out of date.',
  sparseContext:
    'Contexts that carried less than the happy path. Every row must say LESS rather than render a zero — this is where composed copy invents things.',
  unknownCompetition:
    'An action for a season the membership read did not return. Named as unknown, never labelled with the tournament id, and never dropped.',
  unknownKind:
    'A sixth generator this build predates. Filed as news rather than work, and shown rather than hidden.',
  manyUnread:
    'More unread than the read returns. The badge is the server count, not a count of the rows, and its display is capped while the accessible name is exact.',
}
