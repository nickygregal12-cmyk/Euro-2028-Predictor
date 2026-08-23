/**
 * CREATING SOMETHING FOR YOUR OWN FRIENDS — the presentation model.
 *
 * It is not a second opinion about what may be created. The application's
 * `features/leagues/createJourneyModel.ts` already answers that, from
 * membership and the published catalogue. The integration adapter maps that
 * answer into the shapes below and this lane adds nothing to it.
 */

/** The three weekly games, as the create corridor addresses them. */
export type CreateGameKey = 'match-predictor' | 'last-man-standing' | 'championship'

/**
 * Where a container would be created.
 *
 * `id` is opaque here on purpose: for a league it is a
 * `game_competition_id`; for the other two it is a season row.
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

/** The Last Man Standing rules an organiser sets. */
export type CreateLmsSetup = {
  readonly lives: number
  readonly saves: number
  readonly drawsRule: 'eliminate' | 'survive'
  readonly endgameOnWipeout: 'play_on' | 'shared_win' | 'reset'
}

/** What the create write/readback is doing. */
export type CreateCommit =
  | { readonly kind: 'idle' }
  | { readonly kind: 'working' }
  | { readonly kind: 'failed'; readonly message: string }

/**
 * WHAT A FINISHED CREATE LEAVES THE ORGANISER HOLDING.
 *
 * `containerId` is retained only after an authoritative reread has found the
 * new object. The create RPC's returned id is a locator for that reread, not
 * sufficient evidence by itself that the next surface can find it.
 */
export type CreatedPrivatePlay = {
  readonly containerId: string
  readonly game: CreateGameKey
  readonly name: string
  readonly competitionName: string
  readonly inviteCode: string | null
  readonly shareUrl: string | null
  /** True for a Championship, which is created and separately launched. */
  readonly awaitsLaunch: boolean
}

/**
 * `review` is a real state. A create is an externally visible mutation with an
 * invite attached, so the player gets one final read-only view before it runs.
 */
export type CreateStep = 'game' | 'setup' | 'review' | 'created'

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
  /** Invite code or URL a player is typing. `/join/:code` validates it. */
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
