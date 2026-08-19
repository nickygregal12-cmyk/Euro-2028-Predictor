/**
 * STAGE 12'S DETERMINISTIC PREDICTOR CHAMPIONSHIP WORLDS.
 *
 * Each one a PREMISE rather than a data dump: the reason it exists is written
 * beside it, and a reviewer reading the Storybook group is reading the reasons.
 *
 * NOTHING HERE READS A CLOCK. Every world carries a fixed `generatedAt`.
 *
 * NOTHING HERE DERIVES A STANDING. Every `standing` is written by hand, and one
 * world deliberately pairs a lost settled tie with `not-stated` — the world a
 * derivation gets wrong, and the one the stage was told to hold.
 *
 * EVERY WORLD IS A STATE `buildChampionshipModel` CAN PRODUCE. A cross-world
 * test asserts the pairing rules, because Stage 10 shipped a fixture depicting
 * a payload the server cannot emit and four layers of tests passed against it.
 */

import type {
  BracketSeat,
  BracketSide,
  ChampionshipPageModel,
} from '../../models/championship'

const CHAMPIONSHIP_NOW = '2027-05-01T12:00:00.000Z'

const competition = {
  competitionName: 'Caledonian Premiership',
  seasonLabel: '2027/28',
  gameName: 'Predictor Championship',
} as const

/* ==========================================================================
   PARTS
   ========================================================================== */

function player(displayName: string, isYou = false): BracketSide {
  return { kind: 'player', displayName, isYou }
}

const empty: BracketSide = { kind: 'empty' }

function seat(
  key: string,
  windowSequence: number,
  windowLabel: string | null,
  home: BracketSide,
  away: BracketSide,
  over: Partial<BracketSeat> = {},
): BracketSeat {
  return {
    key,
    windowSequence,
    windowLabel,
    roundSize: 4,
    bracketSlot: 1,
    home,
    away,
    isYours: false,
    outcome: { kind: 'unsettled' },
    ...over,
  }
}

/** A four-seat semi-final round plus a final, which is the smallest real draw. */
const semiFinals: readonly BracketSeat[] = [
  seat('sf-1', 21, 'Semi-finals', player('Ada Lovelace', true), player('Bo Nilsson'), {
    bracketSlot: 1,
    isYours: true,
  }),
  seat('sf-2', 21, 'Semi-finals', player('Cai Roberts'), player('Dee Okafor'), { bracketSlot: 2 }),
]

const finalSeat = seat('f-1', 22, 'Final', empty, empty, { roundSize: 2, bracketSlot: 1 })

function world(overrides: Partial<ChampionshipPageModel> = {}): ChampionshipPageModel {
  return {
    generatedAt: CHAMPIONSHIP_NOW,
    context: competition,
    standing: { kind: 'stated', outcome: 'qualified' },
    bracket: { kind: 'bracket', seats: [...semiFinals, finalSeat], champion: null },
    penaltyNumber: { kind: 'open', lane: 'odd', locksAt: '2027-05-02T14:00:00.000Z' },
    ...overrides,
  }
}

/* ==========================================================================
   THE WORLDS
   ========================================================================== */

/** The ordinary visit: drawn, the reader's tie unplayed, the final empty. */
const drawnBracket = world()

/**
 * THE BINDING WORLD FOR THIS STAGE. The reader LOST their only tie and has no
 * later one — the inference a derivation makes, and the one refused. `standing`
 * is `not-stated`, because no season read supplies elimination.
 */
const lostButNotStated = world({
  standing: { kind: 'not-stated' },
  bracket: {
    kind: 'bracket',
    seats: [
      seat('sf-1', 21, 'Semi-finals', player('Ada Lovelace', true), player('Bo Nilsson'), {
        bracketSlot: 1,
        isYours: true,
        outcome: { kind: 'settled', decision: 'points', winnerIsHome: false, settledAt: null },
      }),
      seat('sf-2', 21, 'Semi-finals', player('Cai Roberts'), player('Dee Okafor'), {
        bracketSlot: 2,
        outcome: { kind: 'settled', decision: 'points', winnerIsHome: true, settledAt: null },
      }),
      seat('f-1', 22, 'Final', player('Bo Nilsson'), player('Cai Roberts'), {
        roundSize: 2,
        bracketSlot: 1,
      }),
    ],
    champion: null,
  },
})

/** A walkover, which carries a decision and NO score and NO reason. */
const walkover = world({
  bracket: {
    kind: 'bracket',
    seats: [
      seat('sf-1', 21, 'Semi-finals', player('Ada Lovelace', true), player('Bo Nilsson'), {
        bracketSlot: 1,
        isYours: true,
        outcome: { kind: 'settled', decision: 'walkover', winnerIsHome: true, settledAt: null },
      }),
      seat('sf-2', 21, 'Semi-finals', player('Cai Roberts'), player('Dee Okafor'), {
        bracketSlot: 2,
        outcome: {
          kind: 'settled',
          decision: 'admin_walkover',
          winnerIsHome: false,
          settledAt: null,
        },
      }),
    ],
    champion: null,
  },
})

/** Every decision the settlement authority can state, side by side. */
const everyDecision = world({
  bracket: {
    kind: 'bracket',
    seats: [
      seat('d-1', 21, 'Quarter-finals', player('Ada Lovelace', true), player('Bo Nilsson'), {
        isYours: true,
        outcome: { kind: 'settled', decision: 'points', winnerIsHome: true, settledAt: null },
      }),
      seat('d-2', 21, 'Quarter-finals', player('Cai Roberts'), player('Dee Okafor'), {
        bracketSlot: 2,
        outcome: { kind: 'settled', decision: 'extra_time', winnerIsHome: false, settledAt: null },
      }),
      seat('d-3', 21, 'Quarter-finals', player('Eve Zhang'), player('Fay Iqbal'), {
        bracketSlot: 3,
        outcome: {
          kind: 'settled',
          decision: 'penalty_number',
          winnerIsHome: true,
          settledAt: null,
        },
      }),
      seat('d-4', 21, 'Quarter-finals', player('Gil Moreau'), player('Hal Fraser'), {
        bracketSlot: 4,
        outcome: { kind: 'settled', decision: 'walkover', winnerIsHome: false, settledAt: null },
      }),
    ],
    champion: null,
  },
})

/** The reader won it. The only world where `champion` names them. */
const youAreChampion = world({
  standing: { kind: 'stated', outcome: 'champion' },
  bracket: {
    kind: 'bracket',
    seats: [
      seat('f-1', 22, 'Final', player('Ada Lovelace', true), player('Bo Nilsson'), {
        roundSize: 2,
        bracketSlot: 1,
        isYours: true,
        outcome: { kind: 'settled', decision: 'points', winnerIsHome: true, settledAt: null },
      }),
    ],
    champion: { displayName: 'Ada Lovelace', isYou: true },
  },
})

/** Somebody else won it, and the reader is told who without being told they lost. */
const someoneElseWon = world({
  standing: { kind: 'stated', outcome: 'qualified' },
  bracket: {
    kind: 'bracket',
    seats: [
      seat('f-1', 22, 'Final', player('Bo Nilsson'), player('Cai Roberts'), {
        roundSize: 2,
        bracketSlot: 1,
        outcome: { kind: 'settled', decision: 'points', winnerIsHome: true, settledAt: null },
      }),
    ],
    champion: { displayName: 'Bo Nilsson', isYou: false },
  },
})

/**
 * A HALF-FILLED SEAT. It renders as "To be decided" and NOT as a person called
 * "Player" — the trap contract 193's `coalesce` sets, and not a bye either,
 * because the read does not say why the seat is empty.
 */
const halfFilledSeat = world({
  bracket: {
    kind: 'bracket',
    seats: [
      seat('sf-1', 21, 'Semi-finals', player('Ada Lovelace', true), empty, {
        bracketSlot: 1,
        isYours: true,
      }),
      seat('sf-2', 21, 'Semi-finals', player('Cai Roberts'), player('Dee Okafor'), {
        bracketSlot: 2,
      }),
    ],
    champion: null,
  },
})

/** A playoff round, whose `roundSize` and `bracketSlot` the server left null. */
const playoffRound = world({
  bracket: {
    kind: 'bracket',
    seats: [
      seat('p-1', 20, 'Play-off', player('Ada Lovelace', true), player('Bo Nilsson'), {
        roundSize: null,
        bracketSlot: null,
        isYours: true,
      }),
    ],
    champion: null,
  },
})

/** A round the server labelled with nothing. Named by its sequence, not counted. */
const unlabelledRound = world({
  bracket: {
    kind: 'bracket',
    seats: [
      seat('u-1', 21, null, player('Ada Lovelace', true), player('Bo Nilsson'), { isYours: true }),
    ],
    champion: null,
  },
})

/** A deep draw: four rounds, sixteen seats. The width test. */
const wideDraw = world({
  bracket: {
    kind: 'bracket',
    seats: [
      ...Array.from({ length: 8 }, (_, index) =>
        seat(
          `r16-${index}`,
          19,
          'Round of 16',
          player(`Player ${index * 2 + 1}`, index === 0),
          player(`Player ${index * 2 + 2}`),
          { roundSize: 16, bracketSlot: index + 1, isYours: index === 0 },
        ),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        seat(`qf-${index}`, 20, 'Quarter-finals', empty, empty, {
          roundSize: 8,
          bracketSlot: index + 1,
        }),
      ),
      ...Array.from({ length: 2 }, (_, index) =>
        seat(`sf-${index}`, 21, 'Semi-finals', empty, empty, {
          roundSize: 4,
          bracketSlot: index + 1,
        }),
      ),
      seat('f-1', 22, 'Final', empty, empty, { roundSize: 2, bracketSlot: 1 }),
    ],
    champion: null,
  },
})

/** The worst strings: names that break a layout built for "Ada". */
const longNames = world({
  bracket: {
    kind: 'bracket',
    seats: [
      seat(
        'sf-1',
        21,
        'Semi-finals',
        player('Bartholomew Fotheringay-Pemberton', true),
        player('Konstantina Papadopoulou-Andreadis'),
        { bracketSlot: 1, isYours: true },
      ),
    ],
    champion: null,
  },
})

const notDrawn = world({ penaltyNumber: { kind: 'not-required' }, standing: { kind: 'not-stated' }, bracket: { kind: 'not-drawn' } })

const notEntered = world({ penaltyNumber: { kind: 'not-required' }, standing: { kind: 'not-stated' }, bracket: { kind: 'not-entered' } })

const unavailable = world({ penaltyNumber: { kind: 'not-required' }, standing: { kind: 'not-stated' }, bracket: { kind: 'unavailable' } })

/**
 * THE EVEN LANE, ALREADY SUBMITTED, AND THE VALUE IS ZERO.
 *
 * `0` is a legal Penalty Number in the even lane, so a page choosing its case
 * on truthiness rather than on `value !== null` shows this player an empty box
 * and tells them they have not submitted.
 */
const penaltySubmittedZero = world({
  penaltyNumber: {
    kind: 'submitted',
    lane: 'even',
    value: 0,
    locksAt: '2027-05-02T14:00:00.000Z',
  },
})

/** The odd lane, nothing submitted. The rule is stated before any refusal. */
const penaltyOpenOdd = world({
  penaltyNumber: { kind: 'open', lane: 'odd', locksAt: '2027-05-02T14:00:00.000Z' },
})

/** Locked, with a value. The reader can still see their own. */
const penaltyLocked = world({ penaltyNumber: { kind: 'locked', value: 37 } })

/** Locked, and they never submitted. Said plainly rather than shown as blank. */
const penaltyLockedUnsubmitted = world({ penaltyNumber: { kind: 'locked', value: null } })

/**
 * NEITHER LOCKED NOR OPEN. Contract 193 returns both booleans false when the
 * round has no scheduled kickoff, and this is the world that proves the surface
 * reads them independently rather than as complements.
 */
const penaltyUnscheduled = world({ penaltyNumber: { kind: 'unscheduled' } })

/* ==========================================================================
   THE REGISTRY
   ========================================================================== */

export const championshipScenarios = {
  drawnBracket,
  lostButNotStated,
  walkover,
  everyDecision,
  youAreChampion,
  someoneElseWon,
  halfFilledSeat,
  playoffRound,
  unlabelledRound,
  wideDraw,
  longNames,
  notDrawn,
  notEntered,
  unavailable,
  penaltyOpenOdd,
  penaltySubmittedZero,
  penaltyLocked,
  penaltyLockedUnsubmitted,
  penaltyUnscheduled,
} as const

export type ChampionshipScenarioName = keyof typeof championshipScenarios

export const championshipScenarioNames = Object.keys(
  championshipScenarios,
) as readonly ChampionshipScenarioName[]

/** Why each world exists, for the Storybook description and for a reviewer. */
export const championshipScenarioPremises: Readonly<
  Record<ChampionshipScenarioName, string>
> = {
  drawnBracket:
    'The ordinary visit. The draw is made, the reader has a tie to play, and the final is still two empty seats.',
  lostButNotStated:
    'THE binding world. The reader LOST their only tie and has no later one — and the page says NOTHING about elimination, because no season read supplies it. A derivation would print "you are out" here, and would be wrong whenever the competition has not finished eliminating.',
  walkover:
    'A walkover and an organiser-awarded walkover, side by side. Each is a word with NO score and NO reason: whether the opponent withdrew or was disqualified is not in this read.',
  everyDecision:
    'All four settlement vocabularies at once — points, extra time, Penalty Number, walkover — so a reviewer can see that none of them grows a scoreline.',
  youAreChampion:
    'The reader won it. The only world where the champion is them, and the standing says so because the server named them.',
  someoneElseWon:
    'Somebody else won it. The reader is told who, and is NOT told they were eliminated — the read never said so.',
  halfFilledSeat:
    'One side of a seat is empty. It reads "To be decided" rather than as a person called "Player", which is what contract 193 literally returns — and it is not called a bye, because the read does not say why the seat is empty.',
  playoffRound:
    'A play-off, whose round size and bracket slot the server left null. A layout that needed either to place a seat would have to invent it.',
  unlabelledRound:
    'A round the server labelled with nothing. Named by its sequence rather than by counting its seats, because "the round with two ties" is an inference about shape.',
  wideDraw:
    'Sixteen seats across four rounds. The world the phone layout exists for: a knockout TREE would be four unreadable columns at 375, and this is read downwards instead.',
  longNames:
    'Bartholomew Fotheringay-Pemberton against Konstantina Papadopoulou-Andreadis. Nothing may clip — a player scanning a draw for their own name must be able to read it.',
  notDrawn: 'Entered, and the knockout draw has not been made. Not a failure.',
  notEntered:
    'The reader is not entered. An ordinary answer, and there is no join button — Stage 12 does not own entry.',
  unavailable: 'The bracket read did not answer. The only state with a retry.',
  penaltyOpenOdd:
    'The odd lane, nothing submitted. The lane rule is printed BESIDE the box rather than discovered from a refusal — the server refuses the wrong parity with `check_violation`, and that is knowable in advance.',
  penaltySubmittedZero:
    'The even lane, already submitted, and the value is ZERO. A page choosing its case on truthiness rather than on `value !== null` shows this player an empty box and tells them they have not submitted.',
  penaltyLocked:
    'Locked, with a value. The reader can still see their own — and there is nowhere on the page for their opponent’s, because the read never returns it.',
  penaltyLockedUnsubmitted:
    'Locked, and they never submitted. Said plainly rather than rendered as a blank the reader has to interpret.',
  penaltyUnscheduled:
    'Neither locked nor open. Contract 193 returns both booleans false when the round has no scheduled kickoff — so this is the world that proves the surface reads them independently rather than as complements, and it must not say “closed”.',
}
