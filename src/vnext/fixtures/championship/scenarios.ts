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
  GroupTable,
  GroupTableRow,
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

/**
 * A GROUP TABLE ROW. Ranks are the standings authority's and are written here
 * in the order and with the numbers a real table carries; nothing sorts them.
 */
function row(
  rank: number,
  displayName: string,
  tablePoints: number,
  over: Partial<GroupTableRow> = {},
): GroupTableRow {
  return {
    rank,
    userId: `u-${displayName.toLowerCase().replace(/[^a-z]/g, '')}`,
    displayName,
    isYou: false,
    tablePoints,
    pointsFor: tablePoints * 3,
    pointsAgainst: 12 - tablePoints,
    exacts: Math.max(0, rank === 1 ? 3 : 4 - rank),
    corrects: 6 - rank,
    scorelineError: rank * 2,
    ...over,
  }
}

const groupA: GroupTable = {
  groupId: 'g-a',
  ordinal: 1,
  isYours: true,
  rows: [
    row(1, 'Ada Lovelace', 9, { isYou: true }),
    row(2, 'Bo Nilsson', 7),
    row(3, 'Cai Roberts', 4),
    row(4, 'Dee Okafor', 1),
  ],
}

const groupB: GroupTable = {
  groupId: 'g-b',
  ordinal: 2,
  isYours: false,
  rows: [
    row(1, 'Eve Zhang', 8),
    row(2, 'Fay Iqbal', 6),
    row(3, 'Gil Moreau', 5),
    // NO SETTLED PREDICTION YET, so no scoreline error — which is not zero.
    row(4, 'Hal Fraser', 0, { scorelineError: null }),
  ],
}

function world(overrides: Partial<ChampionshipPageModel> = {}): ChampionshipPageModel {
  return {
    generatedAt: CHAMPIONSHIP_NOW,
    context: competition,
    standing: { kind: 'stated', outcome: 'active' },
    // Contract 193's `you_qualified`. Held apart from the standing because it
    // never retracts: the default reader is BOTH still in and once seeded.
    seededIntoKnockout: true,
    bracket: { kind: 'bracket', seats: [...semiFinals, finalSeat], champion: null },
    // THE COMMON CASE IS A KNOCKOUT THAT CAME FROM GROUPS, so the default world
    // carries both. A Championship that never had a group stage is its own
    // world below, not the default.
    groups: { kind: 'groups', yourOrdinal: 1, groups: [groupA, groupB] },
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
 * THE WORLD THAT PROVED THE DERIVATION IS REFUSED, and still does.
 *
 * The reader LOST their only tie and has no later one — the inference a
 * derivation makes, and the one refused. `standing` is `not-stated`, which
 * since contract 207 means the READ CARRIED NO OUTCOME: a database behind the
 * contract, which every hosted environment is until it is rolled forward.
 *
 * The page must still say nothing here. A surface that filled the gap from the
 * bracket the moment the column went missing would have moved the derivation
 * rather than removed it.
 */
const lostButNotStated = world({
  standing: { kind: 'not-stated' },
  seededIntoKnockout: true,
  // NO LIVE TIE, SO NO PENALTY NUMBER. Contract 193 returns `penalty_number`
  // as null whenever `my_tie` is null, and `my_tie` filters unsettled fixtures.
  penaltyNumber: { kind: 'not-required' },
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

/**
 * ELIMINATION AS A STATED FACT, in the world where it could never be inferred.
 *
 * The group phase, no knockout, no settled tie, no seed — nothing on this page
 * shaped like a defeat. The competition has nonetheless recorded the reader as
 * eliminated, and that sentence can only have come from
 * `bonus_competition_entrants.outcome`. This is the world contract 207 exists
 * for: every inference the old surface could have made returns "still in".
 */
const eliminatedInGroups = world({
  standing: { kind: 'stated', outcome: 'eliminated' },
  seededIntoKnockout: false,
  penaltyNumber: { kind: 'not-required' },
  bracket: { kind: 'not-drawn' },
  groups: { kind: 'groups', yourOrdinal: 1, groups: [groupA, groupB] },
})

/** A walkover, which carries a decision and NO score and NO reason. */
const walkover = world({
  // NO LIVE TIE, SO NO PENALTY NUMBER. Contract 193 returns `penalty_number`
  // as null whenever `my_tie` is null, and `my_tie` filters unsettled fixtures.
  penaltyNumber: { kind: 'not-required' },
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
  // NO LIVE TIE, SO NO PENALTY NUMBER. Contract 193 returns `penalty_number`
  // as null whenever `my_tie` is null, and `my_tie` filters unsettled fixtures.
  penaltyNumber: { kind: 'not-required' },
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
  // NO LIVE TIE, SO NO PENALTY NUMBER. Contract 193 returns `penalty_number`
  // as null whenever `my_tie` is null, and `my_tie` filters unsettled fixtures.
  penaltyNumber: { kind: 'not-required' },
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

/**
 * Somebody else won it, and the read STATES that the reader is out.
 *
 * Before contract 207 this world's whole point was that the page could not say
 * so. It can now, and the difference is where the sentence comes from: the
 * settlement authority's own column, not the observation that the final has a
 * different name on it.
 */
const someoneElseWon = world({
  standing: { kind: 'stated', outcome: 'eliminated' },
  seededIntoKnockout: true,
  // NO LIVE TIE, SO NO PENALTY NUMBER. Contract 193 returns `penalty_number`
  // as null whenever `my_tie` is null, and `my_tie` filters unsettled fixtures.
  penaltyNumber: { kind: 'not-required' },
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

/**
 * A deep draw: four rounds, sixteen seats. The width test.
 *
 * THE ENTRANTS ARE NOT CALLED "Player". `Player` is contract 193's own
 * `coalesce` sentinel for a seat whose profile is missing, and a world that
 * names sixteen real entrants with it would make the test asserting the
 * sentinel never reaches a reader pass for the wrong reason on the one world
 * where the most seats could hide it.
 */
const wideDraw = world({
  bracket: {
    kind: 'bracket',
    seats: [
      ...Array.from({ length: 8 }, (_, index) =>
        seat(
          `r16-${index}`,
          19,
          'Round of 16',
          player(`Entrant ${index * 2 + 1}`, index === 0),
          player(`Entrant ${index * 2 + 2}`),
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
   THE GROUP PHASE
   ========================================================================== */

/**
 * THE STATE THIS PAGE PREVIOUSLY ANSWERED WITH ONE SENTENCE. A Championship in
 * its group phase has a REAL TABLE and a bracket that does not exist yet — the
 * two reads disagreeing exactly as designed. Saying only "the knockout draw has
 * not been made yet" while contract 167 holds the standings is not a deliberate
 * empty state; it is a read that was not made.
 */
const groupPhase = world({
  standing: { kind: 'not-stated' },
  bracket: { kind: 'not-drawn' },
  penaltyNumber: { kind: 'not-required' },
})

/** The same phase in a competition drawn as ONE group. */
const singleGroupPhase = world({
  standing: { kind: 'not-stated' },
  bracket: { kind: 'not-drawn' },
  penaltyNumber: { kind: 'not-required' },
  groups: { kind: 'groups', yourOrdinal: 1, groups: [{ ...groupA, ordinal: 1 }] },
})

/**
 * ENTERED, AND HOLDING NO GROUP. `myGroupOrdinal` is null, which contract 167
 * distinguishes from there being no groups — so the tables are shown and none
 * is marked as the reader's.
 */
const groupsButNotYours = world({
  standing: { kind: 'not-stated' },
  bracket: { kind: 'not-drawn' },
  penaltyNumber: { kind: 'not-required' },
  groups: {
    kind: 'groups',
    yourOrdinal: null,
    groups: [
      { ...groupA, isYours: false, rows: groupA.rows.map((r) => ({ ...r, isYou: false })) },
      groupB,
    ],
  },
})

/** A knockout that never had a group stage. The panel says nothing, correctly. */
const noGroupStage = world({ groups: { kind: 'no-groups' } })

/** Contract 193 answered and contract 167 did not. One read's failure, alone. */
const groupsUnavailable = world({ groups: { kind: 'unavailable' } })

/* ==========================================================================
   THE REGISTRY
   ========================================================================== */

export const championshipScenarios = {
  drawnBracket,
  lostButNotStated,
  eliminatedInGroups,
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
  groupPhase,
  singleGroupPhase,
  groupsButNotYours,
  noGroupStage,
  groupsUnavailable,
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
  groupPhase:
    'The phase this page used to answer with one sentence. The knockout does not exist yet, and contract 167 holds two REAL group tables underneath it — the two reads disagreeing exactly as designed.',
  singleGroupPhase:
    'The same phase in a competition drawn as ONE group. Nothing about the surface assumes there are several.',
  groupsButNotYours:
    'Entered, and holding no group. Contract 167 distinguishes "you have no group" from "there are no groups", so the tables are shown and none is marked as the reader\u2019s.',
  noGroupStage:
    'A knockout that never had a group stage. `available: false` is the server saying so, and the panel stays silent rather than showing an empty table.',
  groupsUnavailable:
    'Contract 193 answered and contract 167 did not. ONE read failed, and the bracket beside it is still shown \u2014 which is what independent panel outcomes are for.',
  lostButNotStated:
    'The reader LOST their only tie and has no later one, and the read carried no outcome \u2014 a database behind contract 207. The page still says NOTHING about elimination. A derivation would print "you are out" here, and would be wrong whenever the competition has not finished eliminating.',
  eliminatedInGroups:
    'THE binding world since contract 207. Nothing on the page is shaped like a defeat \u2014 group phase, no knockout, no settled tie, no seed \u2014 and the reader is nonetheless told they are out, because the settlement authority says so. Every inference the surface could have made returns "still in" here.',
  walkover:
    'A walkover and an organiser-awarded walkover, side by side. Each is a word with NO score and NO reason: whether the opponent withdrew or was disqualified is not in this read.',
  everyDecision:
    'All four settlement vocabularies at once — points, extra time, Penalty Number, walkover — so a reviewer can see that none of them grows a scoreline.',
  youAreChampion:
    'The reader won it. The only world where the champion is them, and the standing says so because the server named them.',
  someoneElseWon:
    'Somebody else won it, and the read states that the reader is out. The sentence comes from the settlement column, not from the observation that the final carries a different name.',
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
