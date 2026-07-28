// Bonus Games platform — shared domain model (NOT logic).
//
// Every type here is transcribed from the canonical contracts:
//   - docs/architecture-and-tournament-states.md §7 (windows are stored data)
//   - docs/architecture-and-tournament-states.md §8 (competition states)
//   - docs/competition-structure.md §1 (the separation law)
//
// The separation law in type form: a bonus competition never references an
// Original Predictor entry, league, score event or rank row. Nothing in this
// file may import from ../tournament/scoringConfig or any Original Predictor
// scoring module. Shared user accounts and shared tournament fixtures are the
// only things the two sides have in common.

/**
 * The bonus games. The Original Predictor is deliberately NOT a member of this
 * union — it is not a bonus competition and must never be handled by the same
 * scoring, standings or entry code paths (competition-structure §1).
 */
export type BonusGameKey = 'ko_predictor' | 'last_man_standing' | 'predictor_cup'

/**
 * The exact state set from architecture-and-tournament-states §8. Each
 * competition independently reports exactly one of these. Do not extend this
 * union without updating §8 first — the doc is the authority, this is the
 * transcription.
 */
export type CompetitionState =
  | 'not_open'
  | 'registration_open'
  | 'entered'
  | 'registration_closed'
  | 'waiting_for_draw'
  | 'waiting_for_round'
  | 'action_required'
  | 'round_live'
  | 'round_awaiting_confirmation'
  | 'qualified'
  | 'survived'
  | 'eliminated'
  | 'champion'
  | 'complete'

/**
 * A competition instance: one run of one game for one tournament. Stored data,
 * never a hardcoded constant (§7). All instants are ISO-8601 strings supplied
 * by the server; the browser clock renders countdowns only, it never decides a
 * boundary.
 */
export type CompetitionRecord = {
  id: string
  gameKey: BonusGameKey
  tournamentId: string
  /** Admin has published the competition; unpublished competitions are invisible. */
  published: boolean
  /** Null while the opening date is still to be confirmed (provisional state). */
  registrationOpensAt: string | null
  /** Null means rolling entry — the KO Predictor's decided behaviour. */
  registrationClosesAt: string | null
  /** True for games whose structure is drawn (Predictor Cup groups/bracket). */
  drawRequired: boolean
  drawCompletedAt: string | null
  /** Set only once every window has settled and the winner is confirmed. */
  completedAt: string | null
}

/**
 * A round of a competition, expressed as stored data (§7): which real fixtures
 * belong to it, when its inputs open, when they lock, when it may settle, and
 * whether it needs a tie-break input (the Cup's Penalty Number).
 *
 * `locksAt` is a window-level fallback for display. Where a game locks per
 * kickoff (KO Predictor, and the shared knockout prediction store generally),
 * the per-match lock is authoritative and is enforced in the database.
 */
export type CompetitionWindow = {
  id: string
  competitionId: string
  /** 1-based round order within the competition. */
  sequence: number
  /** Human label, e.g. 'Round of 16'. Stored, not derived from the sequence. */
  label: string
  opensAt: string | null
  locksAt: string | null
  settlesAt: string | null
  requiresTieBreakInput: boolean
  fixtures: WindowFixtureAggregate
}

/**
 * Aggregate real-fixture state for a window, derived upstream from the
 * individual match-state contract (§4). Counting rather than enumerating keeps
 * this resolver pure and cheap; the Games hub does not need per-fixture detail.
 *
 * `awaitingConfirmation` is §4's `full_time_unconfirmed`: played, but not
 * officially confirmed. Nothing may be scored or settled from it.
 */
export type WindowFixtureAggregate = {
  total: number
  live: number
  awaitingConfirmation: number
  /** Officially confirmed or fully scored. */
  confirmed: number
}

/**
 * A user's outcome inside a competition. Separate from the competition's own
 * state: the round can be live while this user is already eliminated.
 */
export type EntrantOutcome = 'active' | 'qualified' | 'survived' | 'eliminated' | 'champion'

/**
 * A user's entry in one competition. Voluntary and per-competition: joining an
 * Original Predictor league never creates one of these, and entering one game
 * never creates one for another (competition-structure §1).
 */
export type CompetitionEntrant = {
  competitionId: string
  userId: string
  joinedAt: string
  outcome: EntrantOutcome
  /**
   * Count of required inputs the user still owes for the currently open window
   * (unmade selections, missing scorelines, an unset Penalty Number). Zero when
   * nothing is owed. Supplied by the read model; never inferred here.
   */
  pendingInputs: number
}

/**
 * What the Games hub, Home action queue and every competition screen consume.
 * No surface computes a competition state for itself.
 */
export type CompetitionStatus = {
  competitionId: string
  gameKey: BonusGameKey
  state: CompetitionState
  entered: boolean
  /** The window driving the current state, where one does. */
  activeWindow: CompetitionWindow | null
  /**
   * The next instant the user must act by, if any: the registration close for a
   * non-entrant, or the active window's lock for an entrant. Display only.
   */
  nextDeadline: string | null
}
