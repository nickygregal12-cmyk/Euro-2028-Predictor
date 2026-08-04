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
 * Raised to 67 after checking what contract 67 actually changes: it moves
 * `game_definitions.lock_scope` for `main_predictor` and `last_man_standing`
 * from 'round' to 'matchweek'. That column is only ever *emitted* — passed
 * outward in the `lock_policy` payload of `get_competition_games` — and no SQL
 * function branches on it (the gating branches on `requires_prediction_entry`),
 * nor does any browser code read it. It therefore cannot gate an authenticated
 * read, which is the failure this number exists to catch.
 *
 * Contract 68 adds `season_fixtures`, revoked from every browser role and
 * created empty, plus two composite unique constraints on `teams` and
 * `competition_rounds` that add a key rather than restricting an existing one.
 * Nothing a seeded Euro user reads changes.
 *
 * Contract 69 adds `season_predictions` and `season_matchweek_jokers`, both
 * revoked from every browser role and created empty, plus composite unique
 * keys on `entries` and `season_fixtures` that add a key rather than
 * restricting an existing one. Its triggers fire only on the two new tables,
 * so no path a seeded Euro user takes is affected.
 *
 * Contract 70 adds two `predictor_internal` scoring functions, both revoked
 * from every browser role. It creates no table, no trigger and no policy, and
 * changes no existing relation, so nothing a seeded user reads is gated by it.
 *
 * Contract 71 adds one further `predictor_internal` function on the same
 * terms: immutable, revoked from every browser role, touching no relation.
 *
 * Contract 72 adds `season_lms_setups` and `season_lms_entrant_state`, both
 * created empty and revoked from every browser role. Their triggers fire only
 * on those two tables, and no existing relation, policy or grant changes.
 *
 * Contract 73 adds two further `predictor_internal` functions, both immutable
 * and revoked from every browser role, touching no relation at all.
 *
 * Contract 74 adds three more on the same terms — the season Cup's tie
 * settlement, format selection and launch threshold. All immutable, all
 * revoked from public, anon and authenticated, creating no table, trigger,
 * policy or grant and altering no existing relation. It notably does NOT touch
 * the existing `predictor_internal.cup_*` functions, which the tournament
 * surfaces do reach; a seeded Euro user's reads are unchanged.
 *
 * Contract 75 splits `cup_window_scores` into a tournament points source and
 * shared arithmetic. Both are `predictor_internal`, revoked from every browser
 * role, and the split is behaviour-preserving with the signature unchanged, so
 * every existing caller and every seeded read is unaffected. It creates no
 * relation, trigger, policy or grant.
 *
 * Contract 76 does the same for `cup_window_settled`, on the same terms:
 * `predictor_internal` only, revoked from every browser role,
 * behaviour-preserving, signature unchanged, no relation, trigger, policy or
 * grant created or altered.
 *
 * Contract 77 adds `season_cup_window_fixtures` — created empty, RLS enabled,
 * revoked from every browser role — and two `predictor_internal` season
 * sources on the usual terms. The shared Cup functions now union both sources;
 * with the season link empty the union is the identity, proven over 300
 * randomised tournament scenarios, so a seeded Euro user's Cup reads are
 * unchanged. No existing relation, trigger, policy or grant is altered.
 *
 * Contract 78 adds one immutable `predictor_internal` function, revoked from
 * every browser role, creating no relation, trigger, policy or grant and
 * altering none. Nothing a seeded user reads is gated by it.
 *
 * Contract 79 WIDENS two CHECK constraints on `bonus_cup_groups` and
 * `bonus_cup_fixtures` rather than adding anything. This is the first contract
 * in the run that relaxes an existing constraint, so it was checked more
 * carefully than the additive ones: the widening is strictly permissive, so
 * every row a seeded user can already reach still satisfies the new domain, and
 * no relation, trigger, policy or grant changes. A seeded Euro user's Cup reads
 * are unaffected because the tournament writes the same sizes and matchdays it
 * always did — `cupStoreDomains.test.ts` pins that.
 *
 * Contract 80 adds two immutable `predictor_internal` functions, revoked from
 * every browser role, creating no relation, trigger, policy or grant and
 * altering none. Nothing a seeded Euro user reads is gated by it.
 *
 * Contract 81 adds `season_matchweek_cards` and
 * `season_matchweek_submission_outcomes`, both created empty, RLS enabled and
 * revoked from every browser role. Its one trigger fires only on the outcome
 * ledger, blocking update and delete there; it binds to no existing relation,
 * and no policy, grant or existing relation changes. A seeded Euro user reads
 * neither table, and cannot: both are unreachable from `anon` and
 * `authenticated` alike.
 *
 * Contract 83 adds two immutable-in-effect `predictor_internal` derivations and
 * one `public` server job, revoked from every browser role and granted only to
 * `service_role`. It creates no relation, trigger, policy or grant on an
 * existing object, and reads only the season tables contracts 68, 69 and 81
 * added — all of which are empty and unreachable from a seeded Euro user. Its
 * cron entry drives that job, which finds nothing in a tournament season
 * because it selects matchweek-scoped games holding a prediction entry and
 * `league_matchweek` rounds, neither of which a Euro seed has.
 *
 * Contract 82 REDEFINES one `predictor_internal` function — the matchweek card
 * resolver — and adds nothing. It stays immutable and revoked from every
 * browser role, creates no relation, trigger, policy or grant, and alters no
 * existing one. Its apply-time DO block only calls the function it just
 * defined. A seeded Euro user cannot reach it: the Original Predictor is
 * entry-scoped and has no matchweek card. Contract 83 is the scheduler,
 * unchanged in reach from the note below.
 *
 * Contract 84 adds two immutable `predictor_internal` functions — Last Man
 * Standing eligibility and auto-assignment — revoked from every browser role,
 * taking jsonb and returning jsonb, touching no relation at all. It creates no
 * table, trigger, policy or grant and alters none. Its apply-time DO block only
 * calls the function it just defined. A seeded Euro user cannot reach either,
 * and the Euro tournament has no Last Man Standing season entrant to be
 * assigned a club in the first place.
 *
 * Contract 85 adds three `predictor_internal` functions — the LMS
 * result-to-outcome rule, a per-window reader over `season_cup_window_fixtures`
 * and `season_fixtures`, and the season replay — all revoked from every browser
 * role. It creates no table, trigger, policy or grant, alters none, and writes
 * no row: nothing calls these yet. The two relations the reader touches are
 * season-only and empty, and a Euro tournament season has no LMS windows to
 * read.
 *
 * Contract 86 adds two `predictor_internal` custody tables with RLS enabled and
 * no browser grants, plus two service-role-only RPCs. The Edge Function checks
 * a named caller key before provider I/O, archives raw evidence before decode,
 * and has no authority path into official fixtures, results, locks, scores or
 * standings. No seeded application relation, policy or browser grant changes.
 */
export const SEED_REVIEWED_AT_CONTRACT = 86

export type SeedIdentity = {
  key: 'admin' | 'player_one' | 'player_two'
  email: string
  password: string
  displayName: string
  /** Empty for ordinary players; the admin carries result capabilities. */
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
    adminCapabilities: ['results'],
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
