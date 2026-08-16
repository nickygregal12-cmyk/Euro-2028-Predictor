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
  readonly colours: {
    readonly primary: string
    readonly accent: string
  }
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

export type RecentPerformance = {
  readonly totalPoints: number
  readonly matchweekPoints: number
  /** Points banked today; separate from the matchweek so "today" can be shown. */
  readonly pointsToday: number
  /** Points currently on the pitch — provisional, never awarded. */
  readonly provisionalPoints: number
  readonly rank: number
  readonly rankOutOf: number
  readonly rankMovement: RankMovement
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
  readonly movement: RankMovement
  readonly isUser: boolean
}

export type PrivateLeague = {
  readonly id: string
  readonly name: string
  readonly participantCount: number
  readonly userRank: number
  readonly userPoints: number
  readonly userMovement: RankMovement
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
  readonly movement: RankMovement
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
  readonly recentPerformance: RecentPerformance
  readonly privateLeagues: readonly PrivateLeague[]
  readonly rivals: readonly Rival[]
  readonly activity: readonly ActivityItem[]
}
