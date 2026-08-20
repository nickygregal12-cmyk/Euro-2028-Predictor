/**
 * vNext Home presentation model.
 *
 * Same standing as `football.ts`: this is what Home wants to SHOW, not what the
 * database happens to expose, and nothing here is a game rule. Ranks, points,
 * accuracy and settlement all remain owned by existing backend authorities; the
 * workshop only decides how they would be presented.
 *
 * Social comparison is modelled as a first-class part of the game rather than a
 * secondary card, because the concepts built on top of this must be able to
 * explore prediction as a social contest.
 */

import type { Match } from './football'

export type PlayerRef = {
  readonly id: string
  readonly name: string
  /** Used whenever no avatar image exists, which is the normal case. */
  readonly initials: string
  readonly avatarUrl: string | null
  readonly favouriteTeamId: string | null
}

export type RankMovementDirection = 'up' | 'down' | 'none' | 'new'

export type RankMovement = {
  readonly direction: RankMovementDirection
  /** Always non-negative; the direction carries the sign. */
  readonly places: number
}

export type HomeUser = PlayerRef

export type CompetitionContext = {
  readonly id: string
  readonly name: string
  readonly shortName: string
  readonly seasonLabel: string
  /** "Matchweek 4", "Group stage", "Quarter-final" — competition-shaped. */
  readonly stageLabel: string
  readonly matchweekLabel: string
  readonly matchweekNumber: number | null
  /**
   * Null when nothing supplies a competition palette.
   *
   * NULLABLE BECAUSE REAL INTEGRATION PROVED IT. The workshop fixtures gave
   * every competition two colours, so the field looked mandatory. No
   * application source holds one: club colours come from
   * `predictor_internal.club_identity_reference`, and there is no equivalent for
   * a competition. `VNextShell` already accepted `null` here and falls back to
   * its own atmosphere, so the honest answer costs the design nothing.
   */
  readonly colours: {
    readonly primary: string
    readonly accent: string
  } | null
}

export type PrimaryActionType = 'predict' | 'review' | 'watchLive' | 'joinLeague'

/** How close the deadline is, decided by the fixture rather than by the clock. */
export type PrimaryActionUrgency = 'calm' | 'soon' | 'urgent'

export type PrimaryAction = {
  readonly type: PrimaryActionType
  readonly title: string
  readonly description: string
  /** ISO 8601, or null for an action with no deadline. */
  readonly deadline: string | null
  readonly progress: {
    readonly completed: number
    readonly total: number
  } | null
  /**
   * A placeholder, not a route. vNext has no router of its own and must not
   * add one; the concept PRs decide what this becomes at integration.
   */
  readonly routePlaceholder: string
  readonly urgency: PrimaryActionUrgency
}

export type PredictionAccuracy = {
  readonly predicted: number
  readonly exact: number
  readonly resultOnly: number
  readonly missed: number
}

/**
 * How the user's season is going.
 *
 * FIVE FIELDS BECAME NULLABLE WHEN REAL DATA ARRIVED, and each null is a
 * different missing capability rather than a shared "no data" flag — a surface
 * that omits a rank for a new player and one that omits it because no read
 * supplies movement are omitting different things, and collapsing them would
 * make the page unable to say which.
 *
 * `null` here always means NOT KNOWN. It never means zero: "0 points on the
 * pitch" and "we cannot tell you what is on the pitch" are different sentences,
 * and printing the first when the second is true is the exact class of confident
 * falsehood this model exists to prevent.
 */
export type RecentPerformance = {
  readonly totalPoints: number
  readonly matchweekPoints: number
  /**
   * Points banked today; separate from the matchweek so "today" can be shown.
   * Null where no read attributes banked points to a day.
   */
  readonly pointsToday: number | null
  /**
   * Points currently on the pitch — provisional, never awarded. Null where no
   * authority states an on-the-pitch figure, which is not the same as zero.
   */
  readonly provisionalPoints: number | null
  /** Null before the user has a banked standing — a new player has no rank. */
  readonly rank: number | null
  /** Null whenever `rank` is: a rank out of nothing is not a field size. */
  readonly rankOutOf: number | null
  /** Null where no read states how the user's own rank moved. */
  readonly rankMovement: RankMovement | null
  readonly accuracy: PredictionAccuracy
  /** Oldest first. Enough points for a sparkline, no more. */
  readonly matchweekHistory: readonly {
    readonly matchweek: number
    readonly points: number
  }[]
}

export type PrivateLeagueStanding = {
  readonly player: PlayerRef
  readonly rank: number
  readonly points: number
  /**
   * Null where nothing states how this member moved.
   *
   * NOT `{ direction: 'none' }`, which is a claim: it says the member held a
   * position and kept it. Movement is only known over a SETTLED matchweek, so an
   * unsettled one, an unread movement table and a member who was not in the
   * previous table all legitimately have nothing to say.
   */
  readonly movement: RankMovement | null
  readonly isUser: boolean
}

export type PrivateLeague = {
  readonly id: string
  readonly name: string
  readonly participantCount: number
  readonly userRank: number
  readonly userPoints: number
  /** Null where nothing states how the user moved in this league. */
  readonly userMovement: RankMovement | null
  /** Points behind the leader; 0 when the user leads. */
  readonly gapToLeader: number
  readonly leaderName: string
  /** A window around the user, not the whole table. */
  readonly standings: readonly PrivateLeagueStanding[]
}

export type RivalRelation =
  | 'leagueLeader'
  | 'closestAbove'
  | 'closestBelow'
  | 'friend'

export type Rival = {
  readonly player: PlayerRef
  readonly relation: RivalRelation
  readonly rank: number
  readonly points: number
  /** Null where nothing states how this rival moved. */
  readonly movement: RankMovement | null
  /** Signed: positive means this rival is ahead of the user. */
  readonly pointsDifference: number
  readonly sharedLeagueName: string
  /** Short human line: "2 points to catch Jamie". Null when there is nothing to say. */
  readonly headline: string | null
}

export type ActivityKind =
  | 'predictionSettled'
  | 'rankChange'
  | 'rivalMove'
  | 'liveEvent'
  | 'leagueInvite'
  | 'deadline'

export type ActivityItem = {
  readonly id: string
  readonly kind: ActivityKind
  readonly headline: string
  readonly detail: string | null
  readonly occurredAt: string
  readonly relatedMatchId: string | null
  readonly relatedPlayerId: string | null
  /**
   * Tone for presentation. It exists so tone is never inferred from a points
   * value, and it is always paired with text — never colour alone.
   */
  readonly emphasis: 'positive' | 'negative' | 'neutral'
}

/**
 * WHAT FINISHED WHILE THE PLAYER WAS AWAY.
 *
 * ============================ IT IS A SELECTION, NOT A CLAIM =============
 *
 * Every match here is already in `recentResults` and is settled because the
 * server settled it. This zone says only WHICH of them are new to this reader,
 * and it is the one thing on Home that depends on a device rather than on the
 * application: the marker is local, so a player who read the results on their
 * phone still sees them on their laptop. That cost is deliberate and small —
 * nothing here can be wrong in a way that changes a point, a lock or a rank.
 *
 * ============================ NULL ON A FIRST VISIT ======================
 *
 * With no marker there is no "since", and a summary of the whole season dressed
 * as "what changed" would be the worst possible first impression of the
 * feature. `null` is also the answer when the marker exists and nothing has
 * finished since it, which is the ordinary case on a Tuesday.
 */
export type SinceLastVisit = {
  /** Settled matches that finished since the marker, most recent first. */
  readonly results: readonly Match[]
  /** How many more there were beyond the cap. */
  readonly more: number
}

export type HomeModel = {
  /** The instant the model describes. Components take "now" as an input so the
   *  workshop renders identically on every run. */
  readonly generatedAt: string
  readonly user: HomeUser
  readonly competition: CompetitionContext
  readonly primaryAction: PrimaryAction
  readonly liveMatches: readonly Match[]
  readonly upcomingMatches: readonly Match[]
  /** Settled matches worth showing back to the user today. */
  readonly recentResults: readonly Match[]
  /**
   * Which of those are new to this reader. Null on a first visit and whenever
   * nothing has finished since the marker — see `SinceLastVisit`.
   *
   * OPTIONAL so a hand-written fixture that predates it still type-checks; an
   * absent field and an explicit null mean the same thing.
   */
  readonly sinceLastVisit?: SinceLastVisit | null
  readonly recentPerformance: RecentPerformance
  readonly privateLeagues: readonly PrivateLeague[]
  readonly rivals: readonly Rival[]
  readonly activity: readonly ActivityItem[]
}
