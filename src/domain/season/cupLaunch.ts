/**
 * Public Predictor Cup launch gate.
 *
 * Authority: ADR 0022, which supplies the entrant threshold ADR 0014 left
 * undefined ("a defined entrant threshold or a scheduled start some months
 * into the season"). The first public Cup of a competition season opens when
 * **100 entrants have joined**, with no time-based fallback: a season that
 * never reaches 100 does not open a public Cup, and that is a measurable
 * signal about cohort size rather than a defect to engineer around.
 *
 * One hundred is chosen against the format arithmetic — five balanced groups
 * of twenty at the cap, a qualification target of 67, and a seeded playoff
 * reducing to a 64-bracket — and because a transparent draw, which is the
 * game's distinguishing feature, reads as thin below it.
 *
 * This is a LAUNCH rule, not a format rule: once the gate opens, structure
 * is decided by `cupFormat.ts` from whatever field actually enters. Private
 * Cups are unaffected and never consult this module.
 *
 * Pure domain: no storage, network or ambient clock — "now" never appears,
 * because the gate is a count, not a date.
 */

export const PUBLIC_CUP_ENTRANT_THRESHOLD = 100

export type PublicCupLaunchVerdict =
  | { open: true; entrants: number }
  | {
      open: false
      entrants: number
      shortfall: number
      reason: 'below_threshold' | 'already_running' | 'invalid_input'
    }

export type PublicCupLaunchInput = {
  /** Entrants who have joined this competition season's public Cup queue. */
  entrants: number
  /** True when a public Cup is already running for this competition season. */
  publicCupRunning: boolean
}

/**
 * Whether the public Cup may open. One public Cup per competition season
 * runs at a time (ADR 0014), so an already-running competition refuses
 * regardless of how many further entrants have queued.
 */
export function resolvePublicCupLaunch(input: PublicCupLaunchInput): PublicCupLaunchVerdict {
  if (!Number.isInteger(input.entrants) || input.entrants < 0) {
    return { open: false, entrants: 0, shortfall: PUBLIC_CUP_ENTRANT_THRESHOLD, reason: 'invalid_input' }
  }

  const shortfall = Math.max(0, PUBLIC_CUP_ENTRANT_THRESHOLD - input.entrants)

  if (input.publicCupRunning) {
    return { open: false, entrants: input.entrants, shortfall, reason: 'already_running' }
  }
  if (input.entrants < PUBLIC_CUP_ENTRANT_THRESHOLD) {
    return { open: false, entrants: input.entrants, shortfall, reason: 'below_threshold' }
  }
  return { open: true, entrants: input.entrants }
}
