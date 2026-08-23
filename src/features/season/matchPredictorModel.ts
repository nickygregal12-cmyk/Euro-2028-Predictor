import type { ClubIdentityTokens } from '../../domain/clubIdentity/clubIdentityTypes'
import type { ResolvedLockState } from '../../domain/competition/lockState'
import type { CardStatus } from '../../domain/season/cardSubmission'
import type { ScorelinePrediction } from '../../domain/season/scoring'
import { type LockExplanation, explainLock } from './lockExplanation'
import type { PredictionBatchResult } from '../../services/supabase/seasonPredictionBatchModel'

/**
 * The page contract for the season Match Predictor.
 *
 * This is the seam the modernisation plan's §13.4 requires: a typed read model
 * and explicit commands, so components render data and never reach for storage.
 * Everything below is pure — the gateway that fetches and writes is an
 * interface, and the state machine is arithmetic over what it returned.
 *
 * WHY A GATEWAY RATHER THAN A SUPABASE CALL. There is currently no browser path
 * to season data at all: `season_fixtures`, `season_predictions` and
 * `season_matchweek_jokers` each have RLS enabled with every grant revoked from
 * `authenticated`, and the only season function exposed to a browser role is
 * `get_season_leaderboard`. The fixtures migration says so in terms — reads
 * "arrive through a bounded RPC when the season surfaces land". So the data
 * path is a declared interface with a fixture-backed implementation today, and
 * the bounded-RPC implementation drops in behind it without the page changing.
 * Writing the page against a seam is what makes that substitution boring.
 *
 * THE STATE MACHINE IS THE PLAN'S, NOT AN INVENTION. §12.1 fixes the states and
 * the Match Predictor lock branch: an interacted card banks the fixtures the
 * player entered, blanks score zero, and an untouched matchweek is UNBANKED.
 * Contract 82 and ADR 0012's amendment removed prefills and lock-time
 * completion, so there is no state in which the surface fills something in for
 * the player. `src/domain/season/cardSubmission.ts` is the authority for what
 * happens at the lock instant; this module decides only what to render before
 * it, and never recomputes a lock or a score.
 */

export type SeasonClubIdentity = {
  name: string
  shortName: string
  tokens: ClubIdentityTokens
}

/** One fixture as the page needs it: identity, kickoff, the player's own entry. */
export type MatchPredictorFixture = {
  fixtureId: string
  kickoffAt: string
  home: SeasonClubIdentity
  away: SeasonClubIdentity
  /** The player's saved prediction, or null where they left it blank. */
  prediction: ScorelinePrediction | null
  /** Confirmed official result, present only once the fixture has been settled. */
  result: ScorelinePrediction | null
  /** Points this fixture was awarded, present only alongside a settled result. */
  points: number | null
  /**
   * Contract 212. THE INSTANT THIS FIXTURE LOCKS, as the database publishes it,
   * and whether that instant has already passed.
   *
   * Both, rather than one, because two of the authority's answers have no
   * printable instant: a void or abandoned fixture is locked forever, and a
   * postponement with no announced replacement date is open indefinitely.
   * `lockAt` is null in both, and `locked` carries the truth. A surface that
   * needs to PRINT a deadline uses `lockAt`; one that needs to decide whether to
   * accept an edit uses `locked`.
   *
   * OPTIONAL, AND THE OPTIONALITY IS THE ROLLOUT. A gateway reading a database
   * that has not yet crossed contract 212 publishes neither, and everything
   * downstream falls back to the matchweek-wide lock — which is exactly what it
   * did before this field existed. The fallback is the old behaviour rather than
   * an open surface, so the gap between merge and rollout cannot invite an edit
   * the database would refuse.
   */
  lockAt?: string | null | undefined
  locked?: boolean | undefined
}

export type MatchweekJoker = {
  /** Whether the player has played their Joker on this matchweek. */
  playedHere: boolean
  /** Jokers left in the half this matchweek belongs to. */
  remainingThisHalf: number
  /** Whether the allowance permits playing one here at all. */
  playable: boolean
}

/** Everything one matchweek page renders, and nothing about how. */
export type MatchPredictorPage = {
  competition: {
    name: string
    seasonLabel: string
    timeZone: string
  }
  matchweek: {
    number: number
    of: number
  }
  fixtures: readonly MatchPredictorFixture[]
  cardStatus: CardStatus
  /**
   * Contract 214. Server evidence for the CURRENT confirmation only.
   *
   * Optional during the repository/hosted rollout gap. A client reading a
   * database below contract 214 has neither field and must not manufacture a
   * timestamp or reference from its own clock.
   */
  confirmedAt?: string | null | undefined
  confirmationReference?: string | null | undefined
  lock: ResolvedLockState
  joker: MatchweekJoker
  /** Total points for this matchweek once settled, else null. */
  settledPoints: number | null
}

/**
 * The authoritative card states from §12.1, plus the two exceptional ones this
 * surface can actually reach.
 *
 * `active_empty` and `not_created` are deliberately separate. A player who has
 * never touched the matchweek is unbanked at lock; one who opened it and saved
 * nothing is also unbanked — but the ledger distinguishes "never engaged" from
 * "engaged and left blank", and so does the copy.
 */
export type CardState =
  | 'not_created'
  | 'active_empty'
  | 'active_in_progress'
  | 'active_complete'
  | 'locked'
  | 'scored_final'
  | 'conflict_requires_refresh'
  | 'unavailable'

export type CardPresentation = {
  state: CardState
  lock: LockExplanation
  /** Fixtures the player has filled in. */
  entered: number
  /** Fixtures on the card. */
  total: number
  /**
   * What happens to this card at the lock instant, in the player's terms. Null
   * once the lock has passed, because it is no longer a prediction about the
   * future.
   */
  atLock: 'unbanked' | 'banks_entered' | null
  /** Whether score inputs accept edits. */
  editable: boolean
}

function enteredCount(fixtures: readonly MatchPredictorFixture[]): number {
  return fixtures.filter((fixture) => fixture.prediction !== null).length
}

/**
 * Derive what the card is, from the page read model.
 *
 * Order matters and is the safety property: a conflict outranks everything
 * because the page is knowingly showing stale data; an unresolvable lock
 * outranks the card's own progress because the surface must not invite edits it
 * cannot honour; and `locked` outranks progress for the same reason. Only once
 * the surface is genuinely open does the player's own progress decide.
 */
export function presentCard(page: MatchPredictorPage, hasConflict: boolean): CardPresentation {
  const lock = explainLock(page.lock)
  const entered = enteredCount(page.fixtures)
  const total = page.fixtures.length
  const base = { lock, entered, total }

  if (hasConflict) {
    return { ...base, state: 'conflict_requires_refresh', atLock: null, editable: false }
  }

  if (lock.kind === 'unavailable') {
    return { ...base, state: 'unavailable', atLock: null, editable: false }
  }

  if (lock.kind === 'closed') {
    const settled = page.settledPoints !== null
    return {
      ...base,
      state: settled ? 'scored_final' : 'locked',
      atLock: null,
      editable: false,
    }
  }

  // Open. What happens at the lock is decided by whether the player engaged at
  // all, which is exactly the rule `resolveCardAtLock` applies for real.
  const untouched = page.cardStatus === 'no_submission'
  const atLock = untouched ? ('unbanked' as const) : ('banks_entered' as const)

  if (untouched) {
    return { ...base, state: 'not_created', atLock, editable: true }
  }
  if (entered === 0) {
    return { ...base, state: 'active_empty', atLock, editable: true }
  }
  if (entered < total) {
    return { ...base, state: 'active_in_progress', atLock, editable: true }
  }
  return { ...base, state: 'active_complete', atLock, editable: true }
}

/**
 * Whether ONE fixture accepts edits, which is not the same question as whether
 * the card does.
 *
 * `ING-005`: contract 119 made ENFORCEMENT per fixture and left PUBLICATION per
 * matchweek, so a rescheduled or postponed fixture read as locked on this
 * surface while the trigger would have accepted the write. The surface was
 * stricter than the rule — safe, and still wrong, because a game that refuses a
 * legal move is broken even when it is safe. Contract 212 publishes the
 * per-fixture instant and this is where the page reads it.
 *
 * The card-level questions do NOT move: the Joker is a matchweek-level choice
 * and confirming a card is a matchweek-level act, so both keep asking
 * `presentation.editable`. Only a score input asks this.
 *
 * ORDER MATTERS AND IS THE SAFETY PROPERTY, in the same way `presentCard`'s
 * does. A conflict and an unresolvable lock outrank everything, because the page
 * is knowingly showing data it cannot trust; a settled result outranks the lock,
 * because a scored fixture is finished whatever any deadline says; and a fixture
 * that published nothing falls back to its card rather than to "open".
 */
export function fixtureEditable(
  presentation: CardPresentation,
  fixture: MatchPredictorFixture,
): boolean {
  if (presentation.state === 'conflict_requires_refresh') return false
  if (presentation.state === 'unavailable') return false
  if (fixture.result !== null) return false
  if (fixture.locked === undefined) return presentation.editable
  return !fixture.locked
}

/** Commands the page may issue. Nothing else mutates season state. */
export type MatchPredictorCommand =
  | { kind: 'setPrediction'; fixtureId: string; prediction: ScorelinePrediction | null }
  | { kind: 'setJoker'; played: boolean }
  | { kind: 'confirmCard' }

/**
 * Whether a command is legal in the current presentation.
 *
 * §12.5's point about state machines: they "define which commands are legal
 * without relying on button visibility". A disabled button is a courtesy; this
 * is the check, and it is the one the command path calls.
 */
export function commandRefusal(
  presentation: CardPresentation,
  command: MatchPredictorCommand,
  joker: MatchweekJoker,
  /**
   * Contract 212. Supplied so a score command can be judged against the
   * fixture's OWN lock. Defaulted to empty rather than made required: a caller
   * that does not pass it gets the matchweek-wide judgement it always got,
   * which is the stricter of the two and therefore the safe default.
   */
  fixtures: readonly MatchPredictorFixture[] = [],
): string | null {
  if (command.kind === 'setPrediction') {
    const fixture = fixtures.find((entry) => entry.fixtureId === command.fixtureId)
    if (fixture !== undefined && fixture.locked !== undefined) {
      if (presentation.state === 'conflict_requires_refresh') {
        return 'This matchweek changed somewhere else. Reload it before editing.'
      }
      if (presentation.state === 'unavailable') {
        return 'This matchweek is unavailable, so it cannot be edited.'
      }
      // Said of the FIXTURE, because that is what is locked. Telling a player
      // the matchweek is locked while its other fixtures accept edits would be
      // the same class of untruth this contract exists to remove.
      return fixtureEditable(presentation, fixture) ? null : 'This fixture is locked.'
    }
  }
  if (!presentation.editable) {
    if (presentation.state === 'conflict_requires_refresh') {
      return 'This matchweek changed somewhere else. Reload it before editing.'
    }
    if (presentation.state === 'unavailable') {
      return 'This matchweek is unavailable, so it cannot be edited.'
    }
    return 'This matchweek is locked.'
  }
  if (command.kind === 'setJoker' && command.played && !joker.playable) {
    return 'You have no Jokers left for this half of the season.'
  }
  if (command.kind === 'confirmCard' && presentation.entered === 0) {
    return 'Enter at least one prediction before confirming the card.'
  }
  return null
}

/**
 * One offline draft as the gateway reconciles it. Deliberately carries NO
 * version and NO instant: the version is the gateway's private concern, exactly
 * as it is for `apply`, and contract 177 accepts no instant at all.
 */
export type MatchPredictorDraft = {
  fixtureId: string
  prediction: ScorelinePrediction | null
}

/**
 * Contract 214. The server's own confirmation evidence, as answered by the
 * confirm RPC itself.
 *
 * This exists so the evidence reaches the screen from the WRITE that produced
 * it rather than waiting for some later authoritative read. The browser still
 * never derives either value: a gateway that cannot supply them answers
 * nothing at all, and the receipt keeps showing no evidence line.
 */
export type MatchPredictorConfirmationEvidence = {
  confirmedAt: string | null
  confirmationReference: string | null
}

/** The read/write boundary. One implementation reads fixtures; another an RPC. */
export type MatchPredictorGateway = {
  /** Load one matchweek, or fail with a reason the page can render. */
  load(matchweek: number): Promise<MatchPredictorPage>
  /**
   * Apply one command. Rejects with a version-conflict error when the row moved
   * underneath us, which is what drives `conflict_requires_refresh`.
   *
   * A `confirmCard` command MAY answer with the server's confirmation evidence
   * (Contract 214). Every other command, and any gateway below 214, answers
   * nothing — which is why the result is optional rather than required.
   */
  apply(
    matchweek: number,
    command: MatchPredictorCommand,
  ): Promise<MatchPredictorConfirmationEvidence | void>
  /**
   * `INNOV-020`. Submit a batch of drafts written while the device was offline
   * and answer per fixture.
   *
   * OPTIONAL, AND ITS ABSENCE IS THE FEATURE BEING OFF. The development
   * fixture gateway has no batch path and never claims one, so a surface asks
   * whether the method exists rather than being told by a flag that can
   * disagree with the gateway it is describing.
   */
  reconcile?:
    | ((
        matchweek: number,
        drafts: readonly MatchPredictorDraft[],
      ) => Promise<PredictionBatchResult>)
    | undefined
}
