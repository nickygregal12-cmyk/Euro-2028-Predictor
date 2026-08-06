/**
 * Fixture reassignment rules for domestic rounds.
 *
 * ---------------------------------------------------------------------------
 * SUPERSEDED, AND RETAINED RATHER THAN DELETED — read this before the rules
 * ---------------------------------------------------------------------------
 *
 * This header used to state, as current authority, that a fixture postponed or
 * materially rescheduled before it completes MOVES to the round containing its
 * new kickoff and is governed by that round's lock from then on.
 *
 * **ADR 0020's owner amendment of 5 August 2026 reverses exactly that.** A
 * rescheduled fixture stays in the matchweek it was scheduled in, and its own
 * prediction stays open to its own kickoff. The live path is contract 117,
 * which revises a kickoff and by construction never writes
 * `competition_round_id`, and contract 119, which gives that fixture its own
 * lock instant. Neither asks this module anything.
 *
 * So the reassignment half below is **not the rule this platform follows**, and
 * `resolveFixtureReassignment` has no caller outside its own test. It is kept
 * because the amendment superseded a model, not a file: the kickoff-revision
 * and audit shapes remain meaningful, and deleting the module would also delete
 * the record of a decision that was taken deliberately. Any future caller needs
 * its own justification under the amendment rather than inheriting the one this
 * header used to claim.
 *
 * The same applies to contract 113's `competition_rounds` play window, which
 * exists to answer "which round does this kickoff fall in" — a question
 * reassignment no longer asks. ADR 0020 § "What this supersedes in the
 * repository" is the authority for both.
 *
 * ---------------------------------------------------------------------------
 * THE SUPERSEDED MODEL, AS DECIDED
 * ---------------------------------------------------------------------------
 *
 * Authority: ADR 0020 (amending ADR 0012), before its own later amendment. The
 * binding distinction was that this is REASSIGNMENT, not unlocking —
 *
 * - a locked round never reopens, whatever happens to its fixture list;
 * - completed fixtures and settled points never move;
 * - a Joker stays with its original round and never follows a departing
 *   fixture (enforced in scoring, restated here because callers ask);
 * - every assignment change is audited.
 *
 * The first two survive the amendment untouched: ADR 0011's lock law is not
 * what changed. The third is enforced in scoring either way.
 *
 * This module decides and describes; it never mutates. Pure domain: no storage,
 * network or ambient clock — the decision instant is an input and appears
 * verbatim in the audit record.
 */

export type ReassignmentFixture = {
  id: string
  roundId: string
  kickoffAt: string | null
  /** Completed means played to an official completion — never movable. */
  completed: boolean
}

export type ReassignmentRound = {
  id: string
  /** Inclusive ISO window this round's kickoffs belong to. */
  windowStartsAt: string
  windowEndsAt: string
}

export type ReassignmentReason = 'postponed' | 'rescheduled'

export type FixtureReassignmentInput = {
  fixture: ReassignmentFixture
  newKickoffAt: string
  rounds: readonly ReassignmentRound[]
  reason: ReassignmentReason
  /** Provider payload reference or admin note that evidences the change. */
  evidenceRef: string
  /** The instant the decision is being made — supplied, never read. */
  decidedAt: string
}

export type FixtureReassignmentAudit = {
  fixtureId: string
  fromRoundId: string
  toRoundId: string
  oldKickoffAt: string | null
  newKickoffAt: string
  reason: ReassignmentReason
  evidenceRef: string
  decidedAt: string
}

export type FixtureReassignmentDecision =
  | {
      kind: 'reassign'
      toRoundId: string
      /** The one record persistence must write; nothing here reopens a lock. */
      audit: FixtureReassignmentAudit
    }
  | {
      /** Same round, new instant: audit the kickoff revision, move nothing. */
      kind: 'kickoff_revision'
      audit: FixtureReassignmentAudit
    }
  | {
      kind: 'refused'
      reason:
        | 'completed_fixture_never_moves'
        | 'no_destination_round'
        | 'ambiguous_destination_round'
        | 'invalid_input'
    }

function parseInstant(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validRounds(rounds: readonly ReassignmentRound[]): boolean {
  const ids = new Set<string>()
  for (const round of rounds) {
    if (round.id.trim().length === 0 || ids.has(round.id)) return false
    ids.add(round.id)
    const starts = parseInstant(round.windowStartsAt)
    const ends = parseInstant(round.windowEndsAt)
    if (starts === null || ends === null || starts > ends) return false
  }
  return true
}

/**
 * Decide what a new kickoff means for a fixture. Unknown, contradictory or
 * unmapped data refuses — it never guesses a round, and it never produces a
 * decision that would touch a completed fixture or reopen anything.
 */
export function resolveFixtureReassignment(
  input: FixtureReassignmentInput,
): FixtureReassignmentDecision {
  const newKickoff = parseInstant(input.newKickoffAt)
  const decidedAt = parseInstant(input.decidedAt)
  if (
    newKickoff === null ||
    decidedAt === null ||
    input.fixture.id.trim().length === 0 ||
    input.fixture.roundId.trim().length === 0 ||
    input.evidenceRef.trim().length === 0 ||
    !validRounds(input.rounds)
  ) {
    return { kind: 'refused', reason: 'invalid_input' }
  }

  if (input.fixture.completed) {
    return { kind: 'refused', reason: 'completed_fixture_never_moves' }
  }

  const containing = input.rounds.filter((round) => {
    const starts = parseInstant(round.windowStartsAt) as number
    const ends = parseInstant(round.windowEndsAt) as number
    return newKickoff >= starts && newKickoff <= ends
  })
  if (containing.length === 0) return { kind: 'refused', reason: 'no_destination_round' }
  if (containing.length > 1) return { kind: 'refused', reason: 'ambiguous_destination_round' }

  const destination = containing[0]
  const audit: FixtureReassignmentAudit = {
    fixtureId: input.fixture.id,
    fromRoundId: input.fixture.roundId,
    toRoundId: destination.id,
    oldKickoffAt: input.fixture.kickoffAt,
    newKickoffAt: input.newKickoffAt,
    reason: input.reason,
    evidenceRef: input.evidenceRef,
    decidedAt: input.decidedAt,
  }

  return destination.id === input.fixture.roundId
    ? { kind: 'kickoff_revision', audit }
    : { kind: 'reassign', toRoundId: destination.id, audit }
}
