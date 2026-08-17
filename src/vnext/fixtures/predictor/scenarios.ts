/**
 * THE DETERMINISTIC STATES THE MATCH PREDICTOR IS REVIEWED IN.
 *
 * All nine are one `PredictorModel` schema over one matchweek of football. What
 * differs between them is the player's own position in it and what the
 * application says about the card — which is the point: the page has one
 * composition, and every state below is that composition telling the truth about
 * a different moment.
 *
 * WHAT MAKES THESE HONEST RATHER THAN CONVENIENT. Every field is filled in as the
 * real application could actually state it, and where it could not, it is null:
 *
 *   - no fixture carries a per-fixture points figure, in ANY scenario, including
 *     the settled one, because contract 113's card supplies none. A settled
 *     fixture shows the result, the prediction and the rule's verdict, and the
 *     matchweek total appears once;
 *   - consensus is absent from every OPEN scenario, because the server refuses it
 *     before the matchweek locks. It appears in `locked` and `settled` and
 *     nowhere else. That is the reveal boundary being consumed, and a scenario
 *     that showed a crowd split on an open card would be teaching the surface a
 *     rule the server does not have;
 *   - `unavailable` is caused by a fixture with no kickoff, which is what
 *     genuinely causes it — `resolveLockState` fails the whole scope closed on an
 *     unparseable kickoff. It is not an `unavailable` flag pasted onto an
 *     otherwise fine card.
 *
 * NOTHING HERE READS A CLOCK. The deadline is fixed and `generatedAt` moves
 * around it, so `open` and `closing` are the same card nineteen hours and
 * eighty-five minutes out. The urgency is stated per scenario rather than
 * computed, exactly as the real mapper states it.
 */

import type { ConsensusGroup, Scoreline } from '../../models/football'
import type {
  PredictorFixture,
  PredictorModel,
  PredictorSide,
} from '../../models/predictor'
import {
  MATCHWEEK_LOCK_AT,
  PREDICTOR_NOW,
  PREDICTOR_NOW_SETTLED,
  PREDICTOR_NOW_URGENT,
  bareSide,
  matchweekFootball,
} from './matchweek'

const COMPETITION = {
  name: 'Caledonian Premiership',
  seasonLabel: '2027/28',
  // Null everywhere, because the application holds no competition palette. The
  // shell falls back to its own plain canvas, which is what real data does too.
  colours: null,
} as const

const MATCHWEEK = { number: 4, of: 38, label: 'Matchweek 4' } as const

const ENRICHED = { form: true, table: true, consensus: true } as const

/** The application's own copy for an open matchweek, from `lockExplanation.ts`. */
const OPEN_LOCK = {
  kind: 'open' as const,
  label: 'Open',
  detail: 'Your predictions for this matchweek are saved as you enter them.',
  retryable: false,
  at: MATCHWEEK_LOCK_AT,
}

const CLOSED_LOCK = {
  kind: 'closed' as const,
  urgency: null,
  label: 'Locked',
  detail: 'This matchweek locked at its first kickoff. Your saved predictions stand.',
  retryable: false,
  at: MATCHWEEK_LOCK_AT,
}

/**
 * Predictions by fixture index, so a scenario is a list of scorelines rather than
 * ten hand-written fixtures. `null` is a fixture the player has not filled in.
 */
type Picks = readonly (Scoreline | null)[]

const scores = (...pairs: readonly (readonly [number, number] | null)[]): Picks =>
  pairs.map((pair) => (pair === null ? null : { home: pair[0], away: pair[1] }))

/**
 * The official results, for the matchweek that has been played. Fixed, and the
 * verdicts below are the domain rule's answers over these and the picks — written
 * out rather than computed here, because a fixture file must not run a rule.
 */
const RESULTS: Picks = scores(
  [2, 0],
  [3, 1],
  [1, 1],
  [0, 2],
  [2, 1],
  [1, 0],
  [1, 2],
  [0, 0],
  [3, 2],
  [1, 1],
)

/**
 * Two crowd splits, for the two fixtures where the crowd is worth seeing: one
 * where it is overwhelmingly one way, and one where the player has gone against
 * it. Contract 130 returns three counts and its own top scorelines; these are
 * shaped exactly as the adapter maps them.
 */
const CONSENSUS: Readonly<Record<number, ConsensusGroup>> = {
  1: {
    label: 'Everyone',
    sampleSize: 2140,
    popular: [
      { score: { home: 2, away: 0 }, share: 0.19 },
      { score: { home: 3, away: 1 }, share: 0.16 },
      { score: { home: 2, away: 1 }, share: 0.14 },
    ],
    homeWinShare: 0.71,
    drawShare: 0.18,
    awayWinShare: 0.11,
  },
  3: {
    label: 'Everyone',
    sampleSize: 2098,
    popular: [
      { score: { home: 1, away: 1 }, share: 0.22 },
      { score: { home: 1, away: 2 }, share: 0.17 },
      { score: { home: 0, away: 1 }, share: 0.12 },
    ],
    homeWinShare: 0.26,
    drawShare: 0.31,
    awayWinShare: 0.43,
  },
}

type FixtureOptions = {
  readonly picks: Picks
  readonly editable: boolean
  readonly state: PredictorFixture['state']
  readonly settled?: boolean
  readonly consensus?: boolean
  /** Strip form, records and positions, for the reduced-data scenario. */
  readonly bare?: boolean
  /** Per-fixture save state, by index. Everything unnamed is idle. */
  readonly saving?: Readonly<Record<number, PredictorFixture['save']>>
  /** Drop this fixture's kickoff, which is what fails a matchweek closed. */
  readonly withoutKickoff?: number
}

/**
 * The rule's verdict for a settled fixture, written out per index rather than
 * derived. A fixture file that ran `explainFixtureScore` would be a fixture file
 * with a rule in it; these are the answers, and the mapper's own test is where
 * the rule is checked.
 */
const VERDICTS: Readonly<Record<number, PredictorFixture['verdict']>> = {
  0: 'exact',
  1: 'result',
  2: 'exact',
  3: 'missed',
  4: 'result',
  5: 'result',
  6: 'missed',
  7: 'exact',
  8: 'missed',
  9: null,
}

function fixtures(options: FixtureOptions): readonly PredictorFixture[] {
  return matchweekFootball.map((football, index) => {
    const prediction = options.picks[index] ?? null
    const result = options.settled ? (RESULTS[index] ?? null) : null
    const home: PredictorSide = options.bare ? bareSide(football.home) : football.home
    const away: PredictorSide = options.bare ? bareSide(football.away) : football.away

    return {
      id: football.id,
      kickoff: options.withoutKickoff === index ? null : football.kickoff,
      home,
      away,
      prediction,
      result,
      // Null in every scenario, in every state. The application states no
      // per-fixture figure and a fixture file must not invent the one number the
      // page is most tempted to show.
      points: null,
      verdict: options.settled ? (prediction === null ? null : (VERDICTS[index] ?? null)) : null,
      state: prediction === null && options.state === 'entered' ? 'empty' : options.state,
      editable: options.editable,
      save: options.saving?.[index] ?? 'idle',
      consensus: options.consensus ? (CONSENSUS[index] ?? null) : null,
    }
  })
}

function countEntered(picks: Picks): number {
  return picks.filter((pick) => pick !== null).length
}

/* ------------------------------------------------------------------ *
 * A. Open, and a long way from finished
 * ------------------------------------------------------------------ */

const OPEN_PICKS = scores([2, 1], null, null, [1, 1], null, null, null, [0, 0], null, null)

/**
 * Friday evening. Three of ten entered, the deadline is nineteen hours away, and
 * the Joker has not been played. This is the state the page is designed for and
 * the one most of its work happens in.
 */
export const openPredictorModel: PredictorModel = {
  generatedAt: PREDICTOR_NOW,
  competition: COMPETITION,
  matchweek: MATCHWEEK,
  lock: { ...OPEN_LOCK, urgency: 'soon' },
  phase: 'open',
  editable: true,
  progress: { entered: countEntered(OPEN_PICKS), total: matchweekFootball.length },
  atLock: 'banksEntered',
  joker: { playedHere: false, remainingThisHalf: 4, playable: true, refusal: null },
  confirm: { state: 'available', refusal: null },
  settledPoints: null,
  tally: null,
  fixtures: fixtures({ picks: OPEN_PICKS, editable: true, state: 'entered' }),
  notice: null,
  enrichment: ENRICHED,
}

/* ------------------------------------------------------------------ *
 * A2. Open, and not started at all
 * ------------------------------------------------------------------ */

const NO_PICKS: Picks = scores(null, null, null, null, null, null, null, null, null, null)

/**
 * The first visit. Nothing entered, and `atLock` is `unbanked` rather than
 * `banksEntered`.
 *
 * IT IS A DIFFERENT SENTENCE AND THAT IS THE WHOLE REASON THIS SCENARIO EXISTS.
 * `cardSubmission.ts` keeps "never engaged" apart from "engaged and left blank"
 * because they bank different things, and a card that told a player who has not
 * started that it would "bank the 0 you have entered" would be technically true
 * and useless. `confirm` is refused for the same reason, in the application's own
 * words.
 */
export const untouchedPredictorModel: PredictorModel = {
  generatedAt: PREDICTOR_NOW,
  competition: COMPETITION,
  matchweek: MATCHWEEK,
  lock: { ...OPEN_LOCK, urgency: 'soon' },
  phase: 'open',
  editable: true,
  progress: { entered: 0, total: matchweekFootball.length },
  atLock: 'unbanked',
  joker: { playedHere: false, remainingThisHalf: 5, playable: true, refusal: null },
  confirm: {
    state: 'refused',
    refusal: 'Enter at least one prediction before confirming the card.',
  },
  settledPoints: null,
  tally: null,
  fixtures: fixtures({ picks: NO_PICKS, editable: true, state: 'empty' }),
  notice: null,
  enrichment: ENRICHED,
}

/* ------------------------------------------------------------------ *
 * B. Open, nearly done, and the deadline is close
 * ------------------------------------------------------------------ */

const CLOSING_PICKS = scores(
  [2, 1],
  [3, 0],
  [1, 1],
  [1, 1],
  [2, 0],
  [1, 2],
  null,
  [0, 0],
  [2, 1],
  [1, 1],
)

/**
 * Saturday morning, eighty-five minutes out, nine of ten entered and the Joker
 * played. The urgency is `urgent`, the jump control says "go to the last
 * fixture", and one row is mid-save so the save states are reviewable in the
 * state they actually occur in.
 */
export const closingPredictorModel: PredictorModel = {
  generatedAt: PREDICTOR_NOW_URGENT,
  competition: COMPETITION,
  matchweek: MATCHWEEK,
  lock: { ...OPEN_LOCK, urgency: 'urgent' },
  phase: 'open',
  editable: true,
  progress: { entered: countEntered(CLOSING_PICKS), total: matchweekFootball.length },
  atLock: 'banksEntered',
  joker: { playedHere: true, remainingThisHalf: 3, playable: true, refusal: null },
  confirm: { state: 'available', refusal: null },
  settledPoints: null,
  tally: null,
  fixtures: fixtures({
    picks: CLOSING_PICKS,
    editable: true,
    state: 'entered',
    saving: { 4: 'saving', 8: 'error' },
  }),
  notice: null,
  enrichment: ENRICHED,
}

/* ------------------------------------------------------------------ *
 * C. Complete, confirmed, and still editable
 * ------------------------------------------------------------------ */

const FULL_PICKS = scores(
  [2, 1],
  [3, 0],
  [1, 1],
  [1, 1],
  [2, 0],
  [1, 2],
  [0, 1],
  [0, 0],
  [2, 1],
  [1, 1],
)

/**
 * Every fixture entered, the card confirmed, and the deadline still ahead.
 *
 * THE STATE THE PAGE MOST HAS TO GET RIGHT AND MOST EASILY GETS WRONG. Confirmed
 * is not locked: the copy says so in terms, every control is still there, and the
 * progress track is complete rather than absent. A page that calmed down into a
 * read-only receipt here would be telling a player they cannot change their mind
 * when they can.
 */
export const completePredictorModel: PredictorModel = {
  generatedAt: PREDICTOR_NOW,
  competition: COMPETITION,
  matchweek: MATCHWEEK,
  lock: { ...OPEN_LOCK, urgency: 'soon' },
  phase: 'open',
  editable: true,
  progress: { entered: matchweekFootball.length, total: matchweekFootball.length },
  atLock: 'banksEntered',
  joker: { playedHere: true, remainingThisHalf: 3, playable: true, refusal: null },
  confirm: { state: 'confirmed', refusal: null },
  settledPoints: null,
  tally: null,
  fixtures: fixtures({ picks: FULL_PICKS, editable: true, state: 'entered' }),
  notice: null,
  enrichment: ENRICHED,
}

/* ------------------------------------------------------------------ *
 * D. Locked
 * ------------------------------------------------------------------ */

const LOCKED_PICKS = scores(
  [2, 1],
  [3, 0],
  [1, 1],
  [1, 1],
  [2, 0],
  [1, 2],
  null,
  [0, 0],
  [2, 1],
  null,
)

/**
 * The deadline has passed. Eight of ten were entered, two were not, and nothing
 * on the page is editable.
 *
 * THERE IS NOT A SINGLE DISABLED CONTROL IN THIS STATE. Every score box, stepper
 * and clear button is ABSENT from the markup and the scorelines are text; the
 * Joker is a sentence; the confirm action is gone. And the crowd split appears
 * here for the first time, because the server offers consensus once the matchweek
 * locks — which the surface consumes and never works out for itself.
 */
export const lockedPredictorModel: PredictorModel = {
  generatedAt: '2027-08-21T12:10:00.000Z',
  competition: COMPETITION,
  matchweek: MATCHWEEK,
  lock: CLOSED_LOCK,
  phase: 'locked',
  editable: false,
  progress: { entered: countEntered(LOCKED_PICKS), total: matchweekFootball.length },
  atLock: null,
  joker: {
    playedHere: true,
    remainingThisHalf: 3,
    playable: false,
    refusal: 'This matchweek is locked.',
  },
  confirm: { state: 'absent', refusal: null },
  settledPoints: null,
  tally: null,
  fixtures: fixtures({
    picks: LOCKED_PICKS,
    editable: false,
    state: 'locked',
    consensus: true,
  }),
  notice: null,
  enrichment: ENRICHED,
}

/* ------------------------------------------------------------------ *
 * E. Settled
 * ------------------------------------------------------------------ */

/**
 * The Monday after. Every fixture has an official result, the matchweek has been
 * scored, and the Joker doubled it.
 *
 * ONE TOTAL, AND IT IS THE SERVER'S. `settledPoints` is the banked figure. No
 * fixture carries a points value, because the application supplies none per
 * fixture; each row shows the result, what the player said and the rule's verdict,
 * and the total appears once beneath them. The tally counts the verdicts and
 * keeps `blank` apart from `missed`, because the rule neither awards nor withholds
 * anything for a prediction that was never made.
 */
export const settledPredictorModel: PredictorModel = {
  generatedAt: PREDICTOR_NOW_SETTLED,
  competition: COMPETITION,
  matchweek: MATCHWEEK,
  lock: CLOSED_LOCK,
  phase: 'settled',
  editable: false,
  progress: { entered: countEntered(LOCKED_PICKS), total: matchweekFootball.length },
  atLock: null,
  joker: {
    playedHere: true,
    remainingThisHalf: 3,
    playable: false,
    refusal: 'This matchweek is locked.',
  },
  confirm: { state: 'absent', refusal: null },
  settledPoints: 34,
  tally: { exact: 3, result: 3, missed: 2, blank: 2 },
  fixtures: fixtures({
    picks: LOCKED_PICKS,
    editable: false,
    state: 'settled',
    settled: true,
    consensus: true,
  }),
  notice: null,
  enrichment: ENRICHED,
}

/* ------------------------------------------------------------------ *
 * F. Reduced — every optional enrichment absent at once
 * ------------------------------------------------------------------ */

/**
 * The same open card with no form, no league table and no consensus, because none
 * of those reads answered.
 *
 * WHAT TO LOOK FOR. Not "does it render". The question is whether the row keeps
 * its shape and loses its claims: no empty run of five pills, no "0" where a
 * position is unknown, no blank consensus panel, and two different sentences for
 * "this club has not played" and "we could not read the form" — because the first
 * is football and the second is this build. `enrichment` is what keeps them apart.
 */
export const reducedPredictorModel: PredictorModel = {
  generatedAt: PREDICTOR_NOW,
  competition: COMPETITION,
  matchweek: MATCHWEEK,
  lock: { ...OPEN_LOCK, urgency: 'soon' },
  phase: 'open',
  editable: true,
  progress: { entered: countEntered(OPEN_PICKS), total: matchweekFootball.length },
  atLock: 'banksEntered',
  joker: { playedHere: false, remainingThisHalf: 4, playable: true, refusal: null },
  confirm: { state: 'available', refusal: null },
  settledPoints: null,
  tally: null,
  fixtures: fixtures({ picks: OPEN_PICKS, editable: true, state: 'entered', bare: true }),
  notice: null,
  enrichment: { form: false, table: false, consensus: false },
}

/* ------------------------------------------------------------------ *
 * G. Unavailable — the lock could not be resolved
 * ------------------------------------------------------------------ */

/**
 * A fail-closed matchweek, and the fixture with no kickoff is what caused it.
 *
 * THIS IS NOT A DEADLINE. `lockExplanation.ts` exists to keep that distinction —
 * three of the domain's eight reasons mean the lock arithmetic could not be
 * trusted — so the page says the deadline is unconfirmed, offers a reload because
 * this one is retryable, and shows no countdown at all. Telling a player
 * "predictions are closed" here would be a lie of omission.
 */
export const unavailablePredictorModel: PredictorModel = {
  generatedAt: PREDICTOR_NOW,
  competition: COMPETITION,
  matchweek: MATCHWEEK,
  lock: {
    kind: 'unavailable',
    urgency: null,
    label: 'Unavailable',
    detail:
      'This matchweek’s fixture data does not make sense, so it is closed rather than accepting predictions we could not score.',
    retryable: true,
    at: null,
  },
  phase: 'unavailable',
  editable: false,
  progress: { entered: countEntered(OPEN_PICKS), total: matchweekFootball.length },
  atLock: null,
  joker: {
    playedHere: false,
    remainingThisHalf: 4,
    playable: false,
    refusal: 'This matchweek is unavailable, so it cannot be edited.',
  },
  confirm: { state: 'absent', refusal: null },
  settledPoints: null,
  tally: null,
  fixtures: fixtures({
    picks: OPEN_PICKS,
    editable: false,
    state: 'locked',
    withoutKickoff: 9,
  }),
  notice: {
    tone: 'warn',
    title: 'Unavailable',
    body: 'This matchweek’s fixture data does not make sense, so it is closed rather than accepting predictions we could not score.',
    retryable: true,
  },
  enrichment: ENRICHED,
}

/* ------------------------------------------------------------------ *
 * H. Conflict — the card moved somewhere else
 * ------------------------------------------------------------------ */

/**
 * The player edited this matchweek on another device, so what is on screen is
 * behind what the server holds.
 *
 * IT OFFERS A RELOAD AND NOT A RETRY. A version conflict is terminal —
 * "guessing which side wins is exactly what a conflict means we cannot do" — so
 * every control is gone and the only way forward is to go and see what the server
 * actually has.
 */
export const conflictPredictorModel: PredictorModel = {
  generatedAt: PREDICTOR_NOW,
  competition: COMPETITION,
  matchweek: MATCHWEEK,
  lock: { ...OPEN_LOCK, urgency: 'soon' },
  phase: 'conflict',
  editable: false,
  progress: { entered: countEntered(OPEN_PICKS), total: matchweekFootball.length },
  atLock: null,
  joker: {
    playedHere: false,
    remainingThisHalf: 4,
    playable: false,
    refusal: 'This matchweek changed somewhere else. Reload it before editing.',
  },
  confirm: { state: 'absent', refusal: null },
  settledPoints: null,
  tally: null,
  fixtures: fixtures({
    picks: OPEN_PICKS,
    editable: false,
    state: 'locked',
    saving: { 0: 'conflict' },
  }),
  notice: {
    tone: 'error',
    title: 'This matchweek changed somewhere else',
    body: 'Your predictions were edited on another device, so this page is out of date. Reload it to see the saved version before editing again.',
    retryable: true,
  },
  enrichment: ENRICHED,
}

/* ------------------------------------------------------------------ *
 * I. No fixtures published
 * ------------------------------------------------------------------ */

/**
 * A matchweek with no football in it yet, which is an ordinary early-season
 * state rather than a failure. There is no countdown, because there is no first
 * kickoff to count to.
 */
export const emptyPredictorModel: PredictorModel = {
  generatedAt: PREDICTOR_NOW,
  competition: COMPETITION,
  matchweek: { number: 12, of: 38, label: 'Matchweek 12' },
  lock: {
    kind: 'unavailable',
    urgency: null,
    label: 'Unavailable',
    detail:
      'We cannot confirm this matchweek’s deadline yet, so it is closed for now rather than guessed at.',
    retryable: true,
    at: null,
  },
  phase: 'unavailable',
  editable: false,
  progress: { entered: 0, total: 0 },
  atLock: null,
  joker: {
    playedHere: false,
    remainingThisHalf: 4,
    playable: false,
    refusal: 'This matchweek is unavailable, so it cannot be edited.',
  },
  confirm: { state: 'absent', refusal: null },
  settledPoints: null,
  tally: null,
  fixtures: [],
  notice: null,
  enrichment: { form: false, table: false, consensus: false },
}

export const predictorScenarios = {
  untouched: untouchedPredictorModel,
  open: openPredictorModel,
  closing: closingPredictorModel,
  complete: completePredictorModel,
  locked: lockedPredictorModel,
  settled: settledPredictorModel,
  reduced: reducedPredictorModel,
  unavailable: unavailablePredictorModel,
  conflict: conflictPredictorModel,
  empty: emptyPredictorModel,
} as const

export type PredictorScenarioName = keyof typeof predictorScenarios
