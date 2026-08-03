/**
 * Season Last Man Standing setup presets.
 *
 * Authority: ADR 0022, which supplies the three preset compositions ADR 0013
 * mandated ("three named presets with custom behind them") but left
 * undefined. The axes and their bounds remain ADR 0013's: lives 0–3,
 * Saves 0–2, draws eliminate or survive, and the wipeout endgame rule.
 *
 * The presets exist so the tested surface is three configurations plus
 * custom rather than seventy-two. They spread the axes deliberately:
 * Classic tests pure selection, Second Chance forgives one mistake and one
 * draw, Relaxed is for groups who want the competition to last.
 *
 * The public competition is pinned to Classic (ADR 0022), so the
 * acquisition surface is one known configuration. Public competitions also
 * take the ADR 0013 joint-winner cap rather than a private endgame rule,
 * which is why `publicSetup` overrides the scope rather than reusing
 * Classic's private one.
 *
 * Setup is immutable once the first round locks — enforced by the caller
 * that owns the lock, restated here because this module is where the values
 * come from. Pure domain: no storage, network or ambient clock.
 */

import type { LmsDrawsRule, LmsEndgame } from './lmsRoundResolution'

export const LMS_MAX_LIVES = 3
export const LMS_MAX_SAVES = 2

export type LmsPresetName = 'classic' | 'second_chance' | 'relaxed'

export type LmsSetup = {
  lives: number
  saves: number
  drawsRule: LmsDrawsRule
  endgame: LmsEndgame
}

export type LmsPreset = LmsSetup & {
  name: LmsPresetName
  /** Display label; the interface never invents its own wording. */
  label: string
}

const CLASSIC: LmsPreset = {
  name: 'classic',
  label: 'Classic',
  lives: 0,
  saves: 0,
  drawsRule: 'eliminate',
  endgame: { scope: 'private', onWipeout: 'play_on' },
}

const SECOND_CHANCE: LmsPreset = {
  name: 'second_chance',
  label: 'Second Chance',
  lives: 1,
  saves: 1,
  drawsRule: 'eliminate',
  endgame: { scope: 'private', onWipeout: 'play_on' },
}

const RELAXED: LmsPreset = {
  name: 'relaxed',
  label: 'Relaxed',
  lives: 2,
  saves: 2,
  drawsRule: 'survive',
  endgame: { scope: 'private', onWipeout: 'shared_win' },
}

/** The three presets, in the order they are offered. */
export const LMS_PRESETS: readonly LmsPreset[] = [CLASSIC, SECOND_CHANCE, RELAXED]

export function lmsPreset(name: LmsPresetName): LmsPreset {
  const found = LMS_PRESETS.find((preset) => preset.name === name)
  // Exhaustive over LmsPresetName; the throw guards a widened union later.
  if (found === undefined) throw new Error(`Unknown Last Man Standing preset: ${name}`)
  return found
}

/**
 * The public competition's setup: Classic values under the public endgame,
 * where zero survivors means joint winners capped at three rather than a
 * creator-chosen rule (ADR 0013).
 */
export function publicLmsSetup(): LmsSetup {
  return {
    lives: CLASSIC.lives,
    saves: CLASSIC.saves,
    drawsRule: CLASSIC.drawsRule,
    endgame: { scope: 'public' },
  }
}

export type LmsSetupVerdict =
  | { valid: true }
  | {
      valid: false
      reason: 'lives_out_of_range' | 'saves_out_of_range' | 'invalid_draws_rule' | 'invalid_endgame'
    }

/**
 * Whether a custom setup is legal. Custom is permitted (ADR 0013) but only
 * inside the recorded bounds — a competition offering four lives is not a
 * variant, it is an unreviewed rule.
 */
export function validateLmsSetup(setup: LmsSetup): LmsSetupVerdict {
  if (!Number.isInteger(setup.lives) || setup.lives < 0 || setup.lives > LMS_MAX_LIVES) {
    return { valid: false, reason: 'lives_out_of_range' }
  }
  if (!Number.isInteger(setup.saves) || setup.saves < 0 || setup.saves > LMS_MAX_SAVES) {
    return { valid: false, reason: 'saves_out_of_range' }
  }
  if (setup.drawsRule !== 'eliminate' && setup.drawsRule !== 'survive') {
    return { valid: false, reason: 'invalid_draws_rule' }
  }
  if (setup.endgame.scope === 'public') return { valid: true }
  if (setup.endgame.scope !== 'private') return { valid: false, reason: 'invalid_endgame' }
  return ['play_on', 'shared_win', 'reset'].includes(setup.endgame.onWipeout)
    ? { valid: true }
    : { valid: false, reason: 'invalid_endgame' }
}

/**
 * The preset a setup corresponds to, or `null` when it is genuinely custom.
 * Display uses this to name a competition's rules rather than listing four
 * values at every entrant.
 */
export function matchLmsPreset(setup: LmsSetup): LmsPresetName | null {
  const found = LMS_PRESETS.find(
    (preset) =>
      preset.lives === setup.lives &&
      preset.saves === setup.saves &&
      preset.drawsRule === setup.drawsRule &&
      preset.endgame.scope === setup.endgame.scope &&
      (preset.endgame.scope !== 'private' ||
        setup.endgame.scope !== 'private' ||
        preset.endgame.onWipeout === setup.endgame.onWipeout),
  )
  return found?.name ?? null
}
