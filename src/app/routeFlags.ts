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
  /**
   * THE REST OF THE CUTOVER, one flag per destination for the same reason
   * Matches got one: the stage contract asks for a "staged deployment/rollback
   * plan", and an all-or-nothing switch is neither. Each selects between a
   * legacy route component that is STILL MOUNTED and still passing its own
   * tests, and the vNext screen an earlier stage built.
   */
  | 'footballHubHome'
  | 'footballHubGames'
  | 'footballHubLeagues'
  | 'footballHubPlayerProfile'
  | 'footballHubDiscovery'
  | 'footballHubAccount'
  | 'footballHubLms'
  | 'footballHubChampionship'
  /**
   * THE MATCH PREDICTOR, WHICH STAGE 14 BUILT AN ADAPTER FOR AND NEVER ROUTED.
   *
   * `VNextPredictorDestination` shipped in that stage, was exported, and was
   * mounted by no route — so the flagship game kept serving the legacy season
   * page inside the legacy frame while every destination around it had moved.
   * Distinct from `seasonMatchPredictor`, which is not an implementation switch
   * at all: that flag decides whether the season Match Predictor FEATURE is
   * served, and answers `NotFoundPage` when it is off.
   */
  | 'footballHubPredictor'

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
    // Stage 14, the Football Hub cutover. Every one of these ships TRUE in
    // `.env.example` now that `productionCutoverAuthorized` is `true` in
    // `config/vnext-programme.json` and all three hosted environments are level
    // at Contract 208 — the reads these surfaces make exist everywhere they
    // will run. Each remains a switch rather than a deletion: the legacy route
    // components are still mounted on the off branch, so setting any one of
    // these to anything but `'true'` restores yesterday's journey for that one
    // destination with no data rollback.
    case 'footballHubMatches':
      return enabled(import.meta.env.VITE_UI_FOOTBALL_HUB_MATCHES) ? 'next' : 'legacy'
    case 'footballHubHome':
      return enabled(import.meta.env.VITE_UI_FOOTBALL_HUB_HOME) ? 'next' : 'legacy'
    case 'footballHubGames':
      return enabled(import.meta.env.VITE_UI_FOOTBALL_HUB_GAMES) ? 'next' : 'legacy'
    case 'footballHubLeagues':
      return enabled(import.meta.env.VITE_UI_FOOTBALL_HUB_LEAGUES) ? 'next' : 'legacy'
    case 'footballHubPlayerProfile':
      return enabled(import.meta.env.VITE_UI_FOOTBALL_HUB_PLAYER_PROFILE) ? 'next' : 'legacy'
    case 'footballHubDiscovery':
      return enabled(import.meta.env.VITE_UI_FOOTBALL_HUB_DISCOVERY) ? 'next' : 'legacy'
    case 'footballHubAccount':
      return enabled(import.meta.env.VITE_UI_FOOTBALL_HUB_ACCOUNT) ? 'next' : 'legacy'
    case 'footballHubLms':
      return enabled(import.meta.env.VITE_UI_FOOTBALL_HUB_LMS) ? 'next' : 'legacy'
    case 'footballHubChampionship':
      return enabled(import.meta.env.VITE_UI_FOOTBALL_HUB_CHAMPIONSHIP) ? 'next' : 'legacy'
    case 'footballHubPredictor':
      return enabled(import.meta.env.VITE_UI_FOOTBALL_HUB_PREDICTOR) ? 'next' : 'legacy'
  }
}

/**
 * WHY `src/App.tsx` READS THIS VARIABLE A SECOND TIME, AS A LITERAL.
 *
 * `isNextUi()` is a function call and no bundler can see through it, so a route
 * that merely *asks* still drags the vNext surfaces — and their CSS — into the
 * shipped artifact. Measured on the Stage 14 adapters: all JS 354.0 → 411.2 KB
 * gz and all CSS 42.5 → 49.1, against budgets of 366 and 44. The CSS half is
 * the sharp one, because `cssCodeSplit: false` collapses every stylesheet into
 * one that EVERY visitor downloads, so a lazy chunk defers the JavaScript and
 * not the styles.
 *
 * `App.tsx` therefore gates the lazy import on the same variable read INLINE,
 * as `import.meta.env` dot the name below. Vite replaces that with a literal, the branch folds, and Rollup drops
 * the subtree: with the flag off the bundle is byte-identical to `main`, so the
 * rollback promise becomes one about bytes rather than behaviour.
 *
 * IT HAS TO BE INLINE. Re-exporting the same comparison as a `const` from this
 * module was tried and does NOT fold across the module boundary — the import
 * survives and every byte comes back. That is why the duplication exists; it is
 * a bundler constraint, not a preference.
 *
 * The two readings compare the same variable to the same string, and
 * `tests/vnext/vnextCutoverRouting.test.tsx` pins that they cannot diverge —
 * because two readings of one flag is the drift this module exists to prevent.
 */

/** Whether the next-generation implementation serves this journey. */
export function isNextUi(journey: MigratedJourney): boolean {
  return journeyImplementation(journey) === 'next'
}
