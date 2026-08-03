/**
 * Matchweek card submission law for the domestic Main Predictor.
 *
 * Authority: ADR 0012 (friction mitigations, in scope for the build rather
 * than deferred) and the rolling-entry rule. The card is pre-filled with a
 * default for every fixture and is visibly provisional until confirmed;
 * partial submissions auto-complete at lock using those defaults, consistent
 * with the deterministic auto-assignment rule in ADR 0013. A player who
 * never engaged the matchweek is unbanked — rolling entry means absence, and
 * the lock never invents a submission for them.
 *
 * What the default IS for a given fixture is a policy the caller supplies —
 * this module owns what happens to it, not its value. Pure domain: no
 * storage, network or ambient clock; the lock instant is the caller's event,
 * not a clock read here.
 */

import type { ScorelinePrediction } from './scoring'

/** One fixture on the matchweek card as presented to the player. */
export type CardFixture = {
  fixtureId: string
  /** The pre-filled default. Every fixture on the card must carry one. */
  defaultPrediction: ScorelinePrediction
  /** The player's own saved prediction, when they set one. */
  playerPrediction: ScorelinePrediction | null
}

/**
 * Where the card stands when the round locks:
 * - `no_submission` — the player never engaged this matchweek;
 * - `provisional` — saved but never confirmed, possibly partial;
 * - `confirmed` — the player confirmed the card, prefills included.
 */
export type CardStatus = 'no_submission' | 'provisional' | 'confirmed'

export type SubmittedPrediction = {
  fixtureId: string
  prediction: ScorelinePrediction
  /**
   * `player` for a prediction the player set — or accepted, by confirming a
   * card that still showed prefills. `default` only for a gap the lock
   * itself filled on an unconfirmed card.
   */
  provenance: 'player' | 'default'
}

export type CardLockResolution =
  | { kind: 'unbanked' }
  | {
      kind: 'submitted'
      predictions: readonly SubmittedPrediction[]
      /** True when the lock filled at least one gap on an unconfirmed card. */
      autoCompleted: boolean
      confirmed: boolean
    }
  | { kind: 'refused'; reason: 'invalid_input' | 'duplicate_fixture' }

function isValidScoreline(value: ScorelinePrediction | null): value is ScorelinePrediction {
  return (
    value !== null &&
    Number.isInteger(value.home) &&
    Number.isInteger(value.away) &&
    value.home >= 0 &&
    value.away >= 0
  )
}

/**
 * Resolve a card at its round's lock instant, or refuse. A card the player
 * engaged always submits complete; a card they never touched never submits
 * at all. Contradictory data — a missing default, a malformed prediction, a
 * duplicated fixture, an engaged card with no fixtures — refuses outright
 * rather than submitting a guess.
 */
export function resolveCardAtLock(
  fixtures: readonly CardFixture[],
  status: CardStatus,
): CardLockResolution {
  if (status === 'no_submission') return { kind: 'unbanked' }

  if (fixtures.length === 0) return { kind: 'refused', reason: 'invalid_input' }

  const seen = new Set<string>()
  for (const fixture of fixtures) {
    if (fixture.fixtureId.trim().length === 0) return { kind: 'refused', reason: 'invalid_input' }
    if (seen.has(fixture.fixtureId)) return { kind: 'refused', reason: 'duplicate_fixture' }
    seen.add(fixture.fixtureId)

    if (!isValidScoreline(fixture.defaultPrediction)) {
      return { kind: 'refused', reason: 'invalid_input' }
    }
    if (fixture.playerPrediction !== null && !isValidScoreline(fixture.playerPrediction)) {
      return { kind: 'refused', reason: 'invalid_input' }
    }
  }

  const confirmed = status === 'confirmed'
  const predictions = fixtures.map((fixture) => ({
    fixtureId: fixture.fixtureId,
    prediction: fixture.playerPrediction ?? fixture.defaultPrediction,
    provenance:
      confirmed || fixture.playerPrediction !== null ? ('player' as const) : ('default' as const),
  }))

  return {
    kind: 'submitted',
    predictions,
    autoCompleted: predictions.some(({ provenance }) => provenance === 'default'),
    confirmed,
  }
}
