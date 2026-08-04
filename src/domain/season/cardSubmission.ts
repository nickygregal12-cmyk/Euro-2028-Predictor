/**
 * Matchweek card submission law for the domestic Main Predictor.
 *
 * Authority: ADR 0012 as amended 4 August 2026, and the rolling-entry rule.
 *
 * THE CARD IS NOT PRE-FILLED, and nothing is completed on the player's behalf.
 * A fixture the player did not fill in is submitted as no prediction and scores
 * nothing. ADR 0012 originally required a "sensible default" on every fixture
 * and auto-completion at lock; both were withdrawn, because a player must not
 * benefit from not filling something in. A default that can score is a free
 * entry into every fixture a player ignored, and the benefit is largest for the
 * least engaged player — which inverts the competition.
 *
 * So there is no default parameter here, and no policy for a caller to supply.
 * `provenance` and `autoCompleted` are gone with it: every submitted prediction
 * is the player's, because nothing else can produce one.
 *
 * ROLLING ENTRY IS UNCHANGED. A player who never engaged the matchweek is
 * unbanked — the lock does not invent a submission for them. Absence and an
 * empty card remain different facts.
 *
 * Pure domain: no storage, network or ambient clock; the lock instant is the
 * caller's event, not a clock read here.
 */

import type { ScorelinePrediction } from './scoring'

/** One fixture on the matchweek card as presented to the player. */
export type CardFixture = {
  fixtureId: string
  /** The player's own saved prediction, or null where they left it blank. */
  playerPrediction: ScorelinePrediction | null
}

/**
 * Where the card stands when the round locks:
 * - `no_submission` — the player never engaged this matchweek;
 * - `provisional` — saved but never confirmed, possibly partial;
 * - `confirmed` — the player marked the card finished.
 *
 * `provisional` and `confirmed` submit exactly the same thing: what the player
 * entered. With no prefills there is nothing for confirmation to adopt, so the
 * status is a record of intent rather than a scoring input. It is kept because
 * "I meant to leave that blank" and "I had not got to it yet" are different
 * things to have said, and the ledger should be able to tell them apart.
 */
export type CardStatus = 'no_submission' | 'provisional' | 'confirmed'

export type SubmittedPrediction = {
  fixtureId: string
  prediction: ScorelinePrediction
}

export type CardLockResolution =
  | { kind: 'unbanked' }
  | {
      kind: 'submitted'
      /**
       * Only the fixtures the player actually filled in. A blank fixture is
       * absent from this list rather than present with a manufactured value —
       * scoring reads what is here and awards nothing for what is not.
       */
      predictions: readonly SubmittedPrediction[]
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
 * Resolve a card at its round's lock instant, or refuse.
 *
 * A card the player never touched is unbanked. A card they engaged submits
 * exactly what they entered, however little that is. Contradictory data — a
 * malformed prediction, a blank or duplicated fixture id, a matchweek with no
 * fixtures at all — refuses outright rather than submitting a guess.
 *
 * Note what is NOT a refusal: a card with blank fixtures. That is an ordinary,
 * expected card, and every blank simply scores nothing.
 */
export function resolveCardAtLock(
  fixtures: readonly CardFixture[],
  status: CardStatus,
): CardLockResolution {
  if (status === 'no_submission') return { kind: 'unbanked' }

  // A matchweek with no fixtures is contradictory data, not an empty card: the
  // player is being locked out of a round that has nothing in it.
  if (fixtures.length === 0) return { kind: 'refused', reason: 'invalid_input' }

  const seen = new Set<string>()
  for (const fixture of fixtures) {
    if (fixture.fixtureId.trim().length === 0) return { kind: 'refused', reason: 'invalid_input' }
    if (seen.has(fixture.fixtureId)) return { kind: 'refused', reason: 'duplicate_fixture' }
    seen.add(fixture.fixtureId)

    // Only a value the player actually gave is checked. A blank is a blank.
    if (fixture.playerPrediction !== null && !isValidScoreline(fixture.playerPrediction)) {
      return { kind: 'refused', reason: 'invalid_input' }
    }
  }

  return {
    kind: 'submitted',
    predictions: fixtures
      .filter(
        (fixture): fixture is CardFixture & { playerPrediction: ScorelinePrediction } =>
          fixture.playerPrediction !== null,
      )
      .map((fixture) => ({ fixtureId: fixture.fixtureId, prediction: fixture.playerPrediction })),
    confirmed: status === 'confirmed',
  }
}
