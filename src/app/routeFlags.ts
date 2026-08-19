/**
 * Route-level feature flags for the UI migration.
 *
 * The modernisation plan's §13.3 asks for flags "at route/journey level, not
 * scattered arbitrary component branches", and §13.4 makes rollback a release
 * gate: a flag or route switch must restore the prior journey without any data
 * rollback. Both properties come from the same decision — a flag that selects
 * WHICH ROUTE RENDERS can be turned off with confidence, because the old route
 * is still there and untouched. A flag threaded through twenty components
 * cannot, because nobody can say what state the half-migrated tree is in.
 *
 * So this module has exactly one job: answer "which implementation serves this
 * journey", once, at the routing layer.
 *
 * FAIL CLOSED. An unset, misspelled or non-`'true'` value means the legacy
 * journey. That is deliberate: the failure mode of a mis-set flag should be
 * "the player sees what they saw yesterday", never "the player sees a surface
 * nobody meant to expose". `VITE_*` values are build-time in Vite, so a flag
 * cannot be flipped on a live bundle by accident either.
 *
 * `src/vite-env.d.ts` and `.env.example` must both name any variable added
 * here — `tests/scripts/environmentVariableContract.test.ts` enforces it.
 */

/** Journeys that currently have a next-generation implementation. */
export type MigratedJourney =
  | 'seasonMatchPredictor'
  | 'publicLanding'
  /**
   * STAGE 14, THE FOOTBALL HUB CUTOVER. One flag per destination rather than
   * one for the whole hub, because the stage contract asks for a "staged
   * deployment/rollback plan" and an all-or-nothing switch is neither: it
   * cannot be advanced one surface at a time, and rolling it back withdraws
   * surfaces that were fine along with the one that was not.
   *
   * Each selects between a legacy route component that is STILL MOUNTED and
   * still passing its own tests, and the vNext screen the earlier stages
   * built. Nothing is deleted to make room — the retirement of superseded
   * legacy code is separately owned by this stage and gated on rollback
   * safety being proven, not on the flag existing.
   */
  | 'footballHubMatches'

/** Which implementation is serving a journey. Also the telemetry dimension. */
export type JourneyImplementation = 'legacy' | 'next'

function enabled(value: string | undefined): boolean {
  return value?.trim() === 'true'
}

/**
 * Read the flag for one journey.
 *
 * Deliberately a function rather than a frozen constant object: a constant
 * evaluated at module load is invisible to a test that wants to prove both
 * branches, and proving the off branch is the whole point of a rollback flag.
 */
export function journeyImplementation(journey: MigratedJourney): JourneyImplementation {
  switch (journey) {
    case 'seasonMatchPredictor':
      return enabled(import.meta.env.VITE_UI_SEASON_MATCH_PREDICTOR) ? 'next' : 'legacy'
    // The anonymous root. 'legacy' is what the application did before Appendix
    // E existed — send a signed-out visitor straight to `/auth/login` — so the
    // rollback here is not a spare implementation kept alive for the purpose:
    // it is the behaviour every signed-out visitor got until this flag shipped.
    case 'publicLanding':
      return enabled(import.meta.env.VITE_UI_PUBLIC_LANDING) ? 'next' : 'legacy'
    // Stage 14. `productionCutoverAuthorized` is `false` in
    // `config/vnext-programme.json`, so this ships UNSET and therefore
    // `'legacy'`: the switch exists and is proved in both positions, and the
    // production mutation is a separate, explicitly authorised act.
    case 'footballHubMatches':
      return enabled(import.meta.env.VITE_UI_FOOTBALL_HUB_MATCHES) ? 'next' : 'legacy'
  }
}

/** Whether the next-generation implementation serves this journey. */
export function isNextUi(journey: MigratedJourney): boolean {
  return journeyImplementation(journey) === 'next'
}
