/**
 * Matchweek settlement authority for domestic rounds.
 *
 * Authority: ADR 0012 as amended by ADR 0020. The reschedule/exception model
 * is three distinct states, never collapsed into one flag:
 *
 * - **postponed/rescheduled** — the fixture STAYS on this matchweek's card.
 *   ADR 0020's owner amendment of 5 August 2026 reversed the earlier rule that
 *   moved it to whichever round its new kickoff fell in: it keeps the matchweek
 *   it was scheduled in, and only its own lock instant moves (contract 119).
 *   Until that kickoff it is `awaiting_result` here like any unplayed fixture,
 *   so a matchweek holding one cannot settle until it is played;
 * - **abandoned** — started and not completed: the partial score does NOT
 *   stand, and the prediction carries to the replayed fixture in full;
 * - **void** — never to be played: no points to anyone, and the fixture
 *   leaves the matches-played denominator.
 *
 * This module decides what each fixture on a matchweek card means for
 * scoring and whether the matchweek can settle. It awards no points itself —
 * `scoring.ts` scores the fixtures this module declares scoreable. Pure
 * domain: no storage, network or ambient clock.
 */

import type { FixtureFinalScore } from './scoring'

export type SettlementFixtureState = 'scheduled' | 'completed' | 'abandoned' | 'void'

export type SettlementFixture = {
  id: string
  state: SettlementFixtureState
  /**
   * The recorded score. Required and final for `completed`. Permitted for
   * `abandoned` — it is the abandoned partial score and never stands. It must
   * be absent for `scheduled` and `void`: a score on a fixture that has not
   * started, or will never be played, is contradictory data.
   */
  score: FixtureFinalScore | null
  /**
   * For `abandoned` only: the replay fixture the prediction carries to, once
   * the replay exists. The replay is an ordinary fixture governed by the round
   * it is assigned to — which, under ADR 0020's 5 August 2026 amendment, is the
   * matchweek it was scheduled in whether it is replayed midweek alongside
   * other games or alone. It is not re-rounded by where its kickoff lands.
   */
  replayFixtureId: string | null
}

export type FixtureDisposition =
  | { kind: 'scoreable'; finalScore: FixtureFinalScore }
  | { kind: 'awaiting_result' }
  | { kind: 'awaiting_replay' }
  | { kind: 'carried_to_replay'; replayFixtureId: string }
  | { kind: 'void_no_points' }

export type FixtureSettlement = {
  fixtureId: string
  disposition: FixtureDisposition
}

export type PredictionCarry = {
  fromFixtureId: string
  toFixtureId: string
}

export type MatchweekSettlement = {
  fixtures: readonly FixtureSettlement[]
  /**
   * Fixtures that count as matches played on this card. Void fixtures leave
   * the denominator (ADR 0012). An abandoned fixture with a known replay has
   * handed its slot to the replay fixture — counting both would count one
   * match twice — so it leaves too; the replay counts wherever it is played.
   */
  matchesPlayedDenominator: number
  /** Predictions persistence must copy to replay fixtures, in full. */
  predictionCarries: readonly PredictionCarry[]
  /**
   * True when nothing on the card is still waiting: every fixture is
   * completed, void, or carried to a known replay. Only a settled matchweek
   * may bank a total into standings.
   */
  settled: boolean
}

export type MatchweekSettlementResult =
  | { ok: true; settlement: MatchweekSettlement }
  | {
      ok: false
      reason:
        | 'invalid_input'
        | 'duplicate_fixture'
        | 'completed_without_result'
        | 'score_on_unplayed_fixture'
        | 'replay_on_non_abandoned_fixture'
        | 'replay_self_reference'
    }

function isValidScore(value: FixtureFinalScore | null): value is FixtureFinalScore {
  return (
    value !== null &&
    Number.isInteger(value.home) &&
    Number.isInteger(value.away) &&
    value.home >= 0 &&
    value.away >= 0
  )
}

function disposition(fixture: SettlementFixture): FixtureDisposition {
  switch (fixture.state) {
    case 'completed':
      return { kind: 'scoreable', finalScore: fixture.score as FixtureFinalScore }
    case 'scheduled':
      return { kind: 'awaiting_result' }
    case 'abandoned':
      return fixture.replayFixtureId === null
        ? { kind: 'awaiting_replay' }
        : { kind: 'carried_to_replay', replayFixtureId: fixture.replayFixtureId }
    case 'void':
      return { kind: 'void_no_points' }
  }
}

/**
 * Settle a matchweek card, or refuse. Contradictory data refuses the whole
 * card rather than settling around it: a card that can misreport one fixture
 * can misreport the total.
 */
export function resolveMatchweekSettlement(
  fixtures: readonly SettlementFixture[],
): MatchweekSettlementResult {
  const seen = new Set<string>()
  for (const fixture of fixtures) {
    if (fixture.id.trim().length === 0) return { ok: false, reason: 'invalid_input' }
    if (seen.has(fixture.id)) return { ok: false, reason: 'duplicate_fixture' }
    seen.add(fixture.id)

    if (fixture.state === 'completed' && !isValidScore(fixture.score)) {
      return { ok: false, reason: 'completed_without_result' }
    }
    if ((fixture.state === 'scheduled' || fixture.state === 'void') && fixture.score !== null) {
      return { ok: false, reason: 'score_on_unplayed_fixture' }
    }
    if (fixture.state === 'abandoned' && fixture.score !== null && !isValidScore(fixture.score)) {
      return { ok: false, reason: 'invalid_input' }
    }

    if (fixture.replayFixtureId !== null) {
      if (fixture.state !== 'abandoned') {
        return { ok: false, reason: 'replay_on_non_abandoned_fixture' }
      }
      if (fixture.replayFixtureId.trim().length === 0) {
        return { ok: false, reason: 'invalid_input' }
      }
      if (fixture.replayFixtureId === fixture.id) {
        return { ok: false, reason: 'replay_self_reference' }
      }
    }
  }

  const settlements = fixtures.map((fixture) => ({
    fixtureId: fixture.id,
    disposition: disposition(fixture),
  }))

  return {
    ok: true,
    settlement: {
      fixtures: settlements,
      matchesPlayedDenominator: settlements.filter(
        ({ disposition: d }) => d.kind !== 'void_no_points' && d.kind !== 'carried_to_replay',
      ).length,
      predictionCarries: settlements.flatMap(({ fixtureId, disposition: d }) =>
        d.kind === 'carried_to_replay'
          ? [{ fromFixtureId: fixtureId, toFixtureId: d.replayFixtureId }]
          : [],
      ),
      settled: settlements.every(
        ({ disposition: d }) => d.kind !== 'awaiting_result' && d.kind !== 'awaiting_replay',
      ),
    },
  }
}
