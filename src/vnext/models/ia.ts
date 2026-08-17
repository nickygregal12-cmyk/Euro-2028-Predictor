/**
 * vNext INFORMATION-ARCHITECTURE MODEL — STAGE 7.5.
 *
 * THIS FILE EXISTS TO KEEP THREE THINGS APART. The whole of Stage 7.5 rests on
 * one claim: that a football prediction platform has three independent
 * dimensions which the current product's navigation lets collapse into one
 * flat selector.
 *
 *   A. FOOTBALL CONTEXT — which competition's football am I looking at?
 *   B. GAME            — what am I doing with that football?
 *   C. PEOPLE          — who am I doing it against?
 *
 * They are modelled as three separate types with no field derived from
 * another, for the same reason `features/hub/playerCompetitions.ts` models
 * Follow, Join and Favourite apart: a rule promised in a comment is a rule that
 * lasts until the next refactor. A concept that wants to draw a competition, a
 * game and a private league in one list has to reach into three types to do it,
 * and that friction is the point.
 *
 * IT IS A PRESENTATION MODEL AND NOT A RULE AUTHORITY. Nothing here defines a
 * lock, a score, a settlement, a reveal, an eligibility or a membership. Every
 * status line is a STRING the fixture supplies, never a number this lane
 * computes — `deadlineLabel` is copy, not an instant to compare against a
 * clock, and `remaining` is a count the application would have answered.
 *
 * IT IS DELIBERATELY HONEST ABOUT WHAT THE BACKEND CAN ANSWER. See
 * `PlayerReach` below: the platform's global season leaderboard returns a
 * display name and NO identifier, so a concept that draws a clickable player
 * there would be designing against a read that does not exist. The model makes
 * that unrepresentable rather than leaving it to a reviewer to notice.
 */

/* ==========================================================================
   A. FOOTBALL CONTEXT
   ========================================================================== */

/** How presentation paints a competition. Colours only; never identity. */
export type CompetitionColours = {
  readonly primary: string
  readonly accent: string
  readonly onPrimary: 'light' | 'dark'
}

export type CompetitionRef = {
  readonly id: string
  /** Full name. Long names are expected and must not be truncated. */
  readonly name: string
  /** For dense rows and chips. Never a different competition. */
  readonly shortName: string
  /** Two letters, for a collapsed rail or an avatar-sized mark. */
  readonly monogram: string
  /**
   * The season, as words. Season is part of the football context and not a
   * fourth dimension: a player is in "Premier League · 2026/27", and a cup with
   * no season simply carries `null`.
   */
  readonly seasonLabel: string | null
  readonly colours: CompetitionColours
}

/**
 * WHY THE PLAYER SEES THIS COMPETITION AT ALL.
 *
 * The three are the platform's own three choices, kept apart exactly as
 * `playerCompetitions.ts` keeps them:
 *
 *   `playing`   — joined at least one game here. Server-owned membership.
 *   `following` — asked for the football and joined nothing. A real state.
 *   `browsing`  — neither; reached through discovery. Not "yours".
 *
 * A concept may order by this. It may never collapse `following` into
 * `playing`: a player who follows the Champions League for the fixtures and
 * plays nothing in it is the state the platform was blind to before contract
 * 157, and a navigation lab that loses it would reintroduce the defect.
 */
export type ContextRelationship = 'playing' | 'following' | 'browsing'

/** Whether football is happening in this competition right now. */
export type ContextTempo = 'live' | 'imminent' | 'scheduled' | 'quiet'

export type FootballContext = {
  readonly competition: CompetitionRef
  readonly relationship: ContextRelationship
  /**
   * Presentation prominence only. Never membership, scoring, locks,
   * permissions, ranking or urgency — the platform's own words.
   */
  readonly favourite: boolean
  readonly tempo: ContextTempo
  /** "3 live now", "Locks in 41 min", "Saturday". Copy, never an instant. */
  readonly tempoLabel: string | null
  /** Every game this competition RUNS, offered or not. See `GameOffering`. */
  readonly games: readonly GameOffering[]
  /**
   * A few of this competition's fixtures, ALREADY WRITTEN OUT.
   *
   * Strings rather than a fixture model, deliberately. Stage 7.5 has to show
   * WHERE the Matches system sits in each architecture; it must not start
   * designing it, and a typed fixture list here would invite exactly that. The
   * day and time are pre-rendered by the fixture for the same reason nothing in
   * this lane reads a clock.
   */
  readonly fixtureLines: readonly string[]
  /**
   * Where this sits in "recently viewed", 0 being most recent. `null` means the
   * player has not opened it. Supplied, never derived from a clock.
   */
  readonly recency: number | null
}

/* ==========================================================================
   B. GAME
   ========================================================================== */

/**
 * The three weekly games. `championship` is the Predictor Championship.
 *
 * A GAME IS NOT A COMPETITION AND THIS TYPE IS WHERE THAT IS ENFORCED. There
 * is no `GameRef` carrying colours or a season, because a game drawn with a
 * competition's furniture is a game masquerading as football context — which
 * §7 of the brief names as the failure to avoid.
 */
export type GameKey = 'match-predictor' | 'last-man-standing' | 'championship'

/**
 * What a game is doing for this player in this competition.
 *
 * ONE VARIANT PER GAME, AND THEY ARE NOT INTERCHANGEABLE. Match Predictor's
 * state is a progress fraction against a deadline; Last Man Standing's is a
 * survival state; the Championship's is a table position. A single
 * `{ headline, detail }` shape would let a concept draw all three identically,
 * which is precisely how LMS got treated as "another little tab".
 */
export type GameStatus =
  | {
      readonly kind: 'match-predictor'
      readonly made: number
      readonly of: number
      readonly deadlineLabel: string
      readonly jokerPlayed: boolean
    }
  | {
      readonly kind: 'last-man-standing'
      /** The application's answer. Presentation never infers survival. */
      readonly life: 'alive' | 'eliminated' | 'not-entered'
      /** The club picked for the open round, when there is one. */
      readonly selection: string | null
      readonly deadlineLabel: string | null
      /** How many players are still in. `null` when the read has no figure. */
      readonly remaining: number | null
      /** How many rounds survived so far. */
      readonly roundsSurvived: number | null
    }
  | {
      readonly kind: 'championship'
      readonly position: number
      readonly of: number
      /** "6 points behind the leader". Copy, so the lane computes nothing. */
      readonly gapLabel: string | null
      readonly nextOpponent: string | null
    }

/**
 * WHY A GAME MIGHT NOT BE AVAILABLE, IN THE APPLICATION'S OWN TERMS.
 *
 * `not-offered` is the one the brief asks every concept to prove: a competition
 * that does not run Last Man Standing at all. It is NOT the same as
 * `registration-closed` or as a game the player simply has not joined, and a
 * concept that draws the three the same way is telling a player a game is
 * missing when it is merely unjoined.
 */
export type GameAvailability =
  | 'joined'
  | 'joinable'
  | 'registration-closed'
  | 'not-offered'

export type GameOffering = {
  readonly key: GameKey
  readonly name: string
  readonly availability: GameAvailability
  /** Present only where the player has a state in this game. */
  readonly status: GameStatus | null
  /**
   * How loudly this game is asking for attention. Supplied by the fixture as a
   * decision, never re-derived from a deadline string.
   */
  readonly urgency: 'none' | 'soon' | 'urgent'
}

/* ==========================================================================
   C. PEOPLE
   ========================================================================== */

export type PlayerRef = {
  readonly id: string
  readonly name: string
  readonly initials: string
}

/**
 * WHETHER A NAME ON SCREEN CAN BE OPENED — THE STAGE 7.5 AUDIT FINDING,
 * MODELLED SO A CONCEPT CANNOT DESIGN PAST IT.
 *
 *   `profile`   — the surface holds an identifier AND the server will answer
 *                 for this caller. True of a private-league table: contract 150
 *                 returns `userId` per row and contract 151 admits a
 *                 private-league co-member.
 *
 *   `name-only` — the surface holds a display name and NOTHING ELSE. True of
 *                 the global season leaderboard: `get_season_leaderboard`
 *                 (contract 95) builds each row from `displayName`, `points`,
 *                 `rank`, `matchweeksPlayed`, `tied`, `position` and `isYou`,
 *                 and deliberately omits the user id. There is no identifier to
 *                 link with, so this is not a permission that could be widened
 *                 in the frontend — it is an address that does not exist.
 *
 * A concept must render `name-only` as text. Making it a link would be an
 * invented route, and making it look like a link that refuses is worse.
 */
export type PlayerReach = 'profile' | 'name-only'

export type StandingEntry = {
  readonly player: PlayerRef
  readonly reach: PlayerReach
  readonly position: number
  readonly points: number
  /** "384th of 4,812 · Top 8%" — rank never travels without its field. */
  readonly rankLabel: string
  readonly movement: 'up' | 'down' | 'flat' | null
  readonly isYou: boolean
}

/**
 * A place where people are ranked. The two kinds differ in what they can do,
 * not merely in how they look.
 */
export type PeopleScope =
  | {
      readonly kind: 'global'
      readonly id: string
      readonly title: string
      /** Which football context this table belongs to. */
      readonly contextId: string
      readonly fieldSize: number
      readonly entries: readonly StandingEntry[]
    }
  | {
      readonly kind: 'private-league'
      readonly id: string
      readonly title: string
      readonly contextId: string
      /** A private container always belongs to exactly one game. */
      readonly game: GameKey
      readonly memberCount: number
      readonly entries: readonly StandingEntry[]
    }

/* ==========================================================================
   ATTENTION — the activity dimension, derived by the application
   ========================================================================== */

/**
 * One thing the player could do, across every competition and game.
 *
 * IT NAMES ITS CONTEXT AND ITS GAME SEPARATELY, always. That is what stops an
 * activity-first architecture from becoming a flat list in which "Premier
 * League" and "Last Man Standing" look like the same kind of thing.
 */
export type AttentionItem = {
  readonly id: string
  readonly contextId: string
  readonly game: GameKey
  /** What the player has to do, in a few words. */
  readonly headline: string
  /** Why now. "Locks in 41 minutes", "3 matches live". */
  readonly detail: string
  readonly urgency: 'live' | 'urgent' | 'soon' | 'later' | 'done'
  /** The shape of the decision, so LMS never renders as a progress bar. */
  readonly shape: 'many-decisions' | 'one-decision' | 'watch'
}

/* ==========================================================================
   DISCOVERY
   ========================================================================== */

/**
 * A competition the player could take up. Discovery is deliberately a
 * different type from `FootballContext`: a catalogue entry has no games state,
 * no tempo and no recency, because the player has no relationship with it yet.
 *
 * NO INVENTED TAXONOMY. The platform holds no region, country, competition type
 * or popularity, so this carries none. Discovery is search plus the player's
 * own plus the rest — the authority's own words, and a heading like "European
 * leagues" would be a heading that lies.
 */
export type CatalogueEntry = {
  readonly competition: CompetitionRef
  /** Which games this competition RUNS. Not what the player has joined. */
  readonly offers: readonly GameKey[]
  readonly relationship: ContextRelationship
}

/* ==========================================================================
   THE MODEL
   ========================================================================== */

/**
 * One deterministic world, rendered by all three concepts.
 *
 * THE CONCEPTS SHARE THIS MODEL SO THE COMPARISON IS ABOUT ARCHITECTURE. If
 * each concept brought its own data, a reviewer would be comparing three
 * datasets as much as three ideas, and the one with the friendliest fixture
 * would win.
 */
export type IaModel = {
  readonly scenario: string
  /** One sentence naming what this world is, for the review surface. */
  readonly premise: string
  readonly player: PlayerRef
  /** Every competition the player plays or follows, most relevant first. */
  readonly contexts: readonly FootballContext[]
  /**
   * Which context the product is currently in. `null` is a REAL state — a new
   * account that has followed nothing — and every concept must answer it.
   */
  readonly activeContextId: string | null
  readonly attention: readonly AttentionItem[]
  readonly people: readonly PeopleScope[]
  /** The whole published catalogue, for deliberate discovery only. */
  readonly catalogue: readonly CatalogueEntry[]
}

/* ==========================================================================
   SELECTORS — reading the model, never re-deriving it
   ========================================================================== */

export function contextById(
  model: IaModel,
  id: string | null,
): FootballContext | null {
  if (id === null) return null
  return model.contexts.find((entry) => entry.competition.id === id) ?? null
}

export function activeContext(model: IaModel): FootballContext | null {
  return contextById(model, model.activeContextId)
}

/**
 * The games a concept may offer here, in a stable order.
 *
 * A GAME THE COMPETITION DOES NOT RUN IS NOT RETURNED. It is not disabled, not
 * greyed and not present — the brief's "unsupported game" requirement. Where a
 * concept wants to SAY that a competition has no Last Man Standing, it asks
 * `offeredGames` and finds it absent, then says so in words.
 */
export function offeredGames(context: FootballContext): readonly GameOffering[] {
  return context.games.filter((game) => game.availability !== 'not-offered')
}

/** "Recently viewed", most recent first. Absent recency is never zero. */
export function recentContexts(
  model: IaModel,
  limit: number,
): readonly FootballContext[] {
  return model.contexts
    .filter((entry) => entry.recency !== null)
    .slice()
    .sort((a, b) => (a.recency as number) - (b.recency as number))
    .slice(0, limit)
}

/** Attention items for one context, or all of them when `contextId` is null. */
export function attentionFor(
  model: IaModel,
  contextId: string | null,
): readonly AttentionItem[] {
  if (contextId === null) return model.attention
  return model.attention.filter((item) => item.contextId === contextId)
}

export function peopleFor(
  model: IaModel,
  contextId: string | null,
): readonly PeopleScope[] {
  if (contextId === null) return model.people
  return model.people.filter((scope) => scope.contextId === contextId)
}

/**
 * How many of the player's own competitions there are. A concept uses this to
 * decide whether a switcher is a label, a menu or a search — the single number
 * the whole scalability argument turns on.
 */
export function ownedContextCount(model: IaModel): number {
  return model.contexts.filter((entry) => entry.relationship !== 'browsing').length
}

export const GAME_NAMES: Readonly<Record<GameKey, string>> = {
  'match-predictor': 'Match Predictor',
  'last-man-standing': 'Last Man Standing',
  championship: 'Predictor Championship',
}

/** The short form for a chip or a dense row. Never a different game. */
export const GAME_SHORT_NAMES: Readonly<Record<GameKey, string>> = {
  'match-predictor': 'Predictor',
  'last-man-standing': 'LMS',
  championship: 'Championship',
}
