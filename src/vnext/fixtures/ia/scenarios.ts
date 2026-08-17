import type {
  CatalogueEntry,
  ContextRelationship,
  ContextTempo,
  FootballContext,
  GameAvailability,
  GameKey,
  GameOffering,
  GameStatus,
  IaModel,
  PeopleScope,
  PlayerRef,
  StandingEntry,
} from '../../models/ia'
import { GAME_NAMES } from '../../models/ia'
import { iaCompetition, iaCompetitions, iaOffers } from './competitions'
import { iaPeople } from './people'

/**
 * TWELVE DETERMINISTIC WORLDS, AND ALL THREE CONCEPTS RENDER EVERY ONE.
 *
 * WHY ONE DATASET AND NOT THREE. Stage 7.5 is a selection stage, and a
 * reviewer comparing three concepts each with its own fixture would be
 * comparing datasets as much as architectures — the concept with the kindest
 * data would win. Every scenario below is therefore handed to Concept A, B and
 * C unchanged, and the only thing that differs between the three screens is how
 * the architecture chooses to express it.
 *
 * NOTHING HERE READS A CLOCK. Every deadline is a STRING the fixture supplies
 * and every urgency is a decision the fixture states, exactly as
 * `fixtures/predictor/` does. A navigation concept that had to compute "41
 * minutes" would be re-deriving a decision the application already makes, which
 * is the rule `src/vnext/AGENTS.md` states for `urgency`.
 *
 * NOTHING HERE INVENTS A PERMISSION. Every `reach` value is the audited answer:
 * a private-league row is `profile` because contract 150 returns `userId` and
 * contract 151 admits a co-member; a global leaderboard row is `name-only`
 * because `get_season_leaderboard` returns no identifier at all. The scenarios
 * are where that finding becomes visible to a reviewer rather than staying in a
 * document.
 *
 * THE SCENARIO SET COVERS THE FIFTEEN SITUATIONS THE BRIEF NAMES, and several
 * scenarios answer more than one: `regular` carries a private league, a global
 * leaderboard and a rival worth opening, so the social journeys are reviewable
 * without a scenario each.
 */

/* ==========================================================================
   builders
   ========================================================================== */

type GameSeed = {
  readonly key: GameKey
  readonly availability: GameAvailability
  readonly status?: GameStatus
  readonly urgency?: 'none' | 'soon' | 'urgent'
}

/**
 * Every game the competition runs, plus every game it does not.
 *
 * A COMPETITION'S FULL GAME LIST INCLUDES THE ONES IT REFUSES. `not-offered`
 * has to be representable, because "this league has no Last Man Standing" and
 * "you have not joined the Last Man Standing this league runs" are different
 * sentences and a concept that cannot tell them apart will print the wrong one.
 * The catalogue decides which is which; a seed may not claim a game the
 * competition does not run.
 */
function gamesFor(
  competitionId: string,
  seeds: readonly GameSeed[],
): readonly GameOffering[] {
  const offered = iaOffers(competitionId)
  const byKey = new Map(seeds.map((seed) => [seed.key, seed]))

  return (['match-predictor', 'last-man-standing', 'championship'] as const).map(
    (key): GameOffering => {
      if (!offered.includes(key)) {
        return {
          key,
          name: GAME_NAMES[key],
          availability: 'not-offered',
          status: null,
          urgency: 'none',
        }
      }
      const seed = byKey.get(key)
      return {
        key,
        name: GAME_NAMES[key],
        availability: seed?.availability ?? 'joinable',
        status: seed?.status ?? null,
        urgency: seed?.urgency ?? 'none',
      }
    },
  )
}

type ContextSeed = {
  readonly id: string
  readonly relationship: ContextRelationship
  readonly favourite?: boolean
  readonly tempo: ContextTempo
  readonly tempoLabel?: string | null
  readonly recency?: number | null
  readonly games?: readonly GameSeed[]
  readonly fixtures?: readonly string[]
}

/**
 * A short, plausible fixture list for a competition that has none of its own.
 *
 * DELIBERATELY THE SAME FICTIONAL CLUBS EVERY TIME. Stage 7.5 is not designing
 * the Matches system, so what these rows SAY matters only as far as proving
 * that an architecture can put football somewhere sensible. Inventing twenty
 * competitions' worth of distinct fixtures would be twenty competitions' worth
 * of data nobody reviews.
 */
const DEFAULT_FIXTURES: readonly string[] = [
  'Sat 11:30 · Glenmore Athletic v Strathkelvin United',
  'Sat 14:00 · Carrickvale Rovers v Porthaven City',
  'Sun 13:30 · Strathallan Caledonian Thistle v Tarbeth Moor Academical',
]

function contextOf(seed: ContextSeed): FootballContext {
  return {
    competition: iaCompetition(seed.id),
    relationship: seed.relationship,
    favourite: seed.favourite ?? false,
    tempo: seed.tempo,
    tempoLabel: seed.tempoLabel ?? null,
    games: gamesFor(seed.id, seed.games ?? []),
    fixtureLines: seed.fixtures ?? DEFAULT_FIXTURES,
    recency: seed.recency ?? null,
  }
}

function predictorStatus(
  made: number,
  of: number,
  deadlineLabel: string,
  jokerPlayed = false,
): GameStatus {
  return { kind: 'match-predictor', made, of, deadlineLabel, jokerPlayed }
}

function lmsStatus(
  life: 'alive' | 'eliminated' | 'not-entered',
  selection: string | null,
  deadlineLabel: string | null,
  remaining: number | null,
  roundsSurvived: number | null,
): GameStatus {
  return {
    kind: 'last-man-standing',
    life,
    selection,
    deadlineLabel,
    remaining,
    roundsSurvived,
  }
}

function championshipStatus(
  position: number,
  of: number,
  gapLabel: string | null,
  nextOpponent: string | null,
): GameStatus {
  return { kind: 'championship', position, of, gapLabel, nextOpponent }
}

/**
 * The whole published catalogue, marked with the player's relationship to each.
 *
 * DISCOVERY IS THE WHOLE LIST, ALWAYS. A catalogue that showed only what the
 * player does not have would make "is the Premier League on this platform?"
 * unanswerable from the one surface built to answer it.
 */
function catalogueWith(
  contexts: readonly FootballContext[],
): readonly CatalogueEntry[] {
  const owned = new Map(
    contexts.map((entry) => [entry.competition.id, entry.relationship]),
  )
  return iaCompetitions.map((competition) => ({
    competition,
    offers: iaOffers(competition.id),
    relationship: owned.get(competition.id) ?? 'browsing',
  }))
}

type StandingSeed = {
  readonly player: PlayerRef
  readonly position: number
  readonly points: number
  readonly movement?: 'up' | 'down' | 'flat' | null
  readonly isYou?: boolean
}

/**
 * A private-league table. Every row is reachable.
 *
 * `reach: 'profile'` FOR EVERY ROW, and it is not a shortcut: contract 150's
 * private-league standings carry `userId` per row, and contract 151 admits any
 * caller who shares a private league with the player. Both halves are present,
 * so the link is real.
 */
function privateLeague(
  id: string,
  title: string,
  contextId: string,
  game: GameKey,
  memberCount: number,
  seeds: readonly StandingSeed[],
): PeopleScope {
  return {
    kind: 'private-league',
    id,
    title,
    contextId,
    game,
    memberCount,
    entries: seeds.map(
      (seed): StandingEntry => ({
        player: seed.player,
        reach: 'profile',
        position: seed.position,
        points: seed.points,
        rankLabel: `${ordinal(seed.position)} of ${memberCount}`,
        movement: seed.movement ?? null,
        isYou: seed.isYou ?? false,
      }),
    ),
  }
}

/**
 * The global season leaderboard. NO row is reachable, including the player's own.
 *
 * THIS IS THE STAGE 7.5 FINDING, EXPRESSED AS DATA. `get_season_leaderboard`
 * (contract 95) builds each row from `displayName`, `points`, `rank`,
 * `matchweeksPlayed`, `tied`, `position` and `isYou` — there is no user id in
 * the payload and none in `SeasonLeaderboardRow`. So a global row is
 * `name-only` not because a permission refuses it but because there is no
 * address to link to, and a concept that drew a link here would be inventing a
 * route. The player's own row is `name-only` for the same mechanical reason,
 * even though the player may always read their own profile.
 */
function globalTable(
  id: string,
  title: string,
  contextId: string,
  fieldSize: number,
  seeds: readonly StandingSeed[],
): PeopleScope {
  return {
    kind: 'global',
    id,
    title,
    contextId,
    fieldSize,
    entries: seeds.map(
      (seed): StandingEntry => ({
        player: seed.player,
        reach: 'name-only',
        position: seed.position,
        points: seed.points,
        rankLabel: `${ordinal(seed.position)} of ${fieldSize.toLocaleString('en-GB')}`,
        movement: seed.movement ?? null,
        isYou: seed.isYou ?? false,
      }),
    ),
  }
}

/** "1st", "2nd", "384th". Presentation only; the rank itself is the server's. */
function ordinal(value: number): string {
  const tens = value % 100
  if (tens >= 11 && tens <= 13) return `${value}th`
  switch (value % 10) {
    case 1:
      return `${value}st`
    case 2:
      return `${value}nd`
    case 3:
      return `${value}rd`
    default:
      return `${value}th`
  }
}

/* ==========================================================================
   the shared cast of standings
   ========================================================================== */

const SUNDAY_CLUB: readonly StandingSeed[] = [
  { player: iaPeople.jamie, position: 1, points: 214, movement: 'flat' },
  { player: iaPeople.user, position: 2, points: 209, movement: 'up', isYou: true },
  { player: iaPeople.aisha, position: 3, points: 201, movement: 'down' },
  { player: iaPeople.soren, position: 4, points: 188, movement: 'up' },
  { player: iaPeople.bea, position: 5, points: 174, movement: 'flat' },
]

const GLOBAL_EPL: readonly StandingSeed[] = [
  { player: iaPeople.priya, position: 1, points: 268 },
  { player: iaPeople.callum, position: 2, points: 264 },
  { player: iaPeople.dee, position: 3, points: 259 },
  { player: iaPeople.martin, position: 4, points: 257 },
  { player: iaPeople.user, position: 384, points: 209, isYou: true },
]

/* ==========================================================================
   1 — the EPL-only player
   ========================================================================== */

const singleContexts: readonly FootballContext[] = [
  contextOf({
    id: 'premier-league',
    relationship: 'playing',
    favourite: true,
    tempo: 'scheduled',
    tempoLabel: 'Matchweek 12 · Saturday',
    recency: 0,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(8, 10, 'Locks Saturday 11:30'),
        urgency: 'soon',
      },
      {
        key: 'last-man-standing',
        availability: 'joined',
        status: lmsStatus('alive', 'Not picked yet', 'Locks Saturday 11:30', 83, 11),
        urgency: 'soon',
      },
      {
        key: 'championship',
        availability: 'joined',
        status: championshipStatus(4, 18, '6 points behind the leader', 'Martin Okafor'),
      },
    ],
  }),
]

/**
 * A PLAYER WHO ONLY PLAYS ONE COMPETITION MUST EXPERIENCE A ONE-COMPETITION
 * PRODUCT. This is the scenario that decides whether an architecture makes the
 * platform feel personally small: whatever a concept does with twenty
 * competitions, here it must not spend a control, a row or a word on choosing
 * between competitions there is only one of.
 */
const singleCompetitionModel: IaModel = {
  scenario: 'One competition',
  premise:
    'Plays the Premier League and nothing else. The product should feel like a Premier League prediction game.',
  player: iaPeople.user,
  contexts: singleContexts,
  activeContextId: 'premier-league',
  attention: [
    {
      id: 'a-epl-predictor',
      contextId: 'premier-league',
      game: 'match-predictor',
      headline: '2 predictions left',
      detail: 'Matchweek 12 locks Saturday 11:30',
      urgency: 'soon',
      shape: 'many-decisions',
    },
    {
      id: 'a-epl-lms',
      contextId: 'premier-league',
      game: 'last-man-standing',
      headline: 'Pick a club to survive round 12',
      detail: '83 still in · locks Saturday 11:30',
      urgency: 'soon',
      shape: 'one-decision',
    },
  ],
  people: [
    privateLeague('l-sunday', 'The Sunday Club', 'premier-league', 'match-predictor', 18, SUNDAY_CLUB),
    globalTable('g-epl', 'Premier League standings', 'premier-league', 4812, GLOBAL_EPL),
  ],
  catalogue: catalogueWith(singleContexts),
}

/* ==========================================================================
   2 — the multi-league regular (the brief's worked example)
   ========================================================================== */

const regularContexts: readonly FootballContext[] = [
  contextOf({
    id: 'premier-league',
    relationship: 'playing',
    favourite: true,
    tempo: 'imminent',
    tempoLabel: 'Locks in 41 min',
    recency: 0,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(8, 10, 'Locks in 41 min'),
        urgency: 'urgent',
      },
      {
        key: 'last-man-standing',
        availability: 'joined',
        status: lmsStatus('alive', 'Glenmore Athletic', 'Locks in 41 min', 83, 11),
        urgency: 'none',
      },
      {
        key: 'championship',
        availability: 'joined',
        status: championshipStatus(4, 18, '6 points behind the leader', 'Martin Okafor'),
      },
    ],
  }),
  contextOf({
    id: 'scottish-premiership',
    relationship: 'playing',
    tempo: 'scheduled',
    tempoLabel: 'Matchweek 14 · Sunday',
    recency: 1,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(0, 6, 'Locks Sunday 13:30'),
        urgency: 'soon',
      },
      { key: 'last-man-standing', availability: 'joinable' },
      {
        key: 'championship',
        availability: 'joined',
        status: championshipStatus(11, 12, 'Bottom of the group', 'Bea'),
      },
    ],
  }),
  contextOf({
    id: 'champions-league',
    relationship: 'playing',
    tempo: 'live',
    tempoLabel: '3 matches live',
    recency: 2,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(8, 8, 'Locked · 3 live', true),
      },
      {
        key: 'last-man-standing',
        availability: 'joined',
        status: lmsStatus('eliminated', 'Carrickvale Rovers', null, 14, 5),
      },
    ],
  }),
  contextOf({
    id: 'euro-2028',
    relationship: 'following',
    tempo: 'quiet',
    tempoLabel: 'Qualifying resumes in March',
    recency: 3,
    games: [{ key: 'match-predictor', availability: 'joinable' }],
  }),
]

const multiCompetitionModel: IaModel = {
  scenario: 'Four competitions',
  premise:
    'Plays three competitions and follows a fourth. One is live, one is 41 minutes from locking, one is quiet.',
  player: iaPeople.user,
  contexts: regularContexts,
  activeContextId: 'premier-league',
  attention: [
    {
      id: 'b-epl-predictor',
      contextId: 'premier-league',
      game: 'match-predictor',
      headline: '2 predictions left',
      detail: 'Locks in 41 minutes',
      urgency: 'urgent',
      shape: 'many-decisions',
    },
    {
      id: 'b-ucl-live',
      contextId: 'champions-league',
      game: 'match-predictor',
      headline: '3 of your matches are live',
      detail: 'Joker played · 8 of 8 predicted',
      urgency: 'live',
      shape: 'watch',
    },
    {
      id: 'b-sp-predictor',
      contextId: 'scottish-premiership',
      game: 'match-predictor',
      headline: 'Matchweek 14 is open',
      detail: 'Nothing predicted yet · locks Sunday 13:30',
      urgency: 'soon',
      shape: 'many-decisions',
    },
    {
      id: 'b-sp-championship',
      contextId: 'scottish-premiership',
      game: 'championship',
      headline: 'Bea beat you 3–1',
      detail: 'Bottom of the group with two to play',
      urgency: 'later',
      shape: 'watch',
    },
    {
      id: 'b-epl-lms',
      contextId: 'premier-league',
      game: 'last-man-standing',
      headline: 'Glenmore Athletic locked in',
      detail: '83 still in · round 12',
      urgency: 'done',
      shape: 'one-decision',
    },
  ],
  people: [
    privateLeague('l-sunday', 'The Sunday Club', 'premier-league', 'match-predictor', 18, SUNDAY_CLUB),
    privateLeague('l-office', 'Office Survivors', 'premier-league', 'last-man-standing', 24, [
      { player: iaPeople.user, position: 1, points: 11, movement: 'flat', isYou: true },
      { player: iaPeople.martin, position: 1, points: 11, movement: 'flat' },
      { player: iaPeople.priya, position: 3, points: 9, movement: 'down' },
    ]),
    privateLeague('l-tartan', 'Tartan Army', 'scottish-premiership', 'match-predictor', 9, [
      { player: iaPeople.soren, position: 1, points: 142, movement: 'up' },
      { player: iaPeople.user, position: 5, points: 118, movement: 'down', isYou: true },
      { player: iaPeople.bea, position: 6, points: 117, movement: 'up' },
    ]),
    globalTable('g-epl', 'Premier League standings', 'premier-league', 4812, GLOBAL_EPL),
    globalTable('g-ucl', 'Champions League standings', 'champions-league', 1907, [
      { player: iaPeople.marguerite, position: 1, points: 96 },
      { player: iaPeople.jamie, position: 2, points: 94 },
      { player: iaPeople.user, position: 212, points: 61, isYou: true },
    ]),
  ],
  catalogue: catalogueWith(regularContexts),
}

/* ==========================================================================
   3 — the power user, eleven competitions
   ========================================================================== */

const POWER_IDS: readonly string[] = [
  'premier-league',
  'scottish-premiership',
  'champions-league',
  'la-liga',
  'serie-a',
  'bundesliga',
  'ligue-1',
  'europa-league',
  'fa-cup',
  'wsl',
  'euro-2028',
]

const powerContexts: readonly FootballContext[] = POWER_IDS.map((id, index) =>
  contextOf({
    id,
    // Two of the eleven are followed rather than played, so the list is not
    // uniformly "everything you play" — the state that was invisible before
    // contract 157 has to survive at scale as well as at four.
    relationship: index >= 9 ? 'following' : 'playing',
    favourite: id === 'premier-league',
    tempo: index === 0 ? 'imminent' : index < 3 ? 'live' : index < 6 ? 'scheduled' : 'quiet',
    tempoLabel:
      index === 0
        ? 'Locks in 41 min'
        : index < 3
          ? `${index + 1} matches live`
          : index < 6
            ? 'Saturday'
            : null,
    recency: index,
    games:
      index >= 9
        ? []
        : [
            {
              key: 'match-predictor',
              availability: 'joined',
              status: predictorStatus(
                index === 0 ? 8 : 10,
                10,
                index === 0 ? 'Locks in 41 min' : 'Locks Saturday 11:30',
              ),
              urgency: index === 0 ? 'urgent' : 'none',
            },
            {
              key: 'last-man-standing',
              availability: index % 3 === 0 ? 'joined' : 'joinable',
              ...(index % 3 === 0
                ? {
                    status: lmsStatus(
                      index === 0 ? 'alive' : 'eliminated',
                      index === 0 ? 'Glenmore Athletic' : 'Strathkelvin United',
                      index === 0 ? 'Locks in 41 min' : null,
                      index === 0 ? 83 : 4,
                      index === 0 ? 11 : 2,
                    ),
                  }
                : {}),
            },
            { key: 'championship', availability: 'joined' },
          ],
  }),
)

const powerUserModel: IaModel = {
  scenario: 'Eleven competitions',
  premise:
    'Plays nine competitions and follows two more. Nothing may become a wall of logos.',
  player: iaPeople.user,
  contexts: powerContexts,
  activeContextId: 'premier-league',
  attention: [
    {
      id: 'c-epl',
      contextId: 'premier-league',
      game: 'match-predictor',
      headline: '2 predictions left',
      detail: 'Locks in 41 minutes',
      urgency: 'urgent',
      shape: 'many-decisions',
    },
    {
      id: 'c-epl-lms',
      contextId: 'premier-league',
      game: 'last-man-standing',
      headline: 'Glenmore Athletic locked in',
      detail: '83 still in · round 12',
      urgency: 'done',
      shape: 'one-decision',
    },
    {
      id: 'c-ucl',
      contextId: 'champions-league',
      game: 'match-predictor',
      headline: '3 of your matches are live',
      detail: 'All predicted',
      urgency: 'live',
      shape: 'watch',
    },
    {
      id: 'c-seriea',
      contextId: 'serie-a',
      game: 'match-predictor',
      headline: '2 of your matches are live',
      detail: 'All predicted',
      urgency: 'live',
      shape: 'watch',
    },
    {
      id: 'c-laliga',
      contextId: 'la-liga',
      game: 'championship',
      headline: 'Group fixture on Sunday',
      detail: 'You play Aisha Rahman',
      urgency: 'later',
      shape: 'watch',
    },
  ],
  people: [
    privateLeague('l-sunday', 'The Sunday Club', 'premier-league', 'match-predictor', 18, SUNDAY_CLUB),
    globalTable('g-epl', 'Premier League standings', 'premier-league', 4812, GLOBAL_EPL),
  ],
  catalogue: catalogueWith(powerContexts),
}

/* ==========================================================================
   4 — twenty published, relevant to three
   ========================================================================== */

/** Deliberately not the first three: a bounded list that sliced the top would pass wrongly. */
const CATALOGUE_PLAYS: readonly string[] = ['la-liga', 'wsl', 'scottish-cup']

const catalogueContexts: readonly FootballContext[] = CATALOGUE_PLAYS.map((id, index) =>
  contextOf({
    id,
    relationship: index === 2 ? 'following' : 'playing',
    tempo: index === 0 ? 'imminent' : 'quiet',
    tempoLabel: index === 0 ? 'Locks in 2 hours' : null,
    recency: index,
    games:
      index === 2
        ? []
        : [
            {
              key: 'match-predictor',
              availability: 'joined',
              status: predictorStatus(index === 0 ? 4 : 10, 10, 'Locks in 2 hours'),
              urgency: index === 0 ? 'urgent' : 'none',
            },
            { key: 'last-man-standing', availability: 'joinable' },
            { key: 'championship', availability: 'joinable' },
          ],
  }),
)

const twentyCompetitionModel: IaModel = {
  scenario: 'Twenty published competitions',
  premise:
    'The platform publishes twenty competitions; this player is relevant to three of them, none in the first three catalogue rows.',
  player: iaPeople.user,
  contexts: catalogueContexts,
  activeContextId: 'la-liga',
  attention: [
    {
      id: 'd-laliga',
      contextId: 'la-liga',
      game: 'match-predictor',
      headline: '6 predictions left',
      detail: 'Locks in 2 hours',
      urgency: 'urgent',
      shape: 'many-decisions',
    },
  ],
  people: [
    privateLeague('l-liga', 'Sobremesa', 'la-liga', 'match-predictor', 7, [
      { player: iaPeople.user, position: 3, points: 88, movement: 'up', isYou: true },
      { player: iaPeople.dee, position: 1, points: 101, movement: 'flat' },
      { player: iaPeople.marguerite, position: 2, points: 94, movement: 'down' },
    ]),
  ],
  catalogue: catalogueWith(catalogueContexts),
}

/* ==========================================================================
   5 — matchday, football live everywhere
   ========================================================================== */

const matchdayContexts: readonly FootballContext[] = [
  contextOf({
    id: 'premier-league',
    relationship: 'playing',
    favourite: true,
    tempo: 'live',
    tempoLabel: '5 matches live',
    recency: 0,
    fixtures: [
      "LIVE 67' · Glenmore Athletic 1–0 Strathkelvin United",
      "LIVE 63' · Carrickvale Rovers 2–2 Porthaven City",
      'HT · Strathallan Caledonian Thistle 0–1 Tarbeth Moor Academical',
    ],
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(10, 10, 'Locked · 5 live', true),
      },
      {
        key: 'last-man-standing',
        availability: 'joined',
        status: lmsStatus('alive', 'Glenmore Athletic', null, 83, 11),
      },
      {
        key: 'championship',
        availability: 'joined',
        status: championshipStatus(4, 18, 'Playing Martin Okafor now', 'Martin Okafor'),
      },
    ],
  }),
  contextOf({
    id: 'scottish-premiership',
    relationship: 'playing',
    tempo: 'live',
    tempoLabel: '2 matches live',
    recency: 1,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(6, 6, 'Locked · 2 live'),
      },
      { key: 'last-man-standing', availability: 'joinable' },
      { key: 'championship', availability: 'joinable' },
    ],
  }),
  contextOf({
    id: 'champions-league',
    relationship: 'following',
    tempo: 'quiet',
    tempoLabel: 'Back on Tuesday',
    recency: 2,
  }),
]

const matchdayModel: IaModel = {
  scenario: 'Matchday',
  premise: 'Seven matches live across two competitions. Everything is predicted and locked.',
  player: iaPeople.user,
  contexts: matchdayContexts,
  activeContextId: 'premier-league',
  attention: [
    {
      id: 'e-epl-live',
      contextId: 'premier-league',
      game: 'match-predictor',
      headline: '5 of your matches are live',
      detail: 'Joker played on Glenmore Athletic v Strathkelvin United',
      urgency: 'live',
      shape: 'watch',
    },
    {
      id: 'e-epl-lms',
      contextId: 'premier-league',
      game: 'last-man-standing',
      headline: 'Glenmore Athletic are 1–0 up',
      detail: 'Survive and 83 becomes 61',
      urgency: 'live',
      shape: 'watch',
    },
    {
      id: 'e-sp-live',
      contextId: 'scottish-premiership',
      game: 'match-predictor',
      headline: '2 of your matches are live',
      detail: 'All predicted',
      urgency: 'live',
      shape: 'watch',
    },
    {
      id: 'e-epl-champ',
      contextId: 'premier-league',
      game: 'championship',
      headline: 'You are beating Martin Okafor',
      detail: '14 points to 9 with two matches to finish',
      urgency: 'live',
      shape: 'watch',
    },
  ],
  people: [
    privateLeague('l-sunday', 'The Sunday Club', 'premier-league', 'match-predictor', 18, SUNDAY_CLUB),
    globalTable('g-epl', 'Premier League standings', 'premier-league', 4812, GLOBAL_EPL),
  ],
  catalogue: catalogueWith(matchdayContexts),
}

/* ==========================================================================
   6 — the deadline
   ========================================================================== */

const deadlineContexts: readonly FootballContext[] = [
  contextOf({
    id: 'premier-league',
    relationship: 'playing',
    favourite: true,
    tempo: 'imminent',
    tempoLabel: 'Locks in 9 min',
    recency: 0,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(7, 10, 'Locks in 9 min'),
        urgency: 'urgent',
      },
      {
        key: 'last-man-standing',
        availability: 'joined',
        status: lmsStatus('alive', null, 'Locks in 9 min', 83, 11),
        urgency: 'urgent',
      },
      {
        key: 'championship',
        availability: 'joined',
        status: championshipStatus(4, 18, '6 points behind the leader', 'Martin Okafor'),
      },
    ],
  }),
  contextOf({
    id: 'scottish-premiership',
    relationship: 'playing',
    tempo: 'quiet',
    tempoLabel: 'Sunday',
    recency: 1,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(6, 6, 'Locks Sunday 13:30'),
      },
      { key: 'last-man-standing', availability: 'joinable' },
      { key: 'championship', availability: 'joinable' },
    ],
  }),
]

const deadlineModel: IaModel = {
  scenario: 'Deadline',
  premise:
    'Nine minutes to lock, three scorelines missing and an unmade Last Man Standing pick in the same competition.',
  player: iaPeople.user,
  contexts: deadlineContexts,
  activeContextId: 'premier-league',
  attention: [
    {
      id: 'f-lms',
      contextId: 'premier-league',
      game: 'last-man-standing',
      headline: 'No club picked',
      detail: 'You are out if this locks empty · 9 minutes',
      urgency: 'urgent',
      shape: 'one-decision',
    },
    {
      id: 'f-predictor',
      contextId: 'premier-league',
      game: 'match-predictor',
      headline: '3 predictions left',
      detail: 'Locks in 9 minutes',
      urgency: 'urgent',
      shape: 'many-decisions',
    },
  ],
  people: [
    privateLeague('l-sunday', 'The Sunday Club', 'premier-league', 'match-predictor', 18, SUNDAY_CLUB),
  ],
  catalogue: catalogueWith(deadlineContexts),
}

/* ==========================================================================
   7 — the quiet day
   ========================================================================== */

const quietContexts: readonly FootballContext[] = [
  contextOf({
    id: 'premier-league',
    relationship: 'playing',
    favourite: true,
    tempo: 'quiet',
    tempoLabel: 'Matchweek 13 opens Thursday',
    recency: 0,
    fixtures: [
      'FT · Glenmore Athletic 2–1 Strathkelvin United',
      'FT · Carrickvale Rovers 0–0 Porthaven City',
      'Next: Thu 20:00 · Porthaven City v Glenmore Athletic',
    ],
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(10, 10, 'Matchweek 12 settled · 34 points'),
      },
      {
        key: 'last-man-standing',
        availability: 'joined',
        status: lmsStatus('alive', null, 'Round 13 opens Thursday', 61, 12),
      },
      {
        key: 'championship',
        availability: 'joined',
        status: championshipStatus(3, 18, '2 points behind the leader', 'Søren Kjær'),
      },
    ],
  }),
  contextOf({
    id: 'scottish-premiership',
    relationship: 'playing',
    tempo: 'quiet',
    tempoLabel: 'International break',
    recency: 1,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(6, 6, 'Matchweek 14 settled · 21 points'),
      },
      { key: 'last-man-standing', availability: 'joinable' },
      { key: 'championship', availability: 'joinable' },
    ],
  }),
]

const quietDayModel: IaModel = {
  scenario: 'Quiet day',
  premise: 'No football, nothing due. The architecture still has to be worth opening.',
  player: iaPeople.user,
  contexts: quietContexts,
  activeContextId: 'premier-league',
  attention: [
    {
      id: 'g-recap',
      contextId: 'premier-league',
      game: 'match-predictor',
      headline: 'Matchweek 12 banked 34 points',
      detail: 'Up 12 places · two exact scores',
      urgency: 'done',
      shape: 'watch',
    },
    {
      id: 'g-lms',
      contextId: 'premier-league',
      game: 'last-man-standing',
      headline: 'You survived round 12',
      detail: '83 became 61 · round 13 opens Thursday',
      urgency: 'done',
      shape: 'one-decision',
    },
  ],
  people: [
    privateLeague('l-sunday', 'The Sunday Club', 'premier-league', 'match-predictor', 18, SUNDAY_CLUB),
    globalTable('g-epl', 'Premier League standings', 'premier-league', 4812, GLOBAL_EPL),
  ],
  catalogue: catalogueWith(quietContexts),
}

/* ==========================================================================
   8 — a competition that does not run the game the player wants
   ========================================================================== */

const unsupportedContexts: readonly FootballContext[] = [
  contextOf({
    id: 'euro-2028',
    relationship: 'playing',
    tempo: 'scheduled',
    tempoLabel: 'Qualifier · Friday',
    recency: 0,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(2, 6, 'Locks Friday 19:00'),
        urgency: 'soon',
      },
    ],
  }),
  contextOf({
    id: 'premier-league',
    relationship: 'playing',
    favourite: true,
    tempo: 'quiet',
    tempoLabel: 'Saturday',
    recency: 1,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(10, 10, 'Locks Saturday 11:30'),
      },
      {
        key: 'last-man-standing',
        availability: 'joined',
        status: lmsStatus('alive', 'Glenmore Athletic', 'Locks Saturday 11:30', 83, 11),
      },
      { key: 'championship', availability: 'registration-closed' },
    ],
  }),
]

/**
 * THE UNSUPPORTED-GAME SCENARIO, AND WHY IT NEEDS THREE DIFFERENT ANSWERS.
 *
 * Euro 2028 runs the Match Predictor and nothing else; the Premier League runs
 * all three but its Championship registration has closed. So a concept has to
 * distinguish, in words a player can act on:
 *
 *   * a game this competition does not run           → absent, and said once
 *   * a game the player could join                    → an invitation
 *   * a game whose registration window has closed     → a fact, not a control
 *
 * Rendering all three as a disabled tab is the failure this scenario exists to
 * expose.
 */
const unsupportedGameModel: IaModel = {
  scenario: 'Unsupported game',
  premise:
    'The active competition runs only the Match Predictor. Another runs all three, but its Championship registration has closed.',
  player: iaPeople.user,
  contexts: unsupportedContexts,
  activeContextId: 'euro-2028',
  attention: [
    {
      id: 'h-euro',
      contextId: 'euro-2028',
      game: 'match-predictor',
      headline: '4 predictions left',
      detail: 'Qualifier locks Friday 19:00',
      urgency: 'soon',
      shape: 'many-decisions',
    },
  ],
  people: [
    globalTable('g-euro', 'Euro 2028 standings', 'euro-2028', 22140, [
      { player: iaPeople.callum, position: 1, points: 44 },
      { player: iaPeople.bea, position: 2, points: 43 },
      { player: iaPeople.user, position: 6011, points: 18, isYou: true },
    ]),
  ],
  catalogue: catalogueWith(unsupportedContexts),
}

/* ==========================================================================
   9 — first sign-in, nothing chosen
   ========================================================================== */

const newcomerModel: IaModel = {
  scenario: 'No competition selected',
  premise:
    'A new account. Nothing followed, nothing joined, and no competition to be in the context of.',
  player: iaPeople.user,
  contexts: [],
  activeContextId: null,
  attention: [],
  people: [],
  catalogue: catalogueWith([]),
}

/* ==========================================================================
   10 — Last Man Standing is the whole story
   ========================================================================== */

const lmsContexts: readonly FootballContext[] = [
  contextOf({
    id: 'premier-league',
    relationship: 'playing',
    favourite: true,
    tempo: 'imminent',
    tempoLabel: 'Locks in 26 min',
    recency: 0,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(10, 10, 'All predicted · locks in 26 min'),
      },
      {
        key: 'last-man-standing',
        availability: 'joined',
        status: lmsStatus('alive', null, 'Locks in 26 min', 83, 11),
        urgency: 'urgent',
      },
      {
        key: 'championship',
        availability: 'joined',
        status: championshipStatus(4, 18, '6 points behind the leader', 'Martin Okafor'),
      },
    ],
  }),
  contextOf({
    id: 'champions-league',
    relationship: 'playing',
    tempo: 'quiet',
    tempoLabel: 'Back on Tuesday',
    recency: 1,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(8, 8, 'Locked'),
      },
      {
        key: 'last-man-standing',
        availability: 'joined',
        status: lmsStatus('eliminated', 'Carrickvale Rovers', null, 14, 5),
      },
    ],
  }),
]

/**
 * LMS IS NOT A SMALLER MATCH PREDICTOR. Everything else in this scenario is
 * finished — ten of ten predicted, the Championship idle — and the only live
 * decision is one club with a consequence. If an architecture buries that
 * behind a game tab inside a competition inside a destination, this is the
 * scenario where the reviewer will see it.
 */
const lmsFocusModel: IaModel = {
  scenario: 'Last Man Standing',
  premise:
    'Everything else is done. One club to pick, twenty-six minutes, and elimination if it locks empty.',
  player: iaPeople.user,
  contexts: lmsContexts,
  activeContextId: 'premier-league',
  attention: [
    {
      id: 'i-lms',
      contextId: 'premier-league',
      game: 'last-man-standing',
      headline: 'Pick one club to survive round 12',
      detail: '83 still in · 11 clubs already used · locks in 26 min',
      urgency: 'urgent',
      shape: 'one-decision',
    },
    {
      id: 'i-ucl-lms',
      contextId: 'champions-league',
      game: 'last-man-standing',
      headline: 'You were eliminated in round 6',
      detail: 'Carrickvale Rovers lost 2–0 · 14 still in',
      urgency: 'done',
      shape: 'one-decision',
    },
  ],
  people: [
    privateLeague('l-office', 'Office Survivors', 'premier-league', 'last-man-standing', 24, [
      { player: iaPeople.user, position: 1, points: 11, movement: 'flat', isYou: true },
      { player: iaPeople.martin, position: 1, points: 11, movement: 'flat' },
      { player: iaPeople.priya, position: 3, points: 9, movement: 'down' },
      { player: iaPeople.marguerite, position: 4, points: 7, movement: 'down' },
    ]),
  ],
  catalogue: catalogueWith(lmsContexts),
}

/* ==========================================================================
   11 — deliberate discovery
   ========================================================================== */

const discoveryContexts: readonly FootballContext[] = [
  contextOf({
    id: 'premier-league',
    relationship: 'playing',
    favourite: true,
    tempo: 'quiet',
    tempoLabel: 'Saturday',
    recency: 0,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(10, 10, 'Locks Saturday 11:30'),
      },
      { key: 'last-man-standing', availability: 'joinable' },
      { key: 'championship', availability: 'joinable' },
    ],
  }),
  contextOf({
    id: 'serie-a',
    relationship: 'browsing',
    tempo: 'scheduled',
    tempoLabel: 'Sunday',
    recency: 1,
  }),
]

const discoveryModel: IaModel = {
  scenario: 'Discovery',
  premise:
    'Looking at a competition they neither play nor follow, with twenty published and one played.',
  player: iaPeople.user,
  contexts: discoveryContexts,
  activeContextId: 'serie-a',
  attention: [],
  people: [],
  catalogue: catalogueWith(discoveryContexts),
}

/* ==========================================================================
   12 — the long-name stress
   ========================================================================== */

const longNameContexts: readonly FootballContext[] = [
  contextOf({
    id: 'champions-league',
    relationship: 'playing',
    tempo: 'imminent',
    tempoLabel: 'Locks in 41 min',
    recency: 0,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(4, 8, 'Locks in 41 min'),
        urgency: 'urgent',
      },
      {
        key: 'last-man-standing',
        availability: 'joined',
        status: lmsStatus('alive', 'Strathallan Caledonian Thistle', 'Locks in 41 min', 14, 5),
      },
    ],
  }),
  contextOf({
    id: 'nwsl',
    relationship: 'playing',
    tempo: 'quiet',
    tempoLabel: null,
    recency: 1,
    games: [
      {
        key: 'match-predictor',
        availability: 'joined',
        status: predictorStatus(6, 6, 'Locked'),
      },
      { key: 'last-man-standing', availability: 'joinable' },
    ],
  }),
  contextOf({
    id: 'scottish-championship',
    relationship: 'following',
    tempo: 'quiet',
    tempoLabel: null,
    recency: 2,
  }),
]

const longNameModel: IaModel = {
  scenario: 'Long names',
  premise:
    'The longest competition names and the longest player name the fixtures hold, in every control at once.',
  player: iaPeople.marguerite,
  contexts: longNameContexts,
  activeContextId: 'champions-league',
  attention: [
    {
      id: 'j-ucl',
      contextId: 'champions-league',
      game: 'match-predictor',
      headline: '4 predictions left',
      detail: 'Locks in 41 minutes',
      urgency: 'urgent',
      shape: 'many-decisions',
    },
    {
      id: 'j-ucl-lms',
      contextId: 'champions-league',
      game: 'last-man-standing',
      headline: 'Strathallan Caledonian Thistle selected',
      detail: '14 still in',
      urgency: 'done',
      shape: 'one-decision',
    },
  ],
  people: [
    privateLeague(
      'l-long',
      'Marguerite and the Wednesday Night Prediction Society',
      'champions-league',
      'match-predictor',
      11,
      [
        { player: iaPeople.marguerite, position: 1, points: 133, movement: 'up', isYou: true },
        { player: iaPeople.callum, position: 2, points: 128, movement: 'down' },
        { player: iaPeople.priya, position: 3, points: 121, movement: 'flat' },
      ],
    ),
    globalTable('g-ucl', 'Champions League standings', 'champions-league', 1907, [
      { player: iaPeople.marguerite, position: 1, points: 133, isYou: true },
      { player: iaPeople.priya, position: 2, points: 128 },
      { player: iaPeople.callum, position: 3, points: 121 },
    ]),
  ],
  catalogue: catalogueWith(longNameContexts),
}

/* ==========================================================================
   the registry
   ========================================================================== */

/**
 * THE REGISTRY IS THE ONLY WAY IN, and the twelve worlds above are deliberately
 * not exported one by one. A story, a test or a concept that reached for one
 * scenario directly would be a caller the "every concept renders every world"
 * property cannot see — and the dead-code sweep would report twelve unused
 * exports for as long as that stayed true.
 */
export const iaScenarios = {
  single: singleCompetitionModel,
  regular: multiCompetitionModel,
  power: powerUserModel,
  catalogue: twentyCompetitionModel,
  matchday: matchdayModel,
  deadline: deadlineModel,
  quiet: quietDayModel,
  unsupported: unsupportedGameModel,
  newcomer: newcomerModel,
  lms: lmsFocusModel,
  discovery: discoveryModel,
  longNames: longNameModel,
} as const satisfies Readonly<Record<string, IaModel>>

export type IaScenarioName = keyof typeof iaScenarios

export const iaScenarioNames = Object.keys(iaScenarios) as readonly IaScenarioName[]
