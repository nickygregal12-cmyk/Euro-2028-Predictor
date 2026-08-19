import type { AccountPageModel, PlayedSeason } from '../../models/account'

/**
 * THE ACCOUNT'S DETERMINISTIC WORLDS.
 *
 * EVERY WORLD IS A STATE `buildAccountModel` CAN PRODUCE. Stage 10 shipped a
 * fixture depicting a payload the server cannot emit and four layers of tests
 * passed against it, because every layer trusted the fixture; Stage 12 shipped
 * five worlds offering a submission form to a player who had been knocked out.
 * `tests/vnext/account.test.tsx` asserts the pairing rules over all of these at
 * once, so a new world cannot be added in an impossible state.
 *
 * NO CLOCK. `generatedAt` is fixed, because a world that renders differently on
 * Tuesday is not deterministic.
 */

const ACCOUNT_NOW = '2027-06-01T12:00:00.000Z'

function season(over: Partial<PlayedSeason> = {}): PlayedSeason {
  return {
    tournamentId: 't-1',
    seasonName: 'Caledonian Premiership 2027/28',
    competitionName: 'Caledonian Premiership',
    route: { competitionSlug: 'caledonian', seasonKey: '2027-28' },
    inPublishedCatalogue: true,
    complete: false,
    result: null,
    games: [{ gameName: 'Match Predictor', outcome: null }],
    ...over,
  }
}

function world(overrides: Partial<AccountPageModel> = {}): AccountPageModel {
  return {
    generatedAt: ACCOUNT_NOW,
    context: { displayName: 'Ada Lovelace' },
    follows: {
      kind: 'follows',
      competitions: [
        {
          tournamentId: 't-1',
          identity: {
            kind: 'named',
            competitionName: 'Caledonian Premiership',
            seasonName: 'Caledonian Premiership 2027/28',
            route: { competitionSlug: 'caledonian', seasonKey: '2027-28' },
          },
          favourite: { kind: 'none' },
        },
      ],
    },
    history: { kind: 'seasons', seasons: [season()], total: 1, hasMore: false },
    settings: {
      kind: 'ready',
      email: { kind: 'known', address: 'ada@example.test', pending: null },
      reminderEmails: true,
      // The real numbers: `DISPLAY_NAME_MAX` and `PASSWORD_MIN`. A world that
      // invented friendlier ones would review a sheet nobody will see.
      rules: { displayNameMaxLength: 40, passwordMinLength: 6 },
    },
    support: { kind: 'available', href: 'mailto:help@example.test?subject=Support' },
    ...overrides,
  }
}

/* ==========================================================================
   THE WORLDS
   ========================================================================== */

/** The ordinary visit: one competition followed, one season in progress. */
const ordinary = world()

/** A brand-new account. Both panels are empty, and empty is an ANSWER. */
const newAccount = world({
  follows: { kind: 'empty' },
  history: { kind: 'empty' },
})

/**
 * AN EMAIL CHANGE AWAITING CONFIRMATION. Both addresses are real during this
 * window: showing only the old one says the change did not happen and showing
 * only the new one says it has.
 */
const emailPending = world({
  settings: {
    kind: 'ready',
    email: {
      kind: 'known',
      address: 'ada@example.test',
      pending: 'ada.lovelace@example.test',
    },
    reminderEmails: true,
    rules: { displayNameMaxLength: 40, passwordMinLength: 6 },
  },
})

/** Reminder emails OFF. The switch's other position, which is a stored choice. */
const remindersOff = world({
  settings: {
    kind: 'ready',
    email: { kind: 'known', address: 'ada@example.test', pending: null },
    reminderEmails: false,
    rules: { displayNameMaxLength: 40, passwordMinLength: 6 },
  },
})

/**
 * THE PROFILE READ DID NOT ANSWER, AND THE OTHER TWO DID.
 *
 * The whole reason each panel carries its own outcome. Follows and history are
 * drawn; the settings rows are not, and the switch is NOT drawn off — a stored
 * choice shown in a position the player never put it in is worse than no
 * control at all.
 */
const settingsUnavailable = world({
  settings: { kind: 'unavailable' },
})

/**
 * NO ADMINISTRATOR CONFIGURED. Stated, not hidden: a player who cannot find a
 * way to ask for help should be told there is not one here rather than left
 * hunting for a link that was silently removed.
 */
const noSupportAddress = world({
  support: { kind: 'unconfigured' },
})

/**
 * THE SESSION KNOWS NO ADDRESS. Different again from the panel failing — the
 * profile answered and the session did not, so the reminder switch and the
 * name row are real and the email row cannot state what it holds.
 */
const emailUnknown = world({
  settings: {
    kind: 'ready',
    email: { kind: 'unknown' },
    reminderEmails: true,
    rules: { displayNameMaxLength: 40, passwordMinLength: 6 },
  },
})

/**
 * THE BINDING WORLD FOR THIS SURFACE. A follow neither the catalogue nor the
 * participation history can name — real, chosen by the player, and unnameable.
 * The page says so in a sentence rather than showing a uuid or guessing.
 */
const unnameableFollow = world({
  follows: {
    kind: 'follows',
    competitions: [
      {
        tournamentId: 't-gone',
        identity: { kind: 'unnamed' },
        favourite: { kind: 'none' },
      },
    ],
  },
})

/** A favourite club is SET. The page says that and never which club. */
const favouriteSet = world({
  follows: {
    kind: 'follows',
    competitions: [
      {
        tournamentId: 't-1',
        identity: {
          kind: 'named',
          competitionName: 'Caledonian Premiership',
          seasonName: 'Caledonian Premiership 2027/28',
          route: { competitionSlug: 'caledonian', seasonKey: '2027-28' },
        },
        favourite: { kind: 'set' },
      },
    ],
  },
})

/** Followed, nameable, and with no route. It is named and cannot be opened. */
const followWithoutRoute = world({
  follows: {
    kind: 'follows',
    competitions: [
      {
        tournamentId: 't-old',
        identity: {
          kind: 'named',
          competitionName: 'Highland League',
          seasonName: 'Highland League 2024/25',
          route: null,
        },
        favourite: { kind: 'none' },
      },
    ],
  },
})

/** A finished season, with contract 156's stored figures. */
const finishedSeason = world({
  history: {
    kind: 'seasons',
    seasons: [
      season({
        tournamentId: 't-done',
        seasonName: 'Caledonian Premiership 2026/27',
        complete: true,
        result: { points: 412, rank: 3, fieldSize: 28, matchweeksPlayed: 38 },
        games: [
          { gameName: 'Match Predictor', outcome: 'played' },
          { gameName: 'Last Man Standing', outcome: 'eliminated' },
        ],
      }),
    ],
    total: 1,
    hasMore: false,
  },
})

/** Finalised with no rank. A null rank is not a last place. */
const resultWithoutRank = world({
  history: {
    kind: 'seasons',
    seasons: [
      season({
        complete: true,
        result: { points: 88, rank: null, fieldSize: null, matchweeksPlayed: 9 },
      }),
    ],
    total: 1,
    hasMore: false,
  },
})

/**
 * FINISHED, AND NEVER WRAPPED. Contract 161 makes "the season is over" and "a
 * Wrapped exists" independent facts, so this row belongs under Finished with no
 * result to print. Grouping on the result — which an earlier draft did — told
 * the player it was still running.
 */
const finishedWithoutWrapped = world({
  history: {
    kind: 'seasons',
    seasons: [
      season({
        tournamentId: 't-unwrapped',
        seasonName: 'Harbour League 2026/27',
        competitionName: 'Harbour League',
        // COMPLETE AND UNWRAPPED — two independent facts in contract 161, and
        // the pair an earlier draft got wrong: partitioning on the result filed
        // this under "Still going".
        complete: true,
        result: null,
        games: [{ gameName: 'Match Predictor', outcome: 'played' }],
      }),
    ],
    total: 1,
    hasMore: false,
  },
})

/**
 * ARCHIVED. The catalogue no longer publishes it and the server withheld the
 * slug, so the row says "archived" and offers no button — which contract 161's
 * own header argues beats a link that goes nowhere.
 */
const archivedSeason = world({
  history: {
    kind: 'seasons',
    seasons: [
      season({
        tournamentId: 't-arch',
        seasonName: 'Border League 2023/24',
        route: null,
        inPublishedCatalogue: false,
        complete: true,
        result: { points: 301, rank: 11, fieldSize: 14, matchweeksPlayed: 30 },
      }),
    ],
    total: 1,
    hasMore: false,
  },
})

/** Both groups at once, so the headings and the server's order are visible. */
const mixedHistory = world({
  history: {
    kind: 'seasons',
    seasons: [
      season({ tournamentId: 't-a', seasonName: 'Season A' }),
      season({
        tournamentId: 't-b',
        seasonName: 'Season B',
        complete: true,
        result: { points: 210, rank: 5, fieldSize: 20, matchweeksPlayed: 22 },
      }),
      season({ tournamentId: 't-c', seasonName: 'Season C' }),
    ],
    total: 3,
    hasMore: false,
  },
})

/** More seasons than were sent. The page says so rather than truncating quietly. */
const pagedHistory = world({
  history: {
    kind: 'seasons',
    seasons: [season({ tournamentId: 't-a', seasonName: 'Season A' })],
    total: 9,
    hasMore: true,
  },
})

/** Preferences failed; the history answered. One panel says so and the other does not. */
const followsUnavailable = world({ follows: { kind: 'unavailable' } })

/** The history failed; the follows answered. */
const historyUnavailable = world({ history: { kind: 'unavailable' } })

/** Both reads failed. The page is still a page. */
const bothUnavailable = world({
  follows: { kind: 'unavailable' },
  history: { kind: 'unavailable' },
})

/** No display name. The header must not invent one. */
const noDisplayName = world({ context: { displayName: null } })

/** Several follows and a long name, for the width tests. */
const manyFollows = world({
  follows: {
    kind: 'follows',
    competitions: [
      {
        tournamentId: 't-1',
        identity: {
          kind: 'named',
          competitionName: 'Royal Caledonian and Borders Championship Premier Division',
          seasonName: 'Royal Caledonian and Borders Championship Premier Division 2027/28',
          route: { competitionSlug: 'royal-caledonian', seasonKey: '2027-28' },
        },
        favourite: { kind: 'set' },
      },
      {
        tournamentId: 't-2',
        identity: {
          kind: 'named',
          competitionName: 'Highland League',
          seasonName: 'Highland League 2027/28',
          route: { competitionSlug: 'highland', seasonKey: '2027-28' },
        },
        favourite: { kind: 'none' },
      },
      { tournamentId: 't-3', identity: { kind: 'unnamed' }, favourite: { kind: 'none' } },
    ],
  },
})

/* ==========================================================================
   THE REGISTRY
   ========================================================================== */

export const accountScenarios = {
  ordinary,
  newAccount,
  unnameableFollow,
  favouriteSet,
  followWithoutRoute,
  finishedSeason,
  resultWithoutRank,
  archivedSeason,
  finishedWithoutWrapped,
  mixedHistory,
  pagedHistory,
  followsUnavailable,
  historyUnavailable,
  bothUnavailable,
  noDisplayName,
  manyFollows,
  emailPending,
  remindersOff,
  settingsUnavailable,
  noSupportAddress,
  emailUnknown,
} as const

export type AccountScenarioName = keyof typeof accountScenarios

export const accountScenarioNames = Object.keys(accountScenarios) as AccountScenarioName[]

export const accountScenarioPremises: Readonly<Record<AccountScenarioName, string>> = {
  ordinary: 'The ordinary visit. One competition followed and one season in progress.',
  emailPending:
    'An email change awaiting confirmation. BOTH addresses are real during that window, so the row states the one in use and the one being moved to \u2014 showing either alone tells the player something untrue about their own change.',
  remindersOff:
    'The reminder switch in its other position. A stored choice, drawn where the player put it.',
  settingsUnavailable:
    'The profile read did not answer and the other two did. The settings rows are absent \u2014 and the switch is NOT drawn off, because a stored choice shown in a position nobody chose is worse than no control.',
  noSupportAddress:
    'No administrator address configured for this deployment. Stated rather than hidden: a player who cannot find a way to ask for help should be told there is not one here.',
  emailUnknown:
    'The profile answered and the session did not. The name row and the switch are real; the email row cannot state what it holds and says so instead of showing a blank.',
  newAccount:
    'A brand-new account. Both panels are EMPTY, and empty is an answer — "you follow nothing" and "we could not find out" send a player to different screens.',
  unnameableFollow:
    'THE binding world. A follow the catalogue no longer lists and the player never played. Real, chosen, and impossible to name from any read this page makes — so the page says that, rather than showing a uuid or inventing a plausible name.',
  favouriteSet:
    'A favourite club is set. The page says the fact and never the club: resolving the name is a competition-scoped read plus a fixture sweep, per follow.',
  followWithoutRoute:
    'Named and unopenable. A name comes from the participation history; the route does not, because the season is no longer routable.',
  finishedSeason:
    'A finished season carrying contract 156’s stored snapshot. Nothing on this page recomputes a total.',
  resultWithoutRank:
    'Finalised with no rank. A null rank is not a last place and is not printed as one.',
  finishedWithoutWrapped:
    'Finished, and never wrapped. Contract 161 makes "the season is over" and "a Wrapped exists" independent, so this row belongs under Finished with no result to print — grouping on the result would tell the player it is still running.',
  archivedSeason:
    'Archived. The catalogue no longer publishes it and the server withheld the slug, so there is no button — which beats a link that goes nowhere.',
  mixedHistory: 'Both groups at once, each keeping the server’s own order.',
  pagedHistory:
    'More seasons exist than were sent. Said plainly, because silent truncation reads as "this is all of it".',
  followsUnavailable: 'Preferences failed and the history answered. One panel says so; the other does not.',
  historyUnavailable: 'The history failed and the preferences answered.',
  bothUnavailable: 'Both reads failed. The page is still a page and still says who you are.',
  noDisplayName: 'No display name. The header must not invent one.',
  manyFollows: 'Several follows and a very long competition name. The width test.',
}
