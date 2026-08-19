import type { ClubIdentityTokens } from '../../../domain/clubIdentity/clubIdentityTypes'
import { explainFixtureScore } from '../../../domain/season/scoring'
import { commandRefusal } from '../../../features/season/matchPredictorModel'
import type {
  MatchPredictorFixture,
  SeasonClubIdentity,
} from '../../../features/season/matchPredictorModel'
import { explainLock } from '../../../features/season/lockExplanation'
import type { SeasonClubForm } from '../../../services/supabase/seasonClubFormModel'
import type { CompetitionTableRow } from '../../../services/supabase/competitionTableModel'
import type { SeasonConsensusFixture } from '../../../services/supabase/seasonConsensusModel'
import type {
  ConsensusGroup,
  FormResult,
  PredictionOutcome,
  Scoreline,
  Team,
  TeamKitPattern,
} from '../../models/football'
import type {
  PredictorFixture,
  PredictorModel,
  PredictorPhase,
  PredictorSaveState,
  PredictorSide,
  PredictorUrgency,
} from '../../models/predictor'
import type { PredictorSource } from './predictorSource'

/**
 * `PredictorSource` → `PredictorModel`. PURE: no network, no storage, no clock,
 * no React.
 *
 * WHAT THIS FILE IS ALLOWED TO DO. Read answers and rename them. Every truth on
 * the page arrives already decided:
 *
 *   editability          `presentation.editable` — `presentCard`'s answer
 *   the lock and its copy `explainLock(card.lock)` — the application's words
 *   the deadline instant  `card.lock.lockAt` — the domain's resolved instant
 *   the Joker allowance   `card.joker.playable`, and `commandRefusal` for why not
 *   command legality      `commandRefusal`, the model that owns the answer
 *   the official result    `card.fixtures[].result`
 *   the verdict            `explainFixtureScore` — the shared rule with a parity
 *                          test against the database behind it
 *   the banked total       `card.settledPoints`
 *   consensus permission   the presence of `source.consensus`, and nothing else
 *   club identity          `domain/clubIdentity`'s resolved tokens
 *   club form              contract 141's own W/D/L letters
 *   league position        contract 160's own position
 *
 * WHAT IT IS NOT ALLOWED TO DO, and does not: compute a lock, compare a kickoff
 * to anything, award a point, decide a Joker's eligibility, or work out whether a
 * consensus may be revealed.
 *
 * THE ONLY ARITHMETIC IS COUNTING, and it is the class the Home mapper was
 * allowed — an accuracy split over one denominator. Two places do it: the
 * urgency band, which subtracts two instants that both arrived as inputs to
 * answer "how loud should the page be" and never "is this open"; and the settled
 * tally, which counts the rule's own verdicts. Neither produces a point value, a
 * rank or a permission.
 *
 * THE ONE NUMBER IT DELIBERATELY DOES NOT PRODUCE is a per-fixture points figure.
 * `explainFixtureScore` returns one and it is not used: contract 113's card
 * supplies no per-fixture value, so printing the rule's own number would be the
 * browser stating an awarded point. `matchweekPointsModel` refuses the same thing
 * in the same words — "where the two differ the player's standing follows the
 * server, so the breakdown does too".
 */

/* ------------------------------------------------------------------ *
 * Club identity
 * ------------------------------------------------------------------ */

/**
 * The domain's five kit shapes, carried across unflattened.
 *
 * A `sash` used to become `solid` here — honest, and a lost detail — because
 * `TeamCrest` knew four patterns and the domain had five. The crest learned the
 * fifth for Stage 14, so a sash club is drawn as one. Anything the domain adds
 * beyond these still falls to `solid`, because drawing an unknown pattern as a
 * known one would be presentation inventing a kit.
 */
const KIT_PATTERN: Record<string, TeamKitPattern> = {
  solid: 'solid',
  stripes: 'stripes',
  hoops: 'hoops',
  halves: 'halves',
  sash: 'sash',
}

/**
 * Domain club identity → vNext `Team`.
 *
 * THE NAME IS THE ID, exactly as on the Home path and for the same stated
 * reason: the card's fixtures carry a club's name and its identity tokens but no
 * team id, and this repository already joins these reads by name on the grounds
 * that both sides come from `public.teams.name` — the same column of the same
 * rows. Minting a synthetic id would be a second identity for one club.
 *
 * `accent` IS ONE OF THE CLUB'S OWN COLOURS and never a computed brighter shade;
 * `onPrimary` is carried through rather than guessed, because guessing it is
 * guessing at a contrast failure.
 */
function teamOf(club: SeasonClubIdentity): Team {
  const tokens: ClubIdentityTokens = club.tokens
  const primary = tokens.primary
  const secondary = tokens.secondary ?? primary

  return {
    id: club.name,
    name: club.name,
    shortName: club.shortName,
    abbreviation: tokens.monogram,
    colours: {
      primary,
      secondary,
      accent: secondary,
      onPrimary: tokens.onPrimary ?? 'light',
    },
    kitPattern: KIT_PATTERN[tokens.pattern ?? 'solid'] ?? 'solid',
    // No crest source is agreed anywhere in the application, and this stage calls
    // no provider. `TeamCrest` falls back to the monogram.
    crestUrl: null,
  }
}

const FORM_RESULT: Record<string, FormResult> = { W: 'win', D: 'draw', L: 'loss' }

/**
 * One side of a fixture: identity, the server's form letters and the table's own
 * position.
 *
 * FORM IS THE SERVER'S LETTERS, MAPPED ONE FOR ONE. Contract 141 derives W/D/L
 * from settled fixtures server-side and this does not re-read a goal difference
 * to second-guess who won. A club with nothing settled has an EMPTY run rather
 * than a padded one, and the record sentence is absent rather than "0 of 0" —
 * which at matchweek one is every club in the competition.
 *
 * THE RECORD SENTENCE IS OVER THE CLUB'S OWN PLAYED COUNT, not the window the
 * server was asked for, because a club that has played four inside a six-match
 * window has a record over four. That is `summariseClubForm`'s stated reasoning,
 * restated here rather than imported so the vNext model carries numbers and this
 * file carries the one sentence the panel prints.
 */
function sideOf(
  club: SeasonClubIdentity,
  form: SeasonClubForm | undefined,
  row: CompetitionTableRow | undefined,
): PredictorSide {
  const letters = form?.form ?? []
  const played = form?.played ?? 0

  return {
    team: teamOf(club),
    form: letters.flatMap((letter) => {
      const result = FORM_RESULT[letter]
      return result ? [result] : []
    }),
    formRecord:
      form && played > 0
        ? {
            record: `Won ${form.won}, drawn ${form.drawn}, lost ${form.lost} of the last ${played}`,
            goalDifference: signed(form.goalsFor - form.goalsAgainst),
            played,
          }
        : null,
    leaguePosition: row?.position ?? null,
  }
}

function signed(value: number): string {
  if (value > 0) return `+${value}`
  // A real minus sign, which lines up in the tabular figures the panel uses.
  if (value < 0) return `−${Math.abs(value)}`
  return '0'
}

/* ------------------------------------------------------------------ *
 * Consensus
 * ------------------------------------------------------------------ */

/**
 * Contract 130's three counts → the `ConsensusGroup` `ConsensusBar` already
 * draws.
 *
 * THE COHORT'S LABEL IS "EVERYONE" BECAUSE THAT IS THE COHORT. Contract 130's
 * group is the competition's entrants; there is no private-league consensus on
 * this path, so no friends group is produced and `ConsensusBar` is only ever
 * handed the community one. Inventing a second group from the same numbers would
 * be two labels over one sample.
 *
 * THE SHARES ARRIVE AS PERCENTAGES AND THE BAR WANTS 0–1, which is a unit
 * conversion rather than a derivation — the decoder already turned the server's
 * counts into rounded percentages, and re-deriving them from the counts here
 * would be a second answer to one question about one fixture.
 */
function consensusOf(fixture: SeasonConsensusFixture): ConsensusGroup {
  return {
    label: 'Everyone',
    sampleSize: fixture.predicted,
    popular: fixture.topScores.map((entry) => ({
      score: { home: entry.home, away: entry.away },
      share: fixture.predicted > 0 ? entry.picks / fixture.predicted : 0,
    })),
    homeWinShare: fixture.shares.homeWin / 100,
    drawShare: fixture.shares.draw / 100,
    awayWinShare: fixture.shares.awayWin / 100,
  }
}

/* ------------------------------------------------------------------ *
 * Verdicts, phases and urgency
 * ------------------------------------------------------------------ */

const VERDICT: Record<string, PredictionOutcome | null> = {
  exact_score: 'exact',
  correct_result: 'result',
  wrong: 'missed',
  // The rule neither awarded nor withheld anything, so there is no verdict.
  // Calling this "missed" would tell a player they predicted badly when they did
  // not predict at all.
  unscored: null,
}

/**
 * `CardState` → the page's composition.
 *
 * The order is the application's own ordering and the safety property with it: a
 * conflict outranks everything because the page is knowingly showing stale data,
 * an unresolvable lock outranks the card's progress, and locked outranks progress
 * for the same reason. This function does not re-establish that order — it reads
 * the state `presentCard` already decided with it.
 */
function phaseOf(state: string): PredictorPhase {
  if (state === 'conflict_requires_refresh') return 'conflict'
  if (state === 'unavailable') return 'unavailable'
  if (state === 'scored_final') return 'settled'
  if (state === 'locked') return 'locked'
  return 'open'
}

/**
 * How hard to shout about a deadline that the application has ALREADY said is
 * open.
 *
 * IT IS NEVER CONSULTED ABOUT WHETHER SOMETHING IS OPEN. `kind` decides that and
 * `kind` came from the server's resolved lock; this is only called when `kind`
 * is already `open`. What it answers is a question about layout, from two values
 * that both arrived as inputs. No clock is read, and the bands are deliberately
 * coarse — a boundary being an hour out changes how loud a border is and nothing
 * else. Same shape and same reasoning as `buildHomeModel`'s `urgencyOf`.
 */
function urgencyOf(lockAt: string | null, generatedAt: string): PredictorUrgency {
  if (lockAt === null) return 'calm'
  const lock = Date.parse(lockAt)
  const now = Date.parse(generatedAt)
  if (!Number.isFinite(lock) || !Number.isFinite(now)) return 'calm'

  const hours = (lock - now) / 3_600_000
  if (hours <= 2) return 'urgent'
  if (hours <= 24) return 'soon'
  return 'calm'
}

function scoreOf(value: { home: number; away: number } | null): Scoreline | null {
  return value === null ? null : { home: value.home, away: value.away }
}

/* ------------------------------------------------------------------ *
 * The mapping
 * ------------------------------------------------------------------ */

export function buildPredictorModel(source: PredictorSource): PredictorModel {
  const { card, presentation } = source
  const lock = explainLock(card.lock)
  const phase = phaseOf(presentation.state)

  const formByName = new Map((source.clubForm?.clubs ?? []).map((club) => [club.name, club]))
  const tableByName = new Map((source.table ?? []).map((row) => [row.teamName, row]))

  /**
   * CONSENSUS IS INDEXED ONLY WHERE THE SERVER OFFERED IT AT ALL.
   *
   * `suppressed` is contract 130's third way of saying no — too few entries to
   * reveal anybody — and it is treated exactly like a refusal and a failed read.
   * An empty map means every fixture's `consensus` is null and the panel draws
   * nothing. Nothing here looks at a lock, a clock or a kickoff to reach that.
   */
  const consensusById = new Map(
    source.consensus === null || source.consensus.suppressed
      ? []
      : source.consensus.fixtures.map((fixture) => [fixture.id, fixture]),
  )

  const fixtures = card.fixtures.map((fixture) =>
    fixtureOf(fixture, {
      editable: presentation.editable,
      phase,
      save: saveStateOf(source.saveStatus[fixture.fixtureId]),
      form: formByName,
      table: tableByName,
      consensus: consensusById,
    }),
  )

  const jokerRefusal = commandRefusal(
    presentation,
    { kind: 'setJoker', played: !card.joker.playedHere },
    card.joker,
  )
  const confirmRefusal = commandRefusal(presentation, { kind: 'confirmCard' }, card.joker)

  return {
    generatedAt: source.generatedAt,
    competition: {
      name: source.competition.name,
      seasonLabel: source.competition.seasonLabel,
      // No application source holds a competition palette. `VNextShell` already
      // accepts null and falls back to its own plain canvas.
      colours: null,
    },
    matchweek: {
      number: card.matchweek.number,
      of: card.matchweek.of,
      // The card read states a NUMBER and no round wording, so this is the same
      // label the legacy Match Predictor prints. A competition whose rounds have
      // their own names would need that to arrive on this read first.
      label: `Matchweek ${card.matchweek.number}`,
    },
    lock: {
      kind: lock.kind,
      urgency: lock.kind === 'open' ? urgencyOf(card.lock.lockAt, source.generatedAt) : null,
      label: lock.label,
      detail: lock.detail,
      retryable: lock.retryable,
      at: card.lock.lockAt,
    },
    phase,
    editable: presentation.editable,
    progress: { entered: presentation.entered, total: presentation.total },
    atLock: presentation.atLock === 'banks_entered' ? 'banksEntered' : presentation.atLock,
    joker: {
      playedHere: card.joker.playedHere,
      remainingThisHalf: card.joker.remainingThisHalf,
      playable: card.joker.playable,
      refusal: jokerRefusal,
    },
    confirm: !presentation.editable
      ? { state: 'absent', refusal: null }
      : card.cardStatus === 'confirmed'
        ? { state: 'confirmed', refusal: null }
        : confirmRefusal !== null
          ? { state: 'refused', refusal: confirmRefusal }
          : { state: 'available', refusal: null },
    settledPoints: card.settledPoints,
    tally: tallyOf(card.settledPoints, card.cardStatus, fixtures),
    fixtures,
    notice: noticeOf(phase, lock, source.refusal),
    enrichment: {
      form: source.clubForm !== null,
      table: source.table !== null,
      // Refused, suppressed and unread are one answer as far as the page is
      // concerned: there is no crowd to show.
      consensus: consensusById.size > 0,
    },
  }
}

function saveStateOf(status: string | undefined): PredictorSaveState {
  return status === 'saving' || status === 'saved' || status === 'error' || status === 'conflict'
    ? status
    : 'idle'
}

function fixtureOf(
  fixture: MatchPredictorFixture,
  context: {
    editable: boolean
    phase: PredictorPhase
    save: PredictorSaveState
    form: Map<string, SeasonClubForm>
    table: Map<string, CompetitionTableRow>
    consensus: Map<string, SeasonConsensusFixture>
  },
): PredictorFixture {
  const prediction = scoreOf(fixture.prediction)
  const result = scoreOf(fixture.result)
  const consensus = context.consensus.get(fixture.fixtureId)

  /**
   * A FIXTURE WITH AN OFFICIAL RESULT IS NOT EDITABLE, whatever the card says.
   *
   * The card's `editable` is the authority and this only ever NARROWS it: an
   * official result means the platform has settled the fixture, which `result`'s
   * own contract states in terms — "present only once the fixture has been
   * settled". The AND cannot make anything editable that the application said was
   * not, which is the property that matters.
   */
  const editable = context.editable && result === null

  return {
    id: fixture.fixtureId,
    // The gateway maps an absent kickoff to an empty string; the model wants a
    // real null, so the surface can say "to be confirmed" rather than formatting
    // nothing. Note that a matchweek containing one cannot be open at all —
    // `resolveLockState` fails the whole scope closed on an unparseable kickoff.
    kickoff: fixture.kickoffAt === '' ? null : fixture.kickoffAt,
    home: sideOf(
      fixture.home,
      context.form.get(fixture.home.name),
      context.table.get(fixture.home.name),
    ),
    away: sideOf(
      fixture.away,
      context.form.get(fixture.away.name),
      context.table.get(fixture.away.name),
    ),
    prediction,
    result,
    // The server's figure, which contract 113 does not supply per fixture. Null,
    // and never `explainFixtureScore`'s own number.
    points: fixture.points,
    verdict:
      result === null || prediction === null
        ? null
        : (VERDICT[explainFixtureScore(prediction, result).reason] ?? null),
    state:
      result !== null
        ? 'settled'
        : !editable
          ? 'locked'
          : prediction === null
            ? 'empty'
            : 'entered',
    editable,
    save: context.save,
    consensus: consensus ? consensusOf(consensus) : null,
  }
}

/**
 * The settled split, counted from the rule's own verdicts.
 *
 * UNBANKED IS NOT "EVERY FIXTURE SCORED ZERO". A player who never entered the
 * matchweek banked nothing at the lock, and itemising ten misses against
 * predictions they never made would be a breakdown of a thing that did not
 * happen. `presentMatchweekPoints` draws the same line for the same reason, and
 * this returns null so the page prints the banked total and no split.
 */
function tallyOf(
  settledPoints: number | null,
  cardStatus: string,
  fixtures: readonly PredictorFixture[],
): PredictorModel['tally'] {
  if (settledPoints === null) return null
  if (cardStatus === 'no_submission') return null

  let exact = 0
  let result = 0
  let missed = 0
  let blank = 0

  for (const fixture of fixtures) {
    if (fixture.result === null) continue
    if (fixture.prediction === null) blank += 1
    else if (fixture.verdict === 'exact') exact += 1
    else if (fixture.verdict === 'result') result += 1
    else missed += 1
  }

  return { exact, result, missed, blank }
}

/**
 * The page-level notice, in the APPLICATION's words.
 *
 * Three genuinely different sentences, and the order matters for the same reason
 * `presentCard`'s does: a conflict is the loudest because the page is knowingly
 * showing data the server has already changed. A refused command is the quietest
 * and is not an error at all — it is the application declining something the
 * player asked for, and its reason is `commandRefusal`'s own text.
 */
function noticeOf(
  phase: PredictorPhase,
  lock: { label: string; detail: string; retryable: boolean },
  refusal: string | null,
): PredictorModel['notice'] {
  if (phase === 'conflict') {
    return {
      tone: 'error',
      title: 'This matchweek changed somewhere else',
      body: 'Your predictions were edited on another device, so this page is out of date. Reload it to see the saved version before editing again.',
      // A version conflict is terminal, so the way out is a re-read and never a
      // retry of the write that lost.
      retryable: true,
    }
  }
  if (phase === 'unavailable') {
    return { tone: 'warn', title: lock.label, body: lock.detail, retryable: lock.retryable }
  }
  if (refusal !== null) {
    return { tone: 'warn', title: 'That is not possible right now', body: refusal, retryable: false }
  }
  return null
}
