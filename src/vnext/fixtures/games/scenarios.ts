import type { GameEntry, GamesPageModel } from '../../models/games'

/**
 * THE GAMES HUB'S DETERMINISTIC WORLDS.
 *
 * EVERY WORLD IS A STATE `buildGamesModel` CAN PRODUCE, and
 * `tests/vnext/games.test.tsx` asserts the pairing rules over all of them at
 * once — the guard Stage 10 lacked and Stage 12 lacked again.
 *
 * THE THREE GAMES APPEAR TOGETHER IN MOST WORLDS, on purpose. A fixture set
 * where the Main Predictor usually stands alone would let a peer surface be
 * reviewed as a one-game page.
 *
 * NO CLOCK. `generatedAt` is fixed.
 */

const GAMES_NOW = '2027-08-01T12:00:00.000Z'

function entry(over: Partial<GameEntry> = {}): GameEntry {
  return {
    id: 'g-main',
    gameKey: 'main_predictor',
    displayName: 'Match Predictor',
    active: true,
    standing: { kind: 'never-joined', registration: 'open' },
    // Most worlds are catalogue worlds: nothing joined, so no game is asking.
    weekAction: null,
    ...over,
  }
}

const MAIN = entry()
const LMS = entry({
  id: 'g-lms',
  gameKey: 'last_man_standing',
  displayName: 'Last Man Standing',
})
const CUP = entry({
  id: 'g-cup',
  gameKey: 'predictor_cup',
  displayName: 'Predictor Championship',
})

function world(overrides: Partial<GamesPageModel> = {}): GamesPageModel {
  return {
    generatedAt: GAMES_NOW,
    context: { competitionName: 'Caledonian Premiership', seasonLabel: '2027/28' },
    games: { kind: 'games', entries: [MAIN, LMS, CUP] },
    ...overrides,
  }
}

/* ==========================================================================
   THE WORLDS
   ========================================================================== */

/** The three games, all open, none of them joined. The peer test. */
const allOpen = world()

/** In one, out of two. The only grouping the page makes. */
const playingOne = world({
  games: {
    kind: 'games',
    entries: [MAIN, { ...LMS, standing: { kind: 'playing' } }, CUP],
  },
})

/** In all three. The "you are playing" group holds everything. */
const playingAll = world({
  games: {
    kind: 'games',
    entries: [
      { ...MAIN, standing: { kind: 'playing' } },
      { ...LMS, standing: { kind: 'playing' } },
      { ...CUP, standing: { kind: 'playing' } },
    ],
  },
})

/**
 * THE BINDING WORLD FOR THIS SURFACE. A player who left Last Man Standing,
 * which is the one game whose catalogue row sets `allow_rejoin = false`. The
 * page states the RULE — it only takes you back if it has not started — because
 * whether it has started is not readable from any browser.
 */
const leftAndUncertain = world({
  games: {
    kind: 'games',
    entries: [
      { ...MAIN, standing: { kind: 'playing' } },
      { ...LMS, standing: { kind: 'left', rejoin: 'only-before-it-starts' } },
      CUP,
    ],
  },
})

/** Left a game that always takes you back. Determinate, and still no button. */
const leftAndAllowed = world({
  games: {
    kind: 'games',
    entries: [MAIN, { ...LMS, standing: { kind: 'left', rejoin: 'allowed' } }, CUP],
  },
})

/** Disqualified. Absolute, and said as such. */
const disqualified = world({
  games: {
    kind: 'games',
    entries: [MAIN, { ...LMS, standing: { kind: 'disqualified' } }, CUP],
  },
})

/** Every registration state at once, so the four sentences can be compared. */
const everyRegistrationState = world({
  games: {
    kind: 'games',
    entries: [
      { ...MAIN, standing: { kind: 'never-joined', registration: 'open' } },
      { ...LMS, standing: { kind: 'never-joined', registration: 'not-open' } },
      { ...CUP, standing: { kind: 'never-joined', registration: 'closed' } },
      entry({
        id: 'g-old',
        gameKey: 'original_predictor',
        displayName: 'Original Predictor',
        standing: { kind: 'never-joined', registration: 'finished' },
      }),
    ],
  },
})

/** A game the catalogue switched off. Not running is not missing. */
const inactiveGame = world({
  games: {
    kind: 'games',
    entries: [MAIN, { ...LMS, active: false }, CUP],
  },
})

/** A game the catalogue did not name. The page does not name it either. */
const unnamedGame = world({
  games: {
    kind: 'games',
    entries: [MAIN, { ...LMS, displayName: null }, CUP],
  },
})

/** A member of a competition that runs nothing this season. */
const noGames = world({ games: { kind: 'empty' } })

/** The read did not answer. */
const unavailable = world({ games: { kind: 'unavailable' } })

/** Long names and five games, for the width tests. */
const wideCatalogue = world({
  games: {
    kind: 'games',
    entries: [
      { ...MAIN, displayName: 'Match Predictor — Royal Caledonian and Borders Premier Division' },
      { ...LMS, standing: { kind: 'playing' } },
      CUP,
      entry({ id: 'g-orig', gameKey: 'original_predictor', displayName: 'Original Predictor' }),
      entry({ id: 'g-ko', gameKey: 'ko_predictor', displayName: 'Knockout Predictor' }),
    ],
  },
})

/* ==========================================================================
   THE REGISTRY
   ========================================================================== */

/**
 * THE WEEK REACHES THE CATALOGUE — the world the shipped surface could not draw.
 *
 * Three joined games, each in a different relationship to this week: the Match
 * Predictor still wants seven scorelines, Last Man Standing still wants a club,
 * and the Championship is riding on points the player is already being told to
 * earn. Two of those are jobs and one is a report, and the surface has to show
 * that difference without being told which is which — `outstanding` is the only
 * input that decides it.
 *
 * The titles are `competitionWeekModel`'s own sentences, copied verbatim rather
 * than paraphrased, because that is what Home prints for the same game and the
 * two must not drift.
 */
const askingThisWeek = world({
  games: {
    kind: 'games',
    entries: [
      {
        ...MAIN,
        standing: { kind: 'playing' },
        weekAction: {
          title: 'Matchweek 12: 7 of 10 still to predict',
          outstanding: true,
          deadline: '2027-08-21T14:00:00.000Z',
          call: 'Predict this matchweek',
        },
      },
      {
        ...LMS,
        standing: { kind: 'playing' },
        weekAction: {
          title: 'Last Man Standing: pick a club for Round 12',
          outstanding: true,
          deadline: '2027-08-21T13:30:00.000Z',
          call: 'Pick your club',
        },
      },
      {
        ...CUP,
        standing: { kind: 'playing' },
        weekAction: {
          title: 'Championship: Matchday 3 against Rowan Adeyemi',
          outstanding: false,
          deadline: '2027-08-21T14:00:00.000Z',
          call: null,
        },
      },
    ],
  },
})

/** The same three, all settled: three reports and nothing to press. */
const settledThisWeek = world({
  games: {
    kind: 'games',
    entries: [
      {
        ...MAIN,
        standing: { kind: 'playing' },
        weekAction: {
          title: 'Matchweek 12 card is complete',
          outstanding: false,
          deadline: '2027-08-21T14:00:00.000Z',
          call: null,
        },
      },
      {
        ...LMS,
        standing: { kind: 'playing' },
        weekAction: {
          title: 'Last Man Standing: you are out',
          outstanding: false,
          deadline: null,
          call: null,
        },
      },
      { ...CUP, standing: { kind: 'playing' } },
    ],
  },
})

export const gamesScenarios = {
  askingThisWeek,
  settledThisWeek,
  allOpen,
  playingOne,
  playingAll,
  leftAndUncertain,
  leftAndAllowed,
  disqualified,
  everyRegistrationState,
  inactiveGame,
  unnamedGame,
  noGames,
  unavailable,
  wideCatalogue,
} as const

export type GamesScenarioName = keyof typeof gamesScenarios

export const gamesScenarioNames = Object.keys(gamesScenarios) as GamesScenarioName[]

export const gamesScenarioPremises: Readonly<Record<GamesScenarioName, string>> = {
  allOpen:
    'The three games, all open, none joined. THE peer test: if one of them reads as the main one, the surface has failed at the thing it exists for.',
  playingOne: 'In one, out of two. The only grouping this page makes is about the player.',
  playingAll: 'In all three.',
  leftAndUncertain:
    'THE binding world. The player left Last Man Standing — the one game whose catalogue row sets allow_rejoin = false. Whether they may return depends on whether the competition is RUNNING, and competition_is_running is revoked from authenticated, so the page states the rule and refuses to predict the answer.',
  leftAndAllowed:
    'Left a game that always takes you back. Determinate — and there is still no Rejoin button here, because rejoining belongs beside the game.',
  disqualified:
    'Disqualified. The server refuses this above the game’s own flag, so the page says so absolutely rather than conditionally.',
  everyRegistrationState:
    'Open, not open, closed and finished side by side. "Not open" and "closed" ask opposite things of a player — come back, versus do not wait.',
  inactiveGame: 'A game the catalogue switched off. Not running is not the same as missing.',
  unnamedGame:
    'A game the catalogue did not name. The page does not name it either: turning a key into a title would be this lane naming a game the catalogue already names.',
  noGames: 'A member of a competition running no games this season.',
  unavailable: 'The read did not answer.',
  wideCatalogue: 'Five games and a very long name. The width test.',
  askingThisWeek:
    'Two games asking and one reporting. The Match Predictor wants seven scorelines, Last Man Standing wants a club, and the Championship is riding on points the player is already being told to earn. The surface must lead the first two with the ACTION and leave the third a destination, and `outstanding` is the only input that decides which.',
  settledThisWeek:
    'The same three, nothing outstanding. A complete card, an eliminated entry and a Championship between matchdays are all worth saying and none of them is a job — so no row here may carry an action verb.',
}
