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
 * Contract 86 is the first of this run that touches a relation the seeded Euro
 * tournament actually uses. It redefines the trigger function behind
 * `bonus_lms_selections` so the picked club may prove it plays in the round
 * from EITHER the tournament fixture link or the season one. The tournament
 * link is unchanged and still checked first, and `season_cup_window_fixtures`
 * holds no row for a tournament window, so the added branch contributes nothing
 * to a Euro pick. That is measured rather than assumed: 30 accept/refuse
 * scenarios were run against the previous function and this one on a scratch
 * PostgreSQL 16, and the 25 that do not involve a season round are identical,
 * refusal text included. `supabase/tests/137_lms_season_selection.sql` asserts
 * the same tournament behaviour against a seeded database. It creates no table,
 * policy or grant, alters no column, and leaves the trigger binding untouched.
 *
 * Contract 87 reaches furthest of any contract in this run, and the note is
 * correspondingly specific. It adds `used_cycle` to `bonus_lms_selections`,
 * replaces the club-uniqueness key with one scoped to that column, and
 * redefines `save_lms_selection` — a browser RPC a seeded Euro user can call.
 *
 * A seeded Euro user is nonetheless unaffected, for a reason that is checked
 * rather than assumed. `used_cycle` defaults to 0, so every existing row is
 * cycle 0, and the used-list reset that advances it is gated to `league_season`
 * competitions and is in any case unreachable for a tournament entrant: a
 * selection's club is keyed to the selection's competition, so a tournament
 * entrant's used clubs and a season round's clubs cannot intersect. A
 * tournament entrant therefore never leaves cycle 0, where
 * `unique (competition_id, user_id, team_id, 0)` accepts and refuses exactly
 * what the old key did — asserted at apply time by the migration itself and
 * again behaviourally in `supabase/tests/138_lms_used_cycle.sql`.
 *
 * `save_lms_selection` keeps its signature, its authentication, published,
 * entrant and elimination checks, its optimistic-concurrency PT409 and its
 * returned shape. The one changed line scopes its reuse check to the cycle,
 * which for a tournament caller spans exactly the rows it always did.
 *
 * Contract 88 redefines the same trigger again, adding ONE exception to the
 * lock arm — and the exception cannot reach the seeded Euro tournament. It
 * requires all three of a `postgres` session (not merely `set role`, which
 * leaves `session_user` alone), an explicitly opened transaction-local
 * capability that is shut by default, and a `league_season` competition. The
 * Euro tournament fails the third unconditionally, so a locked Euro round
 * refuses even a postgres session holding the capability — asserted in
 * `supabase/tests/139_lms_auto_assignment.sql` rather than argued.
 *
 * The writer it exists for, `auto_assign_lms_entrant`, is revoked from every
 * browser role, refuses any round that is not a season Last Man Standing round,
 * and is called by nothing yet. It creates no table, policy or grant and alters
 * no column.
 *
 * Contract 89 adds the season Last Man Standing settlement job: one
 * `predictor_internal` settler, one `public` job function granted to NO role,
 * and an hourly cron entry. A seeded Euro user cannot reach any of it — the
 * job is revoked from every browser role and from `service_role`, and both
 * functions refuse a competition that is not a `league_season` Last Man
 * Standing one, which the Euro tournament's Original Predictor is not.
 *
 * It writes `season_lms_entrant_state`, `bonus_competition_entrants.outcome`
 * and `bonus_competitions.completed_at`, but only for competitions it accepts,
 * so the tournament's rows are untouched. It creates no table, policy or grant
 * and alters no column.
 *
 * Contract 90 adds `season_matchweek_scores`, created empty, RLS enabled and
 * revoked from every browser role, plus one shape trigger that fires only on
 * that new table. It creates no policy or grant on an existing object and
 * alters no existing relation. A seeded Euro user cannot reach it, and the
 * trigger refuses a tournament competition or a non-matchweek round outright,
 * so the Euro tournament could not hold a row in it even if something tried.
 *
 * Contract 91 adds two immutable `predictor_internal` functions — the matchweek
 * settlement resolver and its score predicate — both revoked from every browser
 * role, taking jsonb and returning jsonb, touching no relation at all. It
 * creates no table, trigger, policy or grant and alters none. A seeded Euro
 * user cannot reach either, and the Original Predictor is entry-scoped with no
 * matchweek card to settle.
 *
 * Contract 92 is the first of this run to ALTER an existing relation rather
 * than only add new ones: it puts `replay_fixture_id` on `season_fixtures`,
 * with two CHECKs, a partial unique index and a chain-walk trigger. The column
 * is nullable with no default, so no existing row is rewritten and both CHECKs
 * are satisfied vacuously by the null every current row holds. Nothing the seed
 * creates is reachable either way — `season_fixtures` is season-only, the
 * seeded Euro competition is a tournament, and its shape trigger has refused a
 * non-league-season row since contract 68, so the Euro tournament holds no row
 * in that table to alter.
 *
 * Contract 93 adds the scoring job: two `predictor_internal` functions, one
 * `security definer` tick revoked from every role including `service_role`, and
 * an hourly cron entry. It creates no table, trigger or policy and alters no
 * relation. The tick iterates `tournaments` where `kind = 'league_season'`, and
 * the settler refuses anything else outright, so the seeded Euro tournament is
 * not merely unaffected — it is unreachable by name. The seeded league seasons
 * hold no matchweek fixtures, so the job finds nothing to settle in them either.
 *
 * Contract 94 adds one stable `predictor_internal` function, revoked from every
 * browser role, creating no relation, trigger, policy or grant and altering
 * none. It reads `entries` and `season_matchweek_scores` and returns NULL for
 * anything that is not a league season, so a seeded Euro user's entry cannot
 * appear in its output — and no browser role can call it in any case.
 *
 * Contract 95 is the first of this run to GRANT anything to a browser role:
 * `public.get_season_leaderboard` is executable by `authenticated`. It was
 * checked on that basis rather than waved through as additive. The function
 * refuses a caller with no `auth.uid()`, refuses any tournament id that is not
 * a league season, and refuses any caller holding no entry in the season asked
 * about — so a seeded Euro user calling it with the Euro tournament id gets
 * `Season is required`, and calling it with a seeded league season id gets
 * `This season is not yours to read`. It creates no relation, trigger or
 * policy, alters none, and adds no grant on any existing object.
 *
 * Contract 96 REDEFINES `settle_season_cup_tie` and adds one
 * `predictor_internal` helper, both revoked from every browser role, both pure
 * over jsonb and touching no relation. A redefinition normally deserves more
 * care than an addition, but this function has no caller anywhere — that is
 * why its drift from the TypeScript went unnoticed for two contracts — so no
 * seeded read, tournament or season, can reach it.
 *
 * Contract 97 adds the provider-ingestion custody boundary: two tables in
 * `predictor_internal`, not `public`, so no browser role can reach them by any
 * route — they are outside the Data API's exposed schema entirely, which is a
 * stronger position than a revoked grant on a public table. Its RPCs are
 * service-role only. It creates no relation, policy or grant in `public` and
 * alters none, so no seeded read changes. Committing it does not deploy the
 * `provider-poll` function, configure a provider credential or call a provider,
 * and nothing in it can write a fixture, result, lock, score or standing.
 *
 * Contract 98 moves two reads out of three Cup RPCs and behind neutral
 * `predictor_internal` functions: the Penalty Number goal total and its lock
 * instant. It creates no relation, policy or grant in `public`, and the six new
 * functions are revoked from every browser and service role. The three
 * redefined RPCs keep their signatures, their guards and their refusals; a
 * differential sweep over 700 generated windows found zero divergence on the
 * tournament path, and the seeded Euro data reaches none of it because the seed
 * draws no Cup and settles no Cup round.
 *
 * Contract 99 tightens one CHECK on `entry_automatic_submission_outcomes` so an
 * `invalid` outcome must carry a failure message. The seed writes no automatic
 * submission outcome of any kind, and the pre-validation audit found the table
 * empty in development and production, so nothing seeded or hosted can fail the
 * validated constraint. No column, grant, index or trigger moves.
 *
 * Contract 100 adds a transaction-scoped advisory lock to the two Bonus Games
 * rederive functions. It changes no scoring rule, elimination rule, audit row or
 * return value, and adds no session-scoped lock. Seeding is single-session, so
 * it can neither contend on the lock nor observe it; the only visible difference
 * is that two concurrent result writes for one tournament now serialise, which
 * the seed never performs.
 *
 * Contract 101 removes shared-league membership as the general gate for Euro
 * post-lock entry and profile reveal. It redefines three read RPCs and adds no
 * relation, column, policy, grant or trigger. Two of them (`get_rival_entry`,
 * `get_h2h_rank_history`) already refused every caller before lock, so only
 * their post-lock gate moves. `get_player_profile` GAINS a lock condition as it
 * loses the league one, so pre-lock access is unchanged — a seeded user sees
 * exactly what it saw before lock, and after lock sees more. Authentication is
 * still required everywhere; anonymous access is not opened. Seeded browser
 * journeys read these through the same RPCs and are unaffected before lock.
 */
export const SEED_REVIEWED_AT_CONTRACT = 101

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
