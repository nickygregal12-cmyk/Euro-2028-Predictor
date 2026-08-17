import type { Scoreline } from '../../models/football'
import type { PredictorModel } from '../../models/predictor'

/**
 * A REVIEW HARNESS, so the score entry can actually be entered into.
 *
 * WHY IT EXISTS. The thing Stage 7 most needs looked at is whether working
 * through ten fixtures is fast and satisfying, and that is not a question a still
 * screenshot can answer. A story that handed the page no-op actions would show
 * the states and prove nothing about the interaction: pressing `+` would do
 * nothing, the progress track would never move, and the one thing under review
 * would be the one thing unreviewable.
 *
 * WHAT IT IS NOT. It is not a second source of truth and it is not a draft store.
 * It lives under `fixtures/`, it is imported by stories and tests and by nothing
 * else, and the real surface's real actions go to the real application through
 * `useSeasonMatchPredictor`. Nothing under `src/vnext/predictor/` or
 * `src/vnext/integration/` imports this file.
 *
 * THE THREE RULES IT KEEPS, which are the reason it is a small pure function and
 * not a hook:
 *
 *   1. IT NEVER CHANGES `editable`, `lock`, `phase` OR `joker.playable`. Those are
 *      the application's answers. A rehearsal that let a story become editable by
 *      typing into it would be a rehearsal that could not be trusted to show the
 *      locked state, and the invariant tests drive commands at locked models
 *      precisely to check the surface ignores them.
 *   2. IT REFUSES A COMMAND THE MODEL SAYS IS REFUSED, for the same reason and in
 *      the same order the real `commandRefusal` does — `editable` first, then the
 *      command's own precondition.
 *   3. ITS ONLY ARITHMETIC IS COUNTING WHAT IS ENTERED, which is the model's own
 *      partition over one denominator and is the same class the Home mapper was
 *      allowed. It computes no points, no rank and no verdict.
 *
 * PURE. Model in, model out. No clock, no storage, no React.
 */

export type RehearsalCommand =
  | { kind: 'setPrediction'; fixtureId: string; score: Scoreline }
  | { kind: 'clearPrediction'; fixtureId: string }
  | { kind: 'setJoker'; played: boolean }
  | { kind: 'confirmCard' }

export function rehearsePredictor(
  model: PredictorModel,
  command: RehearsalCommand,
): PredictorModel {
  // Rule 1 and 2: the application's editability decides, exactly as it does on
  // the real page. A refused command changes nothing at all.
  if (!model.editable) return model

  if (command.kind === 'setJoker') {
    if (!model.joker.playable) return model
    return {
      ...model,
      joker: {
        ...model.joker,
        playedHere: command.played,
        remainingThisHalf: Math.max(
          0,
          model.joker.remainingThisHalf + (command.played ? -1 : 1),
        ),
      },
    }
  }

  if (command.kind === 'confirmCard') {
    if (model.confirm.state !== 'available') return model
    return { ...model, confirm: { state: 'confirmed', refusal: null } }
  }

  const score = command.kind === 'setPrediction' ? command.score : null
  const fixtures = model.fixtures.map((fixture) =>
    fixture.id === command.fixtureId
      ? {
          ...fixture,
          prediction: score,
          // `entered` and `empty` are the only two states a command can reach.
          // Locked and settled are unreachable here because the guard above
          // returned already.
          state: score === null ? ('empty' as const) : ('entered' as const),
          // An accepted command is a saved one in a rehearsal, which is the
          // honest simplification: this harness has no server to be slow.
          save: 'saved' as const,
        }
      : fixture,
  )

  const entered = fixtures.filter((fixture) => fixture.prediction !== null).length

  return {
    ...model,
    fixtures,
    progress: { ...model.progress, entered },
    // Engaging with the card is what moves it off `unbanked`, which is the
    // application's own rule: an interacted card banks what was entered.
    atLock: model.atLock === null ? null : entered > 0 ? 'banksEntered' : model.atLock,
    confirm:
      model.confirm.state === 'refused' && entered > 0
        ? { state: 'available', refusal: null }
        : model.confirm,
  }
}
