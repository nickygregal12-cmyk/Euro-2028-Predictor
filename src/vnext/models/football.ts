/**
 * vNext football presentation model.
 *
 * This describes what the vNext interface wants to DISPLAY. It is deliberately
 * not a mirror of any database table, read model or provider payload, and it is
 * not a rule authority: nothing here defines locks, scoring, settlement, reveal
 * or official results. When the real-data phase begins, existing domain and
 * service boundaries map INTO these types; these types never map back out into
 * game rules.
 *
 * Optionality is honest. A field is nullable here when the product must be able
 * to draw the surface without it — because no backend guarantee for it exists
 * today, or because the state itself legitimately has no value (a match that
 * has not kicked off has no clock).
 */

/** How a club's colours are used by presentation. All values are CSS colours. */
export type TeamColours = {
  readonly primary: string
  readonly secondary: string
  /** A brighter colour for emphasis marks; never used as a large fill. */
  readonly accent: string
  /**
   * Which of the two text colours is legible ON `primary`. Stated by the
   * fixture rather than computed, because a wrong answer here is a contrast
   * failure and presentation should not be guessing at it.
   */
  readonly onPrimary: 'light' | 'dark'
}

/** Shirt treatments the mock identity can express without a crest asset. */
export type TeamKitPattern = 'solid' | 'stripes' | 'hoops' | 'halves'

export type Team = {
  readonly id: string
  /** Full name. Long names are expected and must not break layout. */
  readonly name: string
  /** Name for dense rows and cards. */
  readonly shortName: string
  /** Three-letter code for the tightest contexts (rails, tables, live chips). */
  readonly abbreviation: string
  readonly colours: TeamColours
  readonly kitPattern: TeamKitPattern
  /**
   * Null in the workshop, and null in production until a crest source is
   * agreed. Presentation must always be able to fall back to the abbreviation.
   */
  readonly crestUrl: string | null
}

export type FormResult = 'win' | 'draw' | 'loss'

export type Venue = {
  readonly name: string
  readonly city: string
  readonly capacity: number | null
}

export type Scoreline = {
  readonly home: number
  readonly away: number
}

export type MatchStatus =
  | 'upcoming'
  | 'live'
  | 'halfTime'
  | 'fullTime'
  | 'postponed'

/** Live clock state. Null on any match that is not in play. */
export type MatchClock = {
  readonly minute: number
  readonly addedMinutes: number | null
  /** Pre-rendered label ("67'", "45+2'", "HT") so the UI never invents one. */
  readonly label: string
}

export type HeadToHead = {
  readonly played: number
  readonly homeWins: number
  readonly draws: number
  readonly awayWins: number
  readonly lastMeeting: {
    readonly summary: string
    readonly score: Scoreline
    readonly playedOn: string
  } | null
}

export type MatchSide = {
  readonly team: Team
  /** Most recent first. May be shorter than five for a promoted side. */
  readonly form: readonly FormResult[]
  readonly leaguePosition: number | null
}

export type PredictionStatus =
  | 'notPredicted'
  | 'draft'
  | 'submitted'
  | 'locked'
  | 'settled'

export type PredictionOutcome = 'exact' | 'result' | 'missed'

export type UserPrediction = {
  readonly score: Scoreline
  readonly status: PredictionStatus
  readonly isJoker: boolean
  /** Only known once the match has been settled by the backend. */
  readonly outcome: PredictionOutcome | null
  readonly points: number | null
  /**
   * True while a match is in play: the figure is what the current scoreline
   * WOULD be worth, not an awarded total. Presentation must label it as such.
   */
  readonly pointsAreProvisional: boolean
}

export type ConsensusScore = {
  readonly score: Scoreline
  /** Share of the sampled group, 0–1. */
  readonly share: number
}

export type ConsensusGroup = {
  readonly label: string
  readonly sampleSize: number
  /** Most popular first. */
  readonly popular: readonly ConsensusScore[]
  readonly homeWinShare: number
  readonly drawShare: number
  readonly awayWinShare: number
}

export type MatchConsensus = {
  readonly community: ConsensusGroup
  /** Null when the user has no private league with enough predictions. */
  readonly friends: ConsensusGroup | null
}

export type Match = {
  readonly id: string
  readonly competitionId: string
  /** ISO 8601. Fixtures use fixed instants so the workshop is deterministic. */
  readonly kickoff: string
  readonly status: MatchStatus
  /**
   * WHAT THE PLATFORM SAYS ABOUT THIS FIXTURE'S SLOT (contract 206).
   *
   * A one-line sentence, decided by the mapper and never by a component, for
   * the two cases where the date beside a match does not mean what it looks
   * like: a postponement with no replacement, and a fixture that has been
   * moved. Null on every ordinary fixture, which is almost all of them.
   *
   * It sits beside `status` rather than inside it because the same sentence is
   * needed on a `postponed` card and on an `upcoming` one that was
   * rescheduled, and a status that encoded both would have to grow a case for
   * each.
   *
   * OPTIONAL so a hand-written fixture that predates it still type-checks — an
   * absent note and an explicit null mean the same thing.
   */
  readonly scheduleNote?: string | null
  readonly clock: MatchClock | null
  readonly home: MatchSide
  readonly away: MatchSide
  /** Null before kick-off. */
  readonly score: Scoreline | null
  readonly venue: Venue | null
  readonly headToHead: HeadToHead | null
  readonly broadcast: string | null
  /** Null when the user has not engaged with this match at all. */
  readonly prediction: UserPrediction | null
  /**
   * Null before predictions may be revealed. Reveal is a backend rule; the
   * fixture expresses the shape, not permission to show it early.
   */
  readonly consensus: MatchConsensus | null
  /** ISO 8601 deadline for entering a prediction. Null once passed. */
  readonly lockAt: string | null
  /** A hint that this match deserves the largest treatment on a surface. */
  readonly isFeatured: boolean
}
