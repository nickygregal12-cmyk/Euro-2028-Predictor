/**
 * The deterministic development/E2E seed contract.
 *
 * Authority: ADR 0024, which requires development to be deterministically
 * reseedable — seed users, game memberships, rehearsal fixtures, admin and
 * ordinary-player accounts, and a one-command reset.
 *
 * Why this file exists rather than identities living inline in
 * `global-setup.ts`: contract 66 moved the membership authority, and the
 * browser fixtures did not move with it. Every authenticated surface then
 * rendered empty and 33 specs failed for one cause. Seeds have to travel
 * with the schema, and that only happens if there is one declared place
 * where "what a seeded user needs" is written down, plus a guard that fails
 * when the schema moves past the last time anyone checked.
 *
 * `SEED_REVIEWED_AT_CONTRACT` is that guard. Raise it only after actually
 * re-verifying that a seeded user is functional on the new contract — never
 * to make a red test green.
 */

/**
 * The database contract at which these requirements were last verified.
 *
 * The detailed historical contract-by-contract seed review through Contract
 * 190 remains preserved in Git history.
 *
 * Contracts 191 to 197 were reviewed together, and none of them adds a gate to
 * an authenticated read the deterministic seed depends on:
 *
 *   * 191 and 192 ADD reads (`resolve_season_player`, `get_season_rank_history`,
 *     `get_season_rivalry`) and consolidate three copies of contract 151's
 *     private-league visibility rule onto one authority. The rule itself is
 *     unchanged, so a seeded player sees exactly what they saw at 190; the
 *     leaderboard rows gain fields rather than losing any.
 *   * 193 adds one read, `get_season_cup_bracket`, which a seeded player who
 *     has entered no Championship simply gets `{entered: false}` from.
 *   * 194 makes Championship tie settlement consult eligibility. It is an
 *     administrator path; no seeded journey reaches it, and an entrant with no
 *     `game_memberships` row still reports `eligible`.
 *   * 195 and 196 add two `predictor_internal` action generators granted to
 *     nobody, and patch `process_player_action_items` and the expiry sweep --
 *     all `service_role`, none of it on an authenticated read path. 196 also
 *     sets `updated_at` on two Championship outcome writes, which changes a
 *     timestamp and no row selection.
 *   * 197 adds one `authenticated` read, `get_my_football_calendar`, scoped to
 *     the caller's own `entries`. Nothing existing is redefined.
 *
 * Contract 198 (CUP-006) reserves the knockout calendar a Championship implies.
 * It adds `predictor_internal.cup_knockout_rounds`, granted to nobody, and
 * redefines `predictor_internal.select_season_cup_format` and
 * `admin_finalise_predictor_cup_groups` -- an internal helper and an
 * administrator path. No `authenticated` read is added, removed or redefined,
 * and the seed creates no Championship whose launchability the new arithmetic
 * could change.
 *
 * That reasoning is not what raises the marker. Both jobs passed at the exact
 * head `fc56e34`: Database parity (`local-supabase`) run 32113189955 and
 * Browser E2E (`authenticated-browser`) run 32113190038, re-verifying the
 * seeded authenticated journeys against a database holding all 198 migrations
 * rather than merely reasoning about them.
 *
 * Contracts 199 to 202 are the private AI Lab's operational boundary and touch
 * no authenticated read the seed exercises. 199 adds `ai.bet_advice_identity`
 * and a third limb on `ai.valid_bets`, and makes `ai.bet_results.actual_result`
 * nullable on a void settlement. 200 adds `ai.odds_poll_max_gap_seconds`. 201
 * adds three competition-admin definer reads over schema `ai` and two views
 * revoked from every browser role. 202 widens the `ai.predictions.horizon`
 * CHECK. Schema `ai` has never been reachable from `anon` or `authenticated`,
 * the three new reads require the competition-admin capability, and no existing
 * function on a seeded journey is redefined.
 *
 * And again, that reasoning is not what raises the marker. Both jobs passed at
 * the exact head `8fb3985`: Database parity (`local-supabase`) run 32137280991
 * and Browser E2E (`authenticated-browser`) run 32137281011, against a database
 * holding all 202 migrations. The database-parity run also carries the six
 * behavioural pgTAP suites for this boundary -- 236 and 237 among them, because
 * contract 199 redefines the object both of those are about.
 *
 * Contract 203 redefines two competition-admin definer reads,
 * `admin_ai_bet_builder_candidates` and `admin_ai_bet_builder_books`, so that
 * each takes its rows from `ai.current_fixture_recommendations` and admits only
 * a leg whose CURRENT decision is BET. Both were already behind
 * `predictor_internal.require_competition_admin()` and both remain so; the
 * change is which rows they return, not who may ask. No `authenticated` read is
 * added, removed or redefined, schema `ai` stays unreachable from the browser,
 * and no seeded journey touches the AI Lab at all.
 *
 * The marker is raised on the runs, not on that paragraph. Both jobs passed at
 * the exact head `ecf8883`: Database parity (`local-supabase`) run 32146227554
 * and Browser E2E (`authenticated-browser`) run 32146227736, against a database
 * holding all 203 migrations. The database-parity run carries pgTAP suite 251
 * beside the six from the previous boundary.
 *
 * Contract 204 scopes one number to the league it is asked about. It adds the
 * view `ai.quarantined_predictions`, granted to nobody and revoked from both
 * browser roles besides, and redefines `admin_ai_dashboard` and
 * `admin_ai_betting_dashboard` at their existing signatures so that their
 * excluded-forecast count obeys `p_league` like every figure beside it. Both
 * functions were already behind `predictor_internal.require_competition_admin()`
 * and both remain so. No `authenticated` read is added, removed or redefined,
 * schema `ai` stays unreachable from the browser, and no seeded journey reaches
 * the AI Lab.
 *
 * The marker is raised on the runs, not on that paragraph. Both jobs passed at
 * the exact head `52e8879`: Database parity (`local-supabase`) run 32189217446
 * and Browser E2E (`authenticated-browser`) run 32189217419, against a database
 * holding all 204 migrations. That database-parity run also carries the pin in
 * `dataApiExposure.test.ts`, which had to be told about the new view before it
 * would pass -- so the run proves the view is unreachable from `anon` and
 * `authenticated` rather than merely unmentioned.
 *
 * Contract 205 redefines exactly one function, `get_season_cup_bracket`, at its
 * existing signature and with its existing grants, so that the caller's seed
 * lookup names the membership phase it means. Nothing is added, nothing is
 * removed, and no gate moves: the read was already `authenticated`-only and
 * already gated on entrancy, and the correction narrows a subquery rather than
 * widening any permission. A seeded player who has entered no Championship gets
 * `{entered: false}` from it, exactly as they did at 193 when the read was
 * introduced — and the deterministic seed creates no Championship at all, let
 * alone one that has reached the split phase the defect required.
 *
 * The marker is raised on the runs, not on that paragraph. Both jobs passed at
 * the exact head `4cc7b13`: Database parity (`local-supabase`) run 32238551585
 * and Browser E2E (`authenticated-browser`) run 32238551632, against a database
 * holding all 205 migrations. The database-parity run carries pgTAP suite 241,
 * which contract 205 extends with an entrant holding BOTH an `initial` and a
 * `split` membership — the defect's own precondition, which no existing suite
 * created, and against which the three new assertions ERROR rather than fail
 * before the fix.
 *
 * Contract 206 adds the bounded same-season profile read keyed by the season's
 * `entries.id` playerRef and widens `resolve_season_player.canViewProfile` for
 * compare reach. It deliberately leaves the legacy UUID profile path, pinned
 * rivals and Prediction DNA at their narrower boundaries, and it does not add
 * a new membership or seed prerequisite to the caller's own authenticated
 * journey.
 *
 * The marker is raised on execution evidence, not on that reasoning. At exact
 * Contract-206 head `bfe9252`, Database parity (`local-supabase`) run
 * 32285274468 and Browser E2E run 32285274480 both passed against all 206
 * migrations, including the deterministic seeded authenticated journeys. Later
 * heads only re-anchored moving main and renamed the byte-identical pgTAP suite;
 * they did not change the Contract-206 migration or seed requirements.
 */
export const SEED_REVIEWED_AT_CONTRACT = 206

export type SeedIdentity = {
  key: 'admin' | 'player_one' | 'player_two'
  email: string
  password: string
  displayName: string
  /** Empty for ordinary players; the admin carries explicit tested capabilities. */
  adminCapabilities: readonly string[]
}

/**
 * The deterministic cast. `admin` keeps the historical E2E credentials so
 * existing specs and the `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` overrides
 * continue to resolve to the same account.
 */
export const SEED_IDENTITIES: readonly SeedIdentity[] = [
  {
    key: 'admin',
    email: 'e2e@euro28.local',
    password: 'E2e-local-only-2028!',
    displayName: 'E2E Tester',
    adminCapabilities: ['results', 'competitions'],
  },
  {
    key: 'player_one',
    email: 'e2e-player-one@euro28.local',
    password: 'E2e-local-only-2028!',
    displayName: 'E2E Player One',
    adminCapabilities: [],
  },
  {
    key: 'player_two',
    email: 'e2e-player-two@euro28.local',
    password: 'E2e-local-only-2028!',
    displayName: 'E2E Player Two',
    adminCapabilities: [],
  },
]

export function seedIdentity(key: SeedIdentity['key']): SeedIdentity {
  const found = SEED_IDENTITIES.find((identity) => identity.key === key)
  if (found === undefined) throw new Error(`Unknown seed identity: ${key}`)
  return found
}

/**
 * What every seeded identity must have for authenticated Euro surfaces to
 * render under the current schema. These requirements move with the contract.
 */
export const SEED_REQUIREMENTS: readonly string[] = [
  'a confirmed auth account',
  'a profiles row carrying display_name and welcomed_at',
  'an active Original Predictor game membership for the seeded tournament season',
  'an entries row linked to its canonical game availability and membership',
]
