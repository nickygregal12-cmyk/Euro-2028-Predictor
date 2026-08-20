/**
 * CREATING SOMETHING FOR YOUR OWN FRIENDS — the presentation model.
 *
 * ============================ WHAT THIS IS NOT ==========================
 *
 * It is not a second opinion about what may be created. The application's
 * `features/leagues/createJourneyModel.ts` already answers that, from
 * membership and the published catalogue, and states at length why the two
 * container shapes cannot be collapsed into one:
 *
 *   • a private MATCH PREDICTOR container is a LEAGUE — a table on top of the
 *     one public game, addressed by a `game_competition_id`, so its hosts are
 *     the competitions the player already PLAYS;
 *   • a private LAST MAN STANDING or PREDICTOR CHAMPIONSHIP is a COMPETITION of
 *     its own, addressed by a season, so its hosts are the published seasons
 *     whether or not the player plays anything in them.
 *
 * The integration adapter maps that answer into the shapes below and this lane
 * adds nothing to it. A refusal arrives as a sentence and is printed; a name
 * length, a lives range and a lock are the server's and its messages come back
 * from it. Nothing here re-validates anything.
 *
 * ============================ AND THE THREE GAMES STAY PEERS ============
 *
 * The Games destination exists because Match Predictor, Last Man Standing and
 * the Predictor Championship are peers rather than one product with two
 * add-ons, and a create corridor is the easiest place to quietly undo that — by
 * ordering them, by describing two of them relative to the first, or by
 * offering the other two only where the first is already played. The model
 * carries the three as a flat list, each with the same fields, and a game that
 * cannot be created carries its own reason rather than being hidden.
 */

/** The three weekly games, as the create corridor addresses them. */
export type CreateGameKey = 'match-predictor' | 'last-man-standing' | 'championship'

/**
 * Where a container would be created.
 *
 * `id` is opaque here on purpose: which server identifier it is — a
 * `game_competition_id` for a league, a season row for the other two — is the
 * adapter's business, and a presentation component that knew the difference
 * would be a presentation component that could send one to the wrong function.
 */
export type CreateHost = {
  readonly id: string
  readonly competitionName: string
  readonly seasonLabel: string
}

export type CreateGameOption = {
  readonly key: CreateGameKey
  readonly name: string
  /** One line on what the container would be. Never a comparison. */
  readonly description: string
  /** Where it could be created. Empty whenever `refusal` is set. */
  readonly hosts: readonly CreateHost[]
  /** Null where one can be created; the reason, in a sentence, where not. */
  readonly refusal: string | null
}

/**
 * The Last Man Standing rules an organiser sets.
 *
 * OFFERED AS CHOICES, NEVER RE-VALIDATED. `season_lms_setups` constrains the
 * ranges; the day the server widens one, this widens with it rather than
 * refusing something it would have accepted.
 */
export type CreateLmsSetup = {
  readonly lives: number
  readonly saves: number
  readonly drawsRule: 'eliminate' | 'survive'
  readonly endgameOnWipeout: 'play_on' | 'shared_win' | 'reset'
}

/** What the create write is doing. `idle` where nothing has been submitted. */
export type CreateCommit =
  | { readonly kind: 'idle' }
  | { readonly kind: 'working' }
  | { readonly kind: 'failed'; readonly message: string }

/**
 * WHAT A FINISHED CREATE LEAVES THE ORGANISER HOLDING.
 *
 * An invite code where the server issued one, and the absence stated where it
 * did not — never a blank field that looks like a code that failed to load.
 * `shareUrl` is composed by the host from the application's own origin, because
 * a presentation module has no business knowing what this deployment is called.
 */
export type CreatedPrivatePlay = {
  readonly game: CreateGameKey
  readonly name: string
  readonly competitionName: string
  readonly inviteCode: string | null
  readonly shareUrl: string | null
  /**
   * True for a Championship, which is created and then separately LAUNCHED.
   * The draw is fixed at whatever field size the organiser launches with and
   * refuses ever after, and launching closes registration — so the corridor
   * says that in words before it offers the control, and never blurs the two
   * into one button.
   */
  readonly awaitsLaunch: boolean
}

export type CreateStep = 'game' | 'setup' | 'created'

export type CreatePrivatePlayModel = {
  /** The instant the model describes, supplied rather than read. */
  readonly generatedAt: string
  readonly step: CreateStep
  readonly games: readonly CreateGameOption[]
  /** The game being set up, once one is chosen. */
  readonly chosen: CreateGameOption | null
  readonly host: CreateHost | null
  readonly name: string
  readonly lms: CreateLmsSetup
  /**
   * The invite code a player is typing, where they have one.
   *
   * THE CORRIDOR HAS TWO WAYS IN, and joining is the commoner of them: most
   * people arrive at private play because a friend sent them something. It is
   * carried here rather than as a second surface because the choice — "I have
   * one" or "I am starting one" — is the same choice, and splitting it across
   * two pages makes a player who has a code hunt for the door.
   *
   * NOTHING IS VALIDATED HERE. `/join/:code` resolves it and answers, and its
   * refusals are deliberately indistinguishable from each other; a corridor
   * that pre-judged the shape of a code would be a second opinion about which
   * codes exist.
   */
  readonly joinCode: string
  readonly commit: CreateCommit
  readonly created: CreatedPrivatePlay | null
  /** True when no game can be created anywhere, so the page says why. */
  readonly blocked: boolean
}

export type CreatePrivatePlayView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable'; readonly message: string }
  | { readonly kind: 'ready'; readonly model: CreatePrivatePlayModel }

/** The name length the corridor states before the server refuses one. */
export const CREATE_NAME_MAX = 40

/** The ranges `season_lms_setups` constrains, offered rather than enforced. */
export const LMS_LIVES = [1, 2, 3] as const
export const LMS_SAVES = [0, 1, 2] as const

export const DEFAULT_LMS_SETUP: CreateLmsSetup = {
  lives: 1,
  saves: 0,
  drawsRule: 'eliminate',
  endgameOnWipeout: 'play_on',
}
