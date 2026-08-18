import type {
  ShellAttentionItem,
  ShellContext,
  ShellDestination,
  ShellGame,
  ShellLeague,
  VNextShellModel,
} from '../../models/shell'
import { SHELL_DESTINATIONS, SHELL_GAME_NAMES } from '../../models/shell'

/**
 * THE WORLDS THE SELECTED SHELL IS REVIEWED IN.
 *
 * Ten deterministic scenarios, one per question §31 of the Stage 7.6 brief asks
 * the shell to answer. They are the review surface for everything jsdom and the
 * browser suite cannot show a human: whether a one-competition player gets a
 * one-competition product, whether twenty competitions cost the chrome
 * anything, whether a quiet day is quiet, and whether a long competition name
 * breaks anything.
 *
 * DETERMINISTIC AND OFFLINE. No clock, no Supabase, no provider — every tempo,
 * deadline and detail is a STRING somebody wrote, exactly as the model demands.
 * A story rendered at midnight says what it says at noon, so a screenshot is
 * comparable with last week's.
 *
 * REAL COMPETITION NAMES, FICTIONAL CLUBS AND PEOPLE. The same convention
 * `src/dev/scaleFixture.ts` already follows: the competitions are recognisable
 * so a reviewer can judge whether the product FEELS like the Premier League,
 * and nothing invents a real person or a real club's real result.
 *
 * THESE ARE NOT A CATALOGUE READ. Every `contexts` array is the PLAYER's own
 * list, which is the whole scalability argument — `platform` has twenty
 * published competitions and three in `contexts`, and it is meant to render as
 * a three-competition product.
 */

/* ==========================================================================
   competition identities
   ========================================================================== */

const COMPETITIONS = {
  epl: {
    id: 'epl',
    name: 'Premier League',
    shortName: 'Premier League',
    monogram: 'PL',
    seasonLabel: '2026/27',
    colours: { primary: '#3d0a4e', accent: '#00e6a0' },
  },
  spfl: {
    id: 'spfl',
    name: 'Scottish Premiership',
    shortName: 'Premiership',
    monogram: 'SP',
    seasonLabel: '2026/27',
    colours: { primary: '#0b2a4a', accent: '#7fc7ff' },
  },
  ucl: {
    id: 'ucl',
    name: 'Champions League',
    shortName: 'UCL',
    monogram: 'CL',
    seasonLabel: '2026/27',
    colours: { primary: '#0a1a44', accent: '#8fa6ff' },
  },
  euro: {
    id: 'euro2028',
    name: 'Euro 2028',
    shortName: 'Euro 2028',
    monogram: 'E8',
    seasonLabel: null,
    colours: { primary: '#123f2b', accent: '#ffd166' },
  },
  laliga: {
    id: 'laliga',
    name: 'La Liga',
    shortName: 'La Liga',
    monogram: 'LL',
    seasonLabel: '2026/27',
    colours: { primary: '#4a0f14', accent: '#ff8a5b' },
  },
  seriea: {
    id: 'seriea',
    name: 'Serie A',
    shortName: 'Serie A',
    monogram: 'SA',
    seasonLabel: '2026/27',
    colours: { primary: '#0d2f4f', accent: '#68d8d6' },
  },
  bundesliga: {
    id: 'bundesliga',
    name: 'Bundesliga',
    shortName: 'Bundesliga',
    monogram: 'BL',
    seasonLabel: '2026/27',
    colours: { primary: '#2b0d0d', accent: '#ff5c5c' },
  },
  ligue1: {
    id: 'ligue1',
    name: 'Ligue 1',
    shortName: 'Ligue 1',
    monogram: 'L1',
    seasonLabel: '2026/27',
    colours: { primary: '#101a3d', accent: '#9ad0ff' },
  },
  eredivisie: {
    id: 'eredivisie',
    name: 'Eredivisie',
    shortName: 'Eredivisie',
    monogram: 'ED',
    seasonLabel: '2026/27',
    colours: { primary: '#3a1a00', accent: '#ffa94d' },
  },
  championship: {
    id: 'efl-championship',
    name: 'EFL Championship',
    shortName: 'Championship',
    monogram: 'EC',
    seasonLabel: '2026/27',
    colours: { primary: '#1d2b1f', accent: '#b8e986' },
  },
  primeiraliga: {
    id: 'primeira',
    name: 'Primeira Liga',
    shortName: 'Primeira',
    monogram: 'PT',
    seasonLabel: '2026/27',
    colours: { primary: '#0f3d2e', accent: '#e0ff70' },
  },
  mls: {
    id: 'mls',
    name: 'Major League Soccer',
    shortName: 'MLS',
    monogram: 'MS',
    seasonLabel: '2027',
    colours: { primary: '#001f3f', accent: '#6ee7ff' },
  },
  /**
   * THE LONG-NAME CASE, and it is not a joke entry.
   *
   * `overflow-wrap: anywhere` exists in three stylesheets in this stage because
   * of names like this, and a fixture is the only way a human reviewer sees
   * what a 264px rail does with one. The unbroken word is deliberate: it is the
   * case a soft break cannot save.
   */
  verylong: {
    id: 'verylong',
    name: 'Union of European Football Associations Intercontinental Qualification Playoffs',
    shortName: 'UEFA Intercontinental Qualification Playoffs',
    monogram: 'UQ',
    seasonLabel: '2027/28 qualification phase',
    colours: { primary: '#241436', accent: '#c9a7ff' },
  },
} as const

/* ==========================================================================
   game and league builders
   ========================================================================== */

function predictor(made: number, of: number, deadlineLabel: string | null): ShellGame {
  return {
    key: 'match-predictor',
    name: SHELL_GAME_NAMES['match-predictor'],
    summary: { kind: 'match-predictor', made, of, deadlineLabel },
  }
}

function lms(
  life: 'alive' | 'eliminated' | 'not-entered',
  selection: string | null,
  deadlineLabel: string | null,
): ShellGame {
  return {
    key: 'last-man-standing',
    name: SHELL_GAME_NAMES['last-man-standing'],
    summary: { kind: 'last-man-standing', life, selection, deadlineLabel },
  }
}

function championship(
  position: number,
  of: number,
  nextOpponent: string | null,
): ShellGame {
  return {
    key: 'championship',
    name: SHELL_GAME_NAMES.championship,
    summary: { kind: 'championship', position, of, nextOpponent },
  }
}

function league(id: string, name: string, game: ShellLeague['game']): ShellLeague {
  return { id, name, game }
}

/* ==========================================================================
   contexts
   ========================================================================== */

/**
 * THE PREMIER LEAGUE AS A NORMAL PLAYER HAS IT: two games joined, a private
 * league in one of them, and a deadline this week.
 */
const eplContext: ShellContext = {
  competition: COMPETITIONS.epl,
  relationship: 'playing',
  tempoLabel: 'Matchweek 12 · locks Saturday',
  games: [
    predictor(8, 10, 'Locks Saturday 11:30'),
    lms('alive', 'Ashcombe Rangers', 'Pick by Saturday'),
  ],
  leagues: [
    league('epl-sunday-club', 'The Sunday Club', 'match-predictor'),
    league('epl-office', 'Fourth Floor', 'match-predictor'),
  ],
}

const spflContext: ShellContext = {
  competition: COMPETITIONS.spfl,
  relationship: 'playing',
  tempoLabel: '2 live now',
  games: [predictor(11, 11, 'Locked'), championship(3, 24, 'Nadia Oyelaran')],
  leagues: [league('spfl-thistle', 'Thistle & Co', 'match-predictor')],
}

/**
 * A COMPETITION THE PLAYER FOLLOWS AND PLAYS NOTHING IN. It is a real state and
 * not an empty one: contract 157 made Follow answerable, and a shell that
 * counted this as "0 games" and looked broken would reintroduce the defect
 * Follow was built to fix.
 */
const uclContext: ShellContext = {
  competition: COMPETITIONS.ucl,
  relationship: 'following',
  tempoLabel: 'Matchday 5 · Tuesday',
  games: [],
  leagues: [],
}

/**
 * THE UNSUPPORTED-GAME CASE. Euro 2028 runs the Match Predictor and the
 * Championship and does NOT run Last Man Standing — so LMS is ABSENT here
 * rather than present and disabled. A control that exists and refuses teaches a
 * player the product is broken.
 */
const euroContext: ShellContext = {
  competition: COMPETITIONS.euro,
  relationship: 'playing',
  tempoLabel: 'Group stage · Thursday',
  games: [predictor(0, 6, 'Locks Thursday 17:00'), championship(11, 64, 'Tomás Ferreiro')],
  leagues: [league('euro-family', 'Family & Strays', 'match-predictor')],
}

function playingContext(
  competition: ShellContext['competition'],
  tempoLabel: string | null,
): ShellContext {
  return {
    competition,
    relationship: 'playing',
    tempoLabel,
    games: [predictor(4, 9, 'Locks Saturday')],
    leagues: [],
  }
}

/* ==========================================================================
   attention
   ========================================================================== */

function attention(
  id: string,
  contextId: string,
  game: ShellAttentionItem['game'],
  headline: string,
  detail: string,
  urgency: ShellAttentionItem['urgency'],
): ShellAttentionItem {
  return { id, contextId, game, headline, detail, urgency }
}

/* ==========================================================================
   the models
   ========================================================================== */

const PLAYER = { name: 'Rowan Adeyemi', initials: 'RA' }

function model(
  contexts: readonly ShellContext[],
  activeContextId: string | null,
  extra: {
    readonly attention?: readonly ShellAttentionItem[]
    readonly destinations?: readonly ShellDestination[]
    readonly catalogueSize?: number | null
    readonly player?: { readonly name: string; readonly initials: string }
    readonly discoverable?: boolean
  } = {},
): VNextShellModel {
  return {
    player: extra.player ?? PLAYER,
    contexts,
    activeContextId,
    destinations: extra.destinations ?? SHELL_DESTINATIONS,
    attention: extra.attention ?? [],
    discovery: {
      reachable: extra.discoverable ?? true,
      catalogueSize: extra.catalogueSize ?? 20,
    },
  }
}

/** The four destinations with two predictions still outstanding on Games. */
const GAMES_BADGE: readonly ShellDestination[] = SHELL_DESTINATIONS.map((entry) =>
  entry.id === 'games' ? { ...entry, badge: 2 } : entry,
)

/**
 * ONE COMPETITION — the binding product test.
 *
 * The Premier League and nothing else. There must be no switcher, no "Your
 * competitions" group, and no other competition's name anywhere in the
 * permanent chrome — and Explore must still be reachable, because the
 * catalogue is not the player's competitions and never was.
 */
const oneCompetition = model([eplContext], 'epl', { destinations: GAMES_BADGE })

/** FOUR COMPETITIONS, with urgent work in one the player is not looking at. */
const fourCompetitions = model(
  [eplContext, spflContext, euroContext, uclContext],
  'epl',
  {
    destinations: GAMES_BADGE,
    attention: [
      attention(
        'euro-lock',
        'euro2028',
        'match-predictor',
        '6 predictions to make',
        'Locks in 41 minutes',
        'urgent',
      ),
      attention(
        'spfl-champ',
        'spfl',
        'championship',
        'Round 6 opponent confirmed',
        'Nadia Oyelaran, Sunday',
        'soon',
      ),
    ],
  },
)

/** LIVE FOOTBALL SOMEWHERE ELSE — a different urgency from a deadline. */
const liveElsewhere = model(
  [eplContext, spflContext, euroContext, uclContext],
  'epl',
  {
    attention: [
      attention(
        'spfl-live',
        'spfl',
        'match-predictor',
        '2 of your matches are live',
        'Both kicked off at 15:00',
        'live',
      ),
    ],
  },
)

/**
 * A QUIET DAY. Four competitions, nothing waiting anywhere, no live football.
 * The attention layer must render NOTHING — not a zero and not a greyed bell.
 */
const quietDay = model([eplContext, spflContext, euroContext, uclContext], 'epl')

/** TEN-PLUS. The rail overflows, so Jump appears. */
const manyCompetitions = model(
  [
    eplContext,
    spflContext,
    euroContext,
    playingContext(COMPETITIONS.laliga, 'Saturday'),
    playingContext(COMPETITIONS.seriea, 'Sunday'),
    playingContext(COMPETITIONS.bundesliga, 'Friday'),
    playingContext(COMPETITIONS.ligue1, 'Sunday'),
    playingContext(COMPETITIONS.eredivisie, 'Saturday'),
    playingContext(COMPETITIONS.championship, '3 live now'),
    playingContext(COMPETITIONS.primeiraliga, 'Monday'),
    playingContext(COMPETITIONS.mls, 'No football scheduled'),
    uclContext,
  ],
  'epl',
  {
    attention: [
      attention(
        'seriea-lock',
        'seriea',
        'match-predictor',
        '9 predictions to make',
        'Locks in 2 hours',
        'urgent',
      ),
      attention(
        'championship-live',
        'efl-championship',
        'match-predictor',
        '3 of your matches are live',
        'Kicked off at 12:30',
        'live',
      ),
    ],
  },
)

/**
 * TWENTY PUBLISHED, THREE RELEVANT — the scalability test that matters most.
 *
 * The platform is large and this player's product must be small: three rows in
 * the rail, a catalogue of twenty behind one Explore control, and no Jump,
 * because three competitions do not overflow a rail that shows six.
 */
const platformScale = model([eplContext, spflContext, uclContext], 'epl', {
  catalogueSize: 20,
})

/**
 * NO COMPETITIONS. A new account that has followed nothing — a real state, not
 * a loading state and not a failure. The switcher says so, the destinations are
 * still there, and Explore is the only thing with anything to do.
 */
const noCompetitions = model([], null, { catalogueSize: 20 })

/** THE UNSUPPORTED-GAME WORLD, with Euro 2028 active so its absent LMS shows. */
const unsupportedGame = model(
  [euroContext, eplContext, spflContext],
  'euro2028',
  { catalogueSize: 20 },
)

/**
 * LONG NAMES EVERYWHERE — competition, player and private league at once.
 *
 * Nothing may clip and nothing may scroll sideways. This is the fixture the
 * browser suite's overflow measurement is pointed at.
 */
const longNames = model(
  [
    {
      competition: COMPETITIONS.verylong,
      relationship: 'playing',
      tempoLabel: 'Second qualification round · Wednesday',
      games: [
        predictor(2, 8, 'Locks Wednesday 18:45'),
        lms('alive', 'Strathallan Caledonian Thistle Reserves', 'Pick by Wednesday'),
      ],
      leagues: [
        league(
          'verylong-league',
          'The Thursday Night Intercontinental Qualification Sweepstake Society',
          'match-predictor',
        ),
      ],
    },
    eplContext,
  ],
  'verylong',
  {
    player: {
      name: 'Bartholomew Featherstonehaugh-Chumleigh',
      initials: 'BF',
    },
    attention: [
      attention(
        'epl-long',
        'epl',
        'last-man-standing',
        'Pick a club for round 12',
        'Ashcombe Rangers and Marchfield United already used',
        'urgent',
      ),
    ],
  },
)

export const shellScenarios = {
  oneCompetition,
  fourCompetitions,
  liveElsewhere,
  quietDay,
  manyCompetitions,
  platformScale,
  noCompetitions,
  unsupportedGame,
  longNames,
} as const

export type ShellScenarioName = keyof typeof shellScenarios

export const shellScenarioNames = Object.keys(shellScenarios) as readonly ShellScenarioName[]

/**
 * One sentence per world, for the review surface. Kept beside the fixtures
 * rather than in the story file so a reviewer reading either one sees the same
 * premise.
 */
export const shellScenarioPremises: Readonly<Record<ShellScenarioName, string>> = {
  oneCompetition:
    'Premier League only. No switcher, no competition list, Explore still reachable — the product must feel like a Premier League prediction game.',
  fourCompetitions:
    'Four competitions, with six predictions locking in 41 minutes in a competition the player is not looking at.',
  liveElsewhere:
    'Four competitions and live football in one the player is not in. Live is a different urgency from a deadline.',
  quietDay:
    'Four competitions and nothing waiting anywhere. The attention layer must render nothing at all.',
  manyCompetitions:
    'Twelve competitions. The rail shows six and a count; Jump appears because the rail has stopped being complete.',
  platformScale:
    'Twenty competitions published, three relevant. The platform is large and this player’s product must be small.',
  noCompetitions:
    'A new account that has followed nothing. A real state, not a loading state.',
  unsupportedGame:
    'Euro 2028 is active and runs no Last Man Standing. LMS is absent rather than present and refusing.',
  longNames:
    'A competition name, a player name and a private league name that are all far too long. Nothing may clip and nothing may scroll sideways.',
}
