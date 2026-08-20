import type { SeasonWrappedModel, SeasonWrappedResult } from '../../models/wrapped'

/**
 * THE WORLDS A FINISHED SEASON CAN BE IN.
 *
 * Contract 156 stores a small, fixed set of facts and every one of them is
 * nullable in a different way, so the worlds here are the combinations a real
 * archive actually produces — not a grid of variations invented to fill a
 * board. Each is named for the PLAYER it describes rather than for the field
 * that is missing, because "a season somebody entered and never played" is a
 * person and `bestMatchweek: null` is a schema detail.
 *
 * DETERMINISTIC, like every other fixture: no clock, no random source, and
 * `generatedAt` is a literal so a screenshot is the same picture on every run.
 */

const NOW = '2028-05-28T09:00:00.000Z'

const CONTEXT = {
  competitionName: 'Caledonian Premiership',
  seasonLabel: '2027/28',
  playerName: 'Aisha Kaur',
} as const

const PLAYED_RESULT: SeasonWrappedResult = {
  season: { points: 418, rank: 1102, fieldSize: 12490, matchweeksPlayed: 36 },
  best: { ordinal: 27, points: 24 },
  accuracy: {
    fixturesPredicted: 342,
    exactScores: 71,
    correctOutcomes: 168,
    exactShare: 71 / 342,
    correctShare: 168 / 342,
  },
  jokersPlayed: 4,
  finalisedAt: '2028-05-26T18:40:00.000Z',
}

/** The ordinary Wrapped: a full season, played and ranked. */
const played: SeasonWrappedModel = {
  generatedAt: NOW,
  context: CONTEXT,
  body: { kind: 'wrapped', result: PLAYED_RESULT },
}

/**
 * A SEASON THE ARCHIVE COULD NOT RANK.
 *
 * Contract 156 stores rank and field size as nullable, and a Wrapped without
 * them is a real row rather than a broken one. The page must lose the tile and
 * keep everything else — never print "unranked", and certainly never zero.
 */
const unranked: SeasonWrappedModel = {
  ...played,
  body: {
    kind: 'wrapped',
    result: {
      ...PLAYED_RESULT,
      season: { points: 418, rank: null, fieldSize: null, matchweeksPlayed: 36 },
    },
  },
}

/**
 * A PLAYER WHO ENTERED AND NEVER PUT A SCORELINE IN.
 *
 * The one Wrapped with no achievement in it: no rates to divide, no best
 * matchweek to name, and nothing to celebrate. It gets a sentence rather than a
 * grid of zeros, which would read as a season played badly instead of a season
 * not played.
 */
const neverPlayed: SeasonWrappedModel = {
  generatedAt: NOW,
  context: CONTEXT,
  body: {
    kind: 'wrapped',
    result: {
      season: { points: 0, rank: null, fieldSize: null, matchweeksPlayed: 0 },
      best: null,
      accuracy: {
        fixturesPredicted: 0,
        exactScores: 0,
        correctOutcomes: 0,
        exactShare: null,
        correctShare: null,
      },
      jokersPlayed: 0,
      finalisedAt: '2028-05-26T18:40:00.000Z',
    },
  },
}

/** The commonest answer of all: the season is still running. */
const pending: SeasonWrappedModel = {
  generatedAt: NOW,
  context: CONTEXT,
  body: { kind: 'pending' },
}

/** The read did not answer. An apology with a way out, never a page of zeros. */
const unavailable: SeasonWrappedModel = {
  generatedAt: NOW,
  context: CONTEXT,
  body: { kind: 'unavailable' },
}

export const wrappedScenarios = {
  played,
  unranked,
  neverPlayed,
  pending,
  unavailable,
} as const

export type WrappedScenarioName = keyof typeof wrappedScenarios

export const wrappedScenarioNames = Object.keys(wrappedScenarios) as WrappedScenarioName[]

/** What each world is FOR, in one line, for a reviewer reading the board. */
export const wrappedScenarioPremises: Readonly<Record<WrappedScenarioName, string>> = {
  played: 'A full season, played and ranked. The ordinary Wrapped.',
  unranked: 'The archive stored no rank. The tile goes; nothing is invented.',
  neverPlayed: 'Entered, never predicted. A sentence rather than a grid of zeros.',
  pending: 'The season is still going. A fair question, fairly answered.',
  unavailable: 'The read did not answer. An apology with a way to try again.',
}
