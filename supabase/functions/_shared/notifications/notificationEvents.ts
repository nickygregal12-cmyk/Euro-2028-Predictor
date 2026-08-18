/**
 * The notification event taxonomy.
 *
 * This module is the application's vocabulary for "something happened that a
 * player might want to be told about". It is deliberately provider-neutral:
 * nothing here knows that Novu exists, and swapping the delivery provider must
 * not require editing this file.
 *
 * **These events REPORT domain facts. They never DERIVE them.** A
 * `PredictionLockedEvent` is emitted because the lock authority said the entry
 * locked; it is not evidence that anything locked, and nothing downstream may
 * treat it as such. The same holds for scoring, settlement, reveal,
 * progression, elimination and membership. This layer has no authority over
 * any of them — see `AGENTS.md`.
 *
 * **Unavailable stays unavailable.** Every optional figure below is `null` when
 * the emitting read did not supply it, and `null` is never rendered as zero. A
 * notification saying a player scored 0 points when the truth is that points
 * are not yet known is worse than sending nothing.
 */

/** Which product area an event belongs to. Used for grouping and preferences. */
export type NotificationCategory =
  | 'predictions'
  | 'leagues'
  | 'social'
  | 'last-man-standing'
  | 'results'

/** Fields every event carries, whatever its kind. */
interface NotificationEventBase {
  /** The player to notify. Opaque here; the adapter maps it to a subscriber. */
  readonly recipientId: string
  /** The competition the event happened in. */
  readonly competitionId: string
  /** When the underlying domain fact occurred, as an ISO-8601 instant. */
  readonly occurredAt: string
}

/* ------------------------------------------------------------------ *
 * Predictions
 * ------------------------------------------------------------------ */

/** A matchweek's prediction window closes soon. */
interface PredictionWindowClosingEvent extends NotificationEventBase {
  readonly kind: 'prediction.window_closing'
  readonly matchweek: number
  /** When the window closes. Supplied by the lock authority, never computed. */
  readonly closesAt: string
  /** Fixtures the player has not predicted, or null when not counted. */
  readonly outstandingFixtures: number | null
}

/** The player still has unpredicted fixtures in an open matchweek. */
interface PredictionEntriesOutstandingEvent extends NotificationEventBase {
  readonly kind: 'prediction.entries_outstanding'
  readonly matchweek: number
  readonly outstandingFixtures: number
}

/** The prediction window closed. Stated by the lock authority. */
interface PredictionLockedEvent extends NotificationEventBase {
  readonly kind: 'prediction.locked'
  readonly matchweek: number
  /** Whether the player got an entry in, or null when not established. */
  readonly entrySubmitted: boolean | null
}

/** A new matchweek opened for prediction. */
interface MatchweekOpenedEvent extends NotificationEventBase {
  readonly kind: 'matchweek.opened'
  readonly matchweek: number
  readonly closesAt: string
  readonly fixtureCount: number
}

/* ------------------------------------------------------------------ *
 * Private and global leagues
 * ------------------------------------------------------------------ */

/** The player was invited to a private league. */
interface LeagueInvitationReceivedEvent extends NotificationEventBase {
  readonly kind: 'league.invitation_received'
  readonly leagueId: string
  readonly leagueName: string
  /** Who invited them, or null when the invite carries no attributed sender. */
  readonly invitedByDisplayName: string | null
}

/** The player's rank in a league changed. */
interface LeagueRankChangedEvent extends NotificationEventBase {
  readonly kind: 'league.rank_changed'
  readonly leagueId: string
  readonly leagueName: string
  readonly previousRank: number
  readonly currentRank: number
}

/** Another player moved above this one. */
interface LeagueOvertakenEvent extends NotificationEventBase {
  readonly kind: 'league.overtaken'
  readonly leagueId: string
  readonly leagueName: string
  readonly overtakenByDisplayName: string
  readonly currentRank: number
  /** Points behind the player above, or null when points are provisional. */
  readonly pointsBehind: number | null
}

/** A close rival moved within striking distance, or moved away. */
interface LeagueRivalMovedEvent extends NotificationEventBase {
  readonly kind: 'league.rival_moved'
  readonly leagueId: string
  readonly rivalDisplayName: string
  readonly pointsGap: number
}

/* ------------------------------------------------------------------ *
 * Social and following
 * ------------------------------------------------------------------ */

/** Somebody the player follows did something worth surfacing. */
interface FollowedPlayerActivityEvent extends NotificationEventBase {
  readonly kind: 'social.followed_player_activity'
  readonly actorDisplayName: string
  readonly activity: 'joined_league' | 'submitted_entry' | 'won_matchweek'
}

/** A head-to-head the player is part of moved. */
interface HeadToHeadMovedEvent extends NotificationEventBase {
  readonly kind: 'social.head_to_head_moved'
  readonly opponentDisplayName: string
  readonly standing: 'ahead' | 'behind' | 'level'
  /** Points margin, or null while either side's points are provisional. */
  readonly pointsMargin: number | null
}

/* ------------------------------------------------------------------ *
 * Last Man Standing
 * ------------------------------------------------------------------ */

/** A Last Man Standing round opened for selection. */
interface LmsRoundOpenedEvent extends NotificationEventBase {
  readonly kind: 'lms.round_opened'
  readonly round: number
  readonly closesAt: string
}

/** The player's selection was accepted. */
interface LmsSelectionConfirmedEvent extends NotificationEventBase {
  readonly kind: 'lms.selection_confirmed'
  readonly round: number
  readonly selectionLabel: string
}

/** The player survived a round. Stated by the progression authority. */
interface LmsSurvivedEvent extends NotificationEventBase {
  readonly kind: 'lms.survived'
  readonly round: number
  /** How many entrants remain, or null when the round is not fully settled. */
  readonly survivorsRemaining: number | null
}

/** The player was eliminated. Stated by the progression authority. */
interface LmsEliminatedEvent extends NotificationEventBase {
  readonly kind: 'lms.eliminated'
  readonly round: number
  readonly selectionLabel: string
}

/** The next round is available to enter. */
interface LmsNextRoundAvailableEvent extends NotificationEventBase {
  readonly kind: 'lms.next_round_available'
  readonly round: number
  readonly closesAt: string
}

/* ------------------------------------------------------------------ *
 * Results
 * ------------------------------------------------------------------ */

/** A matchweek was scored for this player. */
interface MatchweekPointsEvent extends NotificationEventBase {
  readonly kind: 'results.matchweek_points'
  readonly matchweek: number
  readonly points: number
  /**
   * Whether those points are settled or still provisional. Carried explicitly
   * because a provisional total presented as final is a wrong answer, not a
   * rounding difference.
   */
  readonly basis: 'awarded' | 'provisional'
}

/** The player predicted an exact score. */
interface ExactScoreEvent extends NotificationEventBase {
  readonly kind: 'results.exact_score'
  readonly matchweek: number
  readonly fixtureLabel: string
}

/** The player's overall competition rank moved after settlement. */
interface ResultsRankMovementEvent extends NotificationEventBase {
  readonly kind: 'results.rank_movement'
  readonly matchweek: number
  readonly previousRank: number
  readonly currentRank: number
}

/** The player reached a competition milestone. */
interface CompetitionMilestoneEvent extends NotificationEventBase {
  readonly kind: 'results.competition_milestone'
  readonly milestone: string
}

/** Every event this application can ask to have delivered. */
export type NotificationEvent =
  | PredictionWindowClosingEvent
  | PredictionEntriesOutstandingEvent
  | PredictionLockedEvent
  | MatchweekOpenedEvent
  | LeagueInvitationReceivedEvent
  | LeagueRankChangedEvent
  | LeagueOvertakenEvent
  | LeagueRivalMovedEvent
  | FollowedPlayerActivityEvent
  | HeadToHeadMovedEvent
  | LmsRoundOpenedEvent
  | LmsSelectionConfirmedEvent
  | LmsSurvivedEvent
  | LmsEliminatedEvent
  | LmsNextRoundAvailableEvent
  | MatchweekPointsEvent
  | ExactScoreEvent
  | ResultsRankMovementEvent
  | CompetitionMilestoneEvent

export type NotificationEventKind = NotificationEvent['kind']

/**
 * Which category each kind belongs to.
 *
 * Written as a total record rather than derived from a prefix, so adding an
 * event kind without classifying it fails to compile instead of silently
 * landing in whichever category the string happens to start with.
 */
export const NOTIFICATION_CATEGORIES: Record<
  NotificationEventKind,
  NotificationCategory
> = {
  'prediction.window_closing': 'predictions',
  'prediction.entries_outstanding': 'predictions',
  'prediction.locked': 'predictions',
  'matchweek.opened': 'predictions',
  'league.invitation_received': 'leagues',
  'league.rank_changed': 'leagues',
  'league.overtaken': 'leagues',
  'league.rival_moved': 'leagues',
  'social.followed_player_activity': 'social',
  'social.head_to_head_moved': 'social',
  'lms.round_opened': 'last-man-standing',
  'lms.selection_confirmed': 'last-man-standing',
  'lms.survived': 'last-man-standing',
  'lms.eliminated': 'last-man-standing',
  'lms.next_round_available': 'last-man-standing',
  'results.matchweek_points': 'results',
  'results.exact_score': 'results',
  'results.rank_movement': 'results',
  'results.competition_milestone': 'results',
}

/** Every known event kind, derived from the classification above. */
export const NOTIFICATION_EVENT_KINDS = Object.keys(
  NOTIFICATION_CATEGORIES,
) as readonly NotificationEventKind[]
