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
 *
 * Contract 102 makes the shared Cup store phase-aware. Existing tournament
 * groups and memberships default to `initial`, the Euro seed creates neither a
 * Cup draw nor a split row, and no browser grant or RPC signature changes.
 * Existing Cup reads and points sources are explicitly kept on the permanent
 * initial roster, so a seeded Euro user sees the same empty/not-entered Cup
 * state as before. The new parent/phase triggers fire only on Cup group or
 * fixture writes, none of which global setup performs.
 *
 * Contract 103 makes a competition instance repeatable: `bonus_competitions`
 * gains explicit public/private scope, series lineage and a bounded completion
 * reason. Every existing row backfills as public and as sequence 1 of its own
 * series. The old total key becomes one live PUBLIC row per season game plus one
 * live row per series, so independent private competitions may coexist without
 * making the public catalogue ambiguous. No competition is completed in either
 * hosted project and no lifecycle driver exists yet, so every seeded read still
 * resolves the same public row. The tournament trigger and catalogue writer now
 * name the exact public/live conflict predicate; bare recreation starts a new
 * series through an internal-only trigger helper. Contract 104 now moves the
 * ten measured tournament+game callers onto explicit instance resolvers: live-only for operational paths and live-then-latest-terminal for read surfaces;
 * with no successor driver yet, every seeded response remains byte-for-byte on
 * the same row.
 *
 * Contract 105 adds two internal integrity functions, one membership trigger and
 * the derived split-table read. The trigger fires only on Cup membership writes;
 * deterministic global setup creates none, and every function remains revoked
 * from browser and service roles. Contract 106 supplies the restart driver.
 *
 * Contract 106 redefines two `predictor_internal` functions and does nothing
 * else — literally two `create or replace function` statements, no grant,
 * relation, policy or trigger. It swaps one resolver call in each so a result
 * corrected after a competition completes still rederives (DATA-009).
 *
 * Verified rather than assumed. The migration was applied to a database already
 * at contract 105 and the browser-visible surface compared before and after —
 * every grant held by anon, authenticated or service_role, every RLS policy and
 * every non-internal trigger, 227 rows. The snapshots are identical. Both
 * functions were already revoked from every browser role and remain so, and
 * neither is reachable from a seeded user in the first place: they are internal
 * rederive legs called by the result-confirmation path, not RPCs.
 *
 * Contract 107 adds one `predictor_internal` function — the Last Man Standing
 * restart driver — and does nothing else: three statements, `create or replace
 * function`, `comment on function`, `revoke all`. No grant, relation, policy or
 * trigger.
 *
 * Verified rather than assumed: applied to a database already at contract 106
 * and the browser-visible surface compared before and after — 227 rows covering
 * every anon, authenticated and service_role grant, every RLS policy and every
 * non-internal trigger. Identical.
 *
 * Worth stating because this one WRITES where the recent internal additions
 * only read: it completes a competition, inserts another and re-enters
 * entrants. None of that is reachable from a seeded user. The function is
 * revoked from every browser and service role, nothing calls it yet — the
 * settlement job still only derives and reports — and it refuses any competition
 * that is not Last Man Standing. A seeded Euro user's reads are unchanged
 * because no restart can occur without a caller, and there is none.
 *
 * Contract 108 is the first of these recent additions that changes the
 * browser-visible surface at all, and the honest statement is that it changes
 * it by exactly one row. The before-and-after comparison went from 227 rows to
 * 228, and the single added line is
 *
 *   trigger|public.bonus_competition_windows|assert_successor_window_after_predecessor
 *
 * Every grant held by anon, authenticated or service_role is identical, every
 * RLS policy is identical, and no other trigger moved. The guard function
 * itself is revoked from every browser and service role.
 *
 * A trigger on a public table is worth pausing on, because it can refuse a
 * write a seeded user was previously able to make. This one cannot reach them.
 * No browser role holds insert or update on `bonus_competition_windows` at all
 * — rounds are operational reference data, published by
 * `scripts/bonus-games/publish-catalogue.sql` and never by a player — so the
 * only writers are the seed path and that script. Both publish first instances,
 * which the guard exempts by construction: it fires only on a competition that
 * names a predecessor. The seeded Euro competitions name none.
 *
 * Contract 109 adds two `predictor_internal` functions, one `public` job and a
 * pg_cron entry, and changes the browser-visible surface not at all: compared
 * against contract 108 it is 228 rows on both sides, identical line for line.
 * Every new function is revoked from `public`, `anon`, `authenticated` and
 * `service_role`, the `public.process_due_lms_restarts` job included — it is
 * reachable only by the scheduler, exactly as contract 89's settlement job is.
 *
 * It does write, and this is the first of these additions that acts on its own
 * schedule: the job restarts a season Last Man Standing competition and
 * schedules its successor. Nothing a seeded Euro user sees can move, because
 * the job selects `tournaments.kind = 'league_season'` and Euro 2028 is
 * `kind = 'tournament'`. It also requires the competition's latest settlement
 * report to conclude `restart_all_reentered`, and the seed writes no settlement
 * reports at all — the season competitions it publishes carry
 * `availability_status = 'inactive'` with no entrants, rounds or fixtures, so
 * on a fresh seed the job's own selection finds nothing to act on.
 *
 * Contract 110 adds one `predictor_internal` function and nothing else — no
 * relation, policy, trigger, grant or scheduled job. The browser-visible
 * surface comparison against contract 109 is 228 rows on both sides,
 * identical. The function is revoked from `public`, `anon`, `authenticated`
 * and `service_role`, and it has no caller: it is the prerequisite the
 * Championship phase driver will use, landed ahead of it.
 *
 * It writes when called, but a seeded Euro user is out of its reach twice
 * over: it refuses any competition that is not `predictor_cup`, and then any
 * whose tournament is not `kind = 'league_season'`. Euro 2028 is
 * `kind = 'tournament'`, so the refusal is explicit rather than incidental.
 *
 * Contract 111 adds one `predictor_internal` function and nothing else. The
 * browser-visible surface comparison against contract 110 is 228 rows on both
 * sides, identical, and it is revoked from `public`, `anon`, `authenticated`
 * and `service_role`.
 *
 * It writes a great deal when it runs — a group, its members and a full
 * round-robin of fixtures — and a seeded Euro user is out of its reach three
 * times over: it refuses any competition that is not `predictor_cup`, then any
 * whose tournament is not `kind = 'league_season'`, and Euro 2028 is
 * `kind = 'tournament'`. It also has no caller, so nothing invokes it on a
 * fresh seed.
 *
 * Contract 112 adds one public table, four `predictor_internal` functions and
 * one trigger. The browser-visible surface comparison against contract 111 is
 * 228 rows before and 229 after, and the single added row is the trigger
 * binding itself — **no grant, no policy and no routine privilege is added for
 * `anon`, `authenticated` or `service_role`.** The table has row level security
 * enabled with no policy and every browser and service grant revoked, so an
 * authenticated session cannot see it at all.
 *
 * That is the shape that matters for this guard, whose failure mode is a
 * migration introducing a gate on an authenticated read the seed does not
 * satisfy. Contract 112 introduces no gate: it modifies no existing relation,
 * policy, grant or trigger, and the only object a seeded user could encounter
 * is one they have no privilege to reach and no reason to. The trigger fires
 * on writes to the new table alone.
 *
 * The map also starts empty and has no caller, so a fresh seed neither
 * populates it nor consults it.
 *
 * Contract 113 adds two nullable columns to `competition_rounds`, three
 * `predictor_internal` functions and one trigger. The browser-visible surface
 * comparison against contract 112 is 229 rows before and 230 after, and the
 * single added row is the trigger binding itself — no grant, no policy and no
 * routine privilege for `anon`, `authenticated` or `service_role`.
 *
 * The column addition is the part worth checking rather than assuming, because
 * adding a column to a table a browser can read widens what a browser can see.
 * Measured: `competition_rounds` is granted to `service_role` only, so the new
 * window columns reach no browser session at all. The migration asserts that in
 * its own final block, so a future grant to `anon` or `authenticated` makes
 * this migration's reasoning fail loudly rather than quietly become untrue.
 *
 * Both columns start NULL and nothing derives them on a fresh seed, so a seeded
 * user meets no new gate: the trigger fires only on writes that set a window.
 *
 * Contract 114 re-verified: the season card RPCs read and write rows the seed
 * never creates (no seeded user holds a season entry), the new version column
 * defaults to 0 on a table the seed does not touch, and the delete-path lock
 * triggers judge deletes the seed never performs. No seed change is required.
 */
/**
 * Contract 115 installs `pg_net`, adds two tables — one `public`, one
 * `predictor_internal` — four `predictor_internal` functions, one `public` job
 * function, one trigger and one `pg_cron` schedule. This is the first contract
 * in the run whose surface comparison is NOT "one trigger and nothing else",
 * and the difference is worth stating precisely rather than rounding down.
 *
 * Where the platform owns pg_net — which is the case on the CI image and the
 * case to plan for on hosted — the comparison is four added rows, not one. One
 * is the `updated_at` trigger. The other three are `routine|anon|net.http_post`,
 * `routine|authenticated|net.http_post` and
 * `routine|service_role|net.http_post` — pg_net's own grants, shipped by
 * Supabase's image, which this migration attempts to revoke and cannot. On a
 * project where this migration installs the extension and owns it, the revoke
 * succeeds and only the trigger is added.
 *
 * Installing an extension is the part worth checking rather than assuming,
 * because an extension's functions are executable by PUBLIC by default. The
 * migration attempts the revoke, reports the residual, and enforces the
 * boundary it does control: no browser-reachable function in an exposed schema
 * may call into `net`, which is the actual path from a session to an outbound
 * request.
 *
 * That distinction is why the three extra rows do not change this guard's
 * answer. The surviving grant is on `net.http_post`, not on anything a seeded
 * user's session reads, and browser roles reach this database through
 * PostgREST, which exposes `public` and `graphql_public` only — `net` is not
 * among them, so the grant is not callable from a session. The poll target list
 * starts empty, the job reports itself unconfigured until two vault secrets
 * exist, and nothing on any authenticated surface reads either new table.
 */
/**
 * Contract 117 adds one `predictor_internal` table, one `predictor_internal`
 * importer, one immutability trigger bound to that new table, and nothing else.
 * It creates no relation a browser can reach, alters no existing relation,
 * policy or grant, and its trigger fires only on the new table.
 *
 * A seeded user meets no new gate, and cannot: the revision record is revoked
 * from every browser and service role, and the importer is reachable only by a
 * definer caller. It also writes nothing on a fresh seed — it revises fixtures a
 * provider payload names, and a seeded database has no payload.
 */
/*
 * Re-verified at contract 118, the first in this run to change an EXISTING
 * browser-reachable function rather than add one: `get_bonus_games` now reads
 * neutral window fixture facts instead of joining the tournament relation. The
 * seeded Euro data is a tournament, so it flows down the tournament limb and
 * the combiner returns exactly the rows the old join returned — asserted in
 * `169_neutral_window_fixture_facts.sql` rather than argued here. No new table,
 * grant or seeded row is involved, so the seed itself is untouched.
 */
/**
 * Contract 119 adds one `predictor_internal` authority and redefines contract
 * 114's lock trigger. It creates no relation, no policy and no grant, and adds
 * no trigger binding.
 *
 * It is behaviour-neutral on a fresh seed, and measurably so: the new rule only
 * applies to a fixture with a `season_fixture_revisions` row, a seeded database
 * has none, and the authority returns the matchweek instant for everything
 * else. So a seeded user's lock is the instant it already was.
 */
/*
 * Re-verified at contract 120, which adds one browser-reachable read and
 * nothing else: `public.get_season_cup_phase`. It creates no relation, policy,
 * trigger or column, alters no existing function, and adds no grant to any
 * relation -- only `execute` on the new function, to `authenticated`.
 *
 * So a seeded user meets no new gate, and the check that matters here is that
 * no EXISTING read acquired one. None did: the migration's only DDL is the
 * function and its grant.
 *
 * The new read is also behaviour-neutral on a fresh seed. It resolves the
 * caller's own `bonus_cup_members` row, and a seeded database holds no season
 * Championship membership, so a seeded user receives `entered: false` -- the
 * deliberate non-entrant answer rather than an error.
 */
/**
 * Contract 121 adds one `public` function, `get_season_play_context`, and
 * nothing else. It creates no relation, no trigger, no policy and no RLS
 * change; it alters no existing relation, function or grant; and its only
 * privilege movement is `grant execute ... to authenticated` on the new
 * function itself, revoked from `public` and `anon`.
 *
 * It therefore cannot gate an authenticated read, which is the failure this
 * number exists to catch: it ADDS a capability rather than restricting one, and
 * a seeded user who never calls it is in exactly the state contract 119 left
 * them in. Nothing a seeded Euro user reads goes near it — the function
 * refuses any competition whose `kind` is not `league_season`.
 *
 * Reasoned rather than executed, and that is worth being explicit about: the
 * environment this was raised in had no usable Docker, so no seeded session was
 * driven against it. That is the same standard every entry above uses — each
 * one argues from what the migration changes — but it is not a browser run, and
 * Database parity in CI is the first execution of either the migration or its
 * pgTAP suite.
 */
/**
 * Contract 122 adds one `public` function, `get_season_period_standings`, two
 * `predictor_internal` helpers and a backfill. It creates no relation, trigger,
 * policy or RLS change, and alters no existing function.
 *
 * The backfill is the only part that writes anything: it runs contract 113's
 * `derive_round_play_windows` once per league season, setting
 * `competition_rounds.window_opens_at` and `window_closes_at` from each round's
 * own fixtures. A seeded Euro user is untouched — the loop selects
 * `kind = 'league_season'` — and no seeded gate moves, because the columns it
 * writes are read only by contract 113's resolver and by the new month
 * calendar.
 *
 * Reasoned rather than executed, on the same standard as the entries above:
 * this environment has no usable Docker, so Database parity in CI is the first
 * execution of both the migration and `174_season_period_standings.sql`.
 */
/**
 * Contract 123 adds one `predictor_internal` relation
 * (`round_window_refresh_conflicts`), its append-only trigger, two indexes and
 * one `predictor_internal` function, and redefines contract 117's importer —
 * also `predictor_internal`, also revoked from every browser role. It adds no
 * `public` function, changes no grant, policy or RLS on any relation a seeded
 * session can reach, and alters no browser-reachable function.
 *
 * It writes nothing on application: the migration asserts its own queue is
 * empty and refreshes no window, so a seeded user is in exactly the state
 * contract 122's backfill left them in. The only column it can ever write is
 * `competition_rounds.window_opens_at`/`window_closes_at` on a league season
 * whose fixtures a provider moved, and both are already read by nothing a
 * seeded Euro user touches.
 *
 * Reasoned rather than executed, on the same standard as the entries above:
 * this environment has a `docker` binary and no usable daemon, so Database
 * parity in CI is the first execution of both the migration and
 * `175_round_window_stale_refresh.sql`.
 */
/**
 * Contract 124 adds one `predictor_internal` driver and redefines
 * `cup_final_group_tables` — also `predictor_internal`, also revoked from every
 * browser role — to filter its members to the initial phase. It creates no
 * relation, trigger, policy or RLS change, adds no `public` function, and
 * changes no grant a seeded session can reach.
 *
 * It writes nothing on application: the migration asserts it has created no
 * split group. The redefinition is behaviour-neutral to every existing row,
 * because `phase_kind` defaults to 'initial' and nothing has ever written
 * anything else — so a seeded Euro user's Cup tables are identical before and
 * after.
 *
 * Reasoned rather than executed, on the same standard as the entries above:
 * this environment has a `docker` binary and no usable daemon, so Database
 * parity in CI is the first execution of both the migration and
 * `176_season_cup_split_transition.sql`.
 */
/**
 * Contract 125 adds one `predictor_internal` relation
 * (`season_fixture_result_revisions`, RLS enabled and revoked from every
 * browser role), its immutability trigger, one internal writer and three
 * `public` administrator entry points granted to `authenticated`.
 *
 * The three entry points are the first thing in this run a seeded session can
 * REACH, so they were checked rather than waved through: each calls
 * `predictor_internal.require_result_admin()` before anything else, and a
 * seeded player carries no `admin_role` and no `results` capability, so all
 * three refuse with 42501 and touch nothing. No existing grant, policy or
 * relation changes, and the migration records no result on application.
 *
 * Reasoned rather than executed, on the same standard as the entries above:
 * this environment has a `docker` binary and no usable daemon, so Database
 * parity in CI is the first execution of both the migration and
 * `177_season_fixture_result_entry.sql`, which drives the refusal with a real
 * non-admin session rather than inspecting the grant.
 */
/**
 * Contract 126 redefines one browser-reachable function,
 * `public.join_competition_game`, and adds one `predictor_internal` helper
 * revoked from every role. It creates no relation, trigger or policy and
 * changes no grant.
 *
 * The redefinition RELAXES a refusal and adds none: a game whose definition
 * forbids rejoining is now refused only once the competition is running. A
 * seeded user's reads are untouched, and the only seeded write it could reach —
 * joining a game — either behaved identically before (every game except Last
 * Man Standing has allow_rejoin true) or was refused when it should not have
 * been.
 *
 * Reasoned rather than executed, on the same standard as the entries above:
 * this environment has a `docker` binary and no usable daemon, so Database
 * parity in CI is the first execution of both the migration and
 * `178_rejoin_before_start.sql`, which drives the join, leave and rejoin
 * against a real competition in both states.
 */
/**
 * Contract 127 adds one `public` administrator entry point granted to
 * `authenticated` (`admin_open_season_competition`) and three
 * `predictor_internal` functions revoked from every role. It creates no
 * relation, trigger or policy, and changes no existing grant.
 *
 * The entry point is the only thing here a seeded session can REACH, and it is
 * gated differently from every other admin RPC in this repository: the seeded
 * admin identity below carries `results` and `tournament` capabilities and no
 * `admin_role`, so it is refused with 42501 alongside the two ordinary players.
 * That is the intended shape rather than a gap — opening a competition fixes a
 * draw and a calendar that can never be redrawn, and the `competitions`
 * capability exists to be granted deliberately. If a seeded session ever needs
 * to open one, the seed grants that capability rather than this contract
 * widening its gate.
 *
 * Reasoned rather than executed, on the same standard as the entries above:
 * this environment has a `docker` binary and no usable daemon, so Database
 * parity in CI is the first execution of both the migration and
 * `179_season_competition_bootstrap.sql`, which drives the refusal with an
 * ordinary player AND with a `results` administrator, so a contract that
 * reused the result gate would fail there.
 */
/**
 * Contract 128 adds one browser-reachable read (`get_season_league_standings`,
 * granted to `authenticated`) and redefines `get_league_members`. It creates no
 * relation, trigger or policy, and changes no existing grant.
 *
 * The redefinition is the only thing here that changes what a seeded session
 * already does, and it was checked rather than waved through: the seeded
 * leagues are all on the Euro tournament, whose `tournaments.kind` is
 * `tournament`, so the inserted guard does not fire and the read returns
 * exactly what it did before. A seeded session that creates a league on a
 * competition season would now be refused by that read and served by the new
 * one — which is the correction, since the old answer was every member on zero.
 *
 * Reasoned rather than executed, on the same standard as the entries above:
 * this environment has a `docker` binary and no usable daemon, so Database
 * parity in CI is the first execution of both the migration and
 * `180_season_league_standings.sql`, which drives the refusal and the new table
 * against one league holding real banked matchweek totals.
 */
/**
 * Contracts 129 to 131 add two browser-reachable season reads
 * (`get_season_head_to_head`, `get_season_prediction_consensus`), two
 * `predictor_internal` helpers revoked from every role, and REPLACE the
 * signature of `get_season_period_standings` with a four-argument form.
 *
 * The replacement is the only thing that could break a seeded session, and it
 * cannot: the old three-argument signature is dropped and the new one defaults
 * its fourth parameter, so an existing three-argument call resolves to it and
 * returns the same object. The two new reads refuse a caller with no season
 * entry, which every seeded Euro identity is, so they are unreachable in
 * practice rather than merely unused. No relation, trigger, policy or existing
 * grant changes.
 *
 * Reasoned rather than executed, on the same standard as the entries above:
 * this environment has a `docker` binary and no usable daemon, so Database
 * parity in CI is the first execution of the three migrations and of
 * `181_season_head_to_head.sql`, `182_season_prediction_consensus.sql` and
 * `183_period_standings_display_names.sql`.
 */
/**
 * Contract 132 adds the initial provider-fixture approval boundary. Its new
 * public RPC is administrator-only, the projection helpers live behind the
 * internal schema boundary, and no existing authenticated read is tightened or
 * replaced. Exact-head Database parity passed, and the authenticated Browser
 * E2E suite passed with the deterministic seed before this marker was raised.
 *
 * Contract 133 adds two new authenticated season Championship reads only:
 * `get_my_season_cup_instances` and `get_season_cup_player_view`. It creates no
 * relation, trigger, policy or existing-grant change and does not replace or
 * tighten any existing authenticated read. Both new reads are explicitly
 * `league_season`-scoped, while the deterministic Euro seed resolves the
 * tournament-kind UEFA Euro 2028 path, so its existing seeded journey is not
 * gated by the new functions. Exact-head Database parity and Browser E2E both
 * passed on the Contract-133 PR before this marker was raised.
 *
 * Contract 134 is the one entry in this list that changes privileges on an
 * EXISTING table rather than adding a revoked new one, so it gets more than the
 * usual sentence. It revokes `public.rate_limit_events` and its identity
 * sequence from `anon` and `authenticated`, closing `DB-005`. A seeded user
 * never reads that table — nothing in `src/` references it — but every seeded
 * prediction save WRITES to it, through the `before insert or update` trigger on
 * `match_predictions` that calls `enforce_rate_limit`. That function is
 * `security definer`, so it reaches the table as its owner and not as the
 * caller, which is why the revoke cannot reach the seeded write path.
 * `187_rate_limit_events_client_revoke.sql` drives that rather than asserting
 * it: after the revoke it logs two events, refuses the third at the ceiling and
 * prunes a stale one. No relation, policy, trigger, threshold or function
 * definition moves, and `service_role` is untouched. Exact-head Database parity
 * and Browser E2E must both pass on the Contract-134 PR before this marker is
 * relied on; they are what re-verifies the seeded prediction-save journey, since
 * a definer boundary is exactly the kind of reasoning that deserves a driven
 * check.
 *
 * Raised to 136 on 9 August 2026. Neither contract adds or moves a gate on an
 * authenticated read, which is the property this marker exists to track:
 *
 * - contract 135 grants nothing to `anon` or `authenticated` at all. Its six
 *   relations are `predictor_internal`, revoked from both browser roles and
 *   from `service_role`, and its functions are revoked from everything and
 *   reached only by `pg_cron`. A seeded browser user cannot call any of it, so
 *   there is no seeded journey for it to break;
 * - contract 136 changes what `get_season_matchweek_card` RETURNS — four club
 *   identity fields and a provisional live block — without touching its
 *   signature, its grant or `season_card_context`, which is where its access
 *   decision has always lived. A seeded entrant reads exactly the rows they
 *   read before, with more on each.
 *
 * The added fields are nullable by construction: a club the identity reference
 * does not name comes back null and renders as the neutral fallback, which is
 * how EVERY club rendered before this contract. So the seed cannot fail closed
 * on data it lacks.
 *
 * Raised again to 137: that contract redefines one immutable helper and inserts
 * reference rows. It adds no relation, no grant and no gate, and it makes MORE
 * clubs resolve than before, so no seeded read can be narrowed by it.
 *
 * Raised again to 139. Contract 138 adds two admin-gated RPCs a seeded player
 * cannot execute — the gate refuses inside, which its own suite drives with a
 * real non-admin session — and one internal relation with no browser grant.
 * Contract 139 adds a read that any signed-in caller may make and that
 * discloses no entry, so it cannot narrow an existing seeded journey either.
 *
 * Exact-head Database parity and Browser E2E must still both pass on the
 * contract 138/139 pull request before this marker is relied on — the reasoning
 * above is what makes raising it defensible, not what verifies it.
 *
 * Raised to 145 on 10 August 2026, and this one touches the seeded write path
 * rather than sitting beside it, so it gets more than a sentence. Contract 145
 * redefines `enforce_rate_limit` to take a transaction-scoped advisory lock
 * before it counts. Every seeded prediction save runs through that function, by
 * way of the `before insert or update` trigger on `match_predictions`, so the
 * seed exercises it on every journey that saves a score.
 *
 * Three properties keep the seeded journey unchanged. The ceilings do not move,
 * so a run that fitted under 60 saves a minute still does. The lock is keyed on
 * the calling user, so the seed's three identities never wait on each other,
 * and a single-session seed never waits at all. And it is transaction-scoped,
 * so it is released by the commit or rollback that ends the statement's
 * transaction and cannot leak into the next pooled connection — the failure
 * mode that would wedge a suite rather than fail it.
 *
 * `195_rate_limit_atomicity.sql` drives the ceiling, the refusal, the recovery
 * once the window slides, the prune and the unauthenticated no-op AFTER the
 * redefinition. Exact-head Database parity and Browser E2E must still both pass
 * on the contract 145 pull request before this marker is relied on; that is
 * what re-verifies the seeded prediction-save journey itself.
 *
 * Contract 146 cannot gate an authenticated read, which is the single failure
 * this number exists to catch, and the reason is structural rather than a
 * judgement about what it happens to touch. It adds three columns and four
 * check constraints to `public.provider_poll_targets`, and redefines two
 * functions plus adds two more, all four of which live in
 * `predictor_internal` and are revoked from `public`, `anon`, `authenticated`
 * and `service_role`. A seeded user cannot execute any of them and cannot read
 * the table. It creates no policy, moves no grant, and adds no trigger to any
 * relation a seeded journey writes — `season_fixtures` is read by the new live
 * check but not written by it.
 *
 * The one thing it does change for a seeded environment is how often the
 * provider poll fires, and it changes it downward: a target with no fixture
 * near it drops from every five minutes to once a day. A seed that depended on
 * the poll running constantly would be depending on a background job it never
 * declares, which is not a dependency this file is willing to invent.
 * Exact-head Database parity and Browser E2E must still both pass on the
 * contract 146 pull request before this marker is relied on.
 *
 * Contracts 147 and 148 add two read-only functions and nothing else: no table,
 * column, policy, trigger, grant on a relation, or default. Both are new names
 * rather than redefinitions, so no existing call can start behaving
 * differently, and both refuse an unauthenticated caller exactly as every other
 * season read already does. A seeded user's journey is unchanged because
 * nothing a seeded journey calls has moved.
 */
/**
 * Contract 149 adds one read-only function and nothing else: no table, column,
 * policy, trigger, relation grant or default. It is a new name rather than a
 * redefinition, so no existing call can behave differently, and it refuses an
 * unauthenticated caller as every season read already does.
 */
/**
 * Contract 150 adds one more read-only function on the same terms as 149: a new
 * name, no table, column, policy, trigger, relation grant or default, and an
 * unauthenticated caller refused.
 */
/**
 * Contract 151 completes the MIG-UI read batch on the same terms as 149 and
 * 150: a new function name, no table, column, policy, trigger, relation grant
 * or default, and an unauthenticated caller refused.
 */
/**
 * Contracts 152 to 157 add function names and four relations no seeded journey
 * touches: every one is a new name, and none redefines a call a seeded user
 * already makes. Contract 153 is the exception worth stating — it narrows
 * `join_competition_game` to refuse a PRIVATE competition — and no seeded
 * journey joins one, because before contract 152 a private competition could
 * not be created at all.
 *
 * Contract 158 is the first in this list that changes what an EXISTING
 * authenticated read returns, so it is the first for which the answer is not
 * "nothing a seeded journey calls has moved".
 *
 *   - `gen_invite_code()` now returns TWELVE characters, not six. A journey
 *     that creates a league and reads its code back has to accept the longer
 *     form; `private-league-invite.spec.ts` extracted exactly six and now
 *     accepts `{6,16}` — both, because codes issued before this contract are
 *     untouched and still six.
 *   - `get_league_preview` no longer returns `id`, `member_count` or
 *     `owner_name`, so the join screen no longer renders "1 member" or
 *     "Owner: …". The same spec asserted both and now asserts their ABSENCE,
 *     which is the boundary rather than a deletion — both reappear on the
 *     league page after joining, because a member may see the membership.
 *   - `get_league_preview` and `join_league` now charge a 20/min
 *     `league_invite_probe` limit. Neither can gate a seeded journey: a seeded
 *     user previews and joins a handful of times, and the join path was already
 *     under the stricter 5/min membership trigger, which is unchanged.
 *   - `leagues_invite_code_check` WIDENED from `{6}` to `{6,16}`, and the
 *     private-container constraints and contract 155's resolver widened with
 *     it. A widened check cannot reject a row that previously inserted, so no
 *     seeded fixture can start failing on one.
 *   - `rotate_league_invite_code` is a new name called by nothing.
 *
 * Contract 159 narrows `resolve_invite_code` — it stops returning the target's
 * `id` and the member count, and starts charging the same 20/min
 * `league_invite_probe` limit contract 158 gave the other two doors. Measured
 * rather than assumed: `grep -rn resolve_invite_code src/ e2e/ tests/` finds
 * exactly ONE hit, the generated `database.types.ts` entry, whose return type is
 * `Json` and therefore does not narrow. No seeded journey calls it, no fixture
 * reads either removed field, and the limit is far above what a journey spends.
 *
 * Contract 160 adds `season_table_rules`, `season_table_adjustments` and
 * `season_fixture_awards` — all three created EMPTY and revoked from every
 * browser role — plus `get_competition_table` and three administrator writes,
 * all new names called by nothing. It alters no existing relation, redefines no
 * existing function and adds no trigger to an existing table, so nothing a
 * seeded journey reads can have moved. Its one trigger fires only on
 * `season_fixture_awards`, which no seed writes.
 *
 * Contracts 161 to 164 add five relations — `player_action_items`,
 * `player_action_state`, `reminder_deliveries` and contract 160's three — all
 * created EMPTY and revoked from every browser role, plus eleven new function
 * names called by nothing that exists today. Measured rather than assumed:
 * none of the four alters an existing relation, redefines an existing function,
 * or adds a trigger to an existing table, so no path a seeded journey takes can
 * have moved.
 *
 * Contract 163 is the one worth stating separately, because a delivery contract
 * sounds like something that could act on a seeded account. It applies INERT:
 * it names no provider, holds no credential, makes no outbound call, `dry_run`
 * defaults to true, and neither of its jobs is scheduled by the migration. A
 * seeded user gains no queued mail by applying it.
 *
 * Contracts 165 to 168 add NO relation at all — they are functions only, and
 * every one of the six is a new name called by nothing that exists today. No
 * existing relation, policy, trigger, grant or function is altered, so no path
 * a seeded journey takes can have moved.
 *
 * Contract 166 is the only one that writes, and only when an administrator
 * explicitly calls it: applying the migration draws no Championship. A seeded
 * user's competitions are untouched by the apply.
 *
 * THIS MARKER IS RAISED ON CI EVIDENCE, not on local execution. The authoring
 * environment has no seeded database, so no seeded user was driven here. Exact-
 * head Browser E2E is what proves it, and it must be green on the pull request
 * that carries this line — which is the same standard contracts 67, 68 and 69
 * were held to, stated rather than assumed.
 *
 * Contract 169 REDEFINES two existing reads rather than adding any, and this is
 * the case where the guard has to be reasoned about rather than waved through.
 * `get_season_cup_phase` and `get_season_cup_group_stage` keep their exact
 * signatures, their `authenticated`-only grants, their entrancy gates and their
 * non-entrant shapes; the stage read is byte-identical to contract 167's apart
 * from one substituted internal call, asserted by diff in
 * `tests/database-parity/seasonCupInitialTableParity.test.ts`. The three new
 * `predictor_internal` functions are granted to nobody, so no browser role
 * gains or loses a path.
 *
 * The one payload change is ADDITIVE: `get_season_cup_phase` gains a
 * `table_source` key. A seeded journey reading that payload sees every key it
 * saw before.
 *
 * A seeded user is also unaffected in fact as well as in shape, because no
 * seeded user is in a Predictor Championship group: neither `launch_season_cup`
 * nor `admin_launch_cup_group_stage` is called by the seed, so both reads
 * answer `entered: false` for a seeded user exactly as they did at 168.
 * Contract 170 adds a generator to a job no browser can call and redefines two
 * `predictor_internal` functions granted to nobody. `process_player_action_items`
 * keeps its name, its `service_role`-only grant and its return shape, gaining one
 * counter. No relation, policy, trigger or browser grant moves, and the seed
 * never runs the job — so a seeded user's action inbox is empty at 170 exactly
 * as it was at 169, and no seeded read gains a gate.
 *
 * Contract 171 redefines two reads without changing either signature, either
 * grant, either membership gate or either reveal boundary, and adds only keys.
 * A seeded league is far below both caps, so both reads answer a seeded user
 * exactly as they did at 170 with `members_truncated` false.
 *
 * Contract 172 schedules three `pg_cron` jobs and adds one browser-executable
 * function. The jobs run `process_player_action_items`,
 * `process_reminder_schedule` and `reclaim_stalled_reminders`, all of which
 * were already `service_role`-only and none of which gains a grant here — so
 * nothing a seeded user CALLS changes. What does change is that a seeded user's
 * action inbox is no longer necessarily empty, because the generator now runs;
 * that is an addition to `get_my_actions`, which is already granted, already
 * caller-scoped and already returns an empty list when there is nothing to
 * show. It gates no existing read. `admin_reminder_delivery_health` is new and
 * granted to `authenticated`, and refuses inside on
 * `require_competition_admin()` — the same gate the seeded admin already
 * passes for `admin_open_season_competition` — so it adds a surface rather than
 * a condition on one.
 *
 * Contract 173 adds a third generator to that same job and redefines
 * `process_player_action_items` with one extra call, keeping its name, its
 * `service_role`-only grant and every existing key of its return. Its generator
 * is `predictor_internal` and granted to nobody. It creates no relation, policy
 * or trigger, and writes only `player_action_items` rows of a type the existing
 * CHECK already permitted, so no seeded read gains a gate.
 *
 * Contract 174 creates one relation in `predictor_internal`, with row-level
 * security on and no grant to any browser role, so no seeded read can reach it
 * at all. Its two new functions are granted to `authenticated` and both refuse
 * inside on `require_competition_admin()` — the gate the seeded admin already
 * passes for `admin_open_season_competition`, and the gate an ordinary seeded
 * player already fails elsewhere. It redefines
 * `predictor_internal.consume_provider_responses`, which no browser role may
 * execute and which the seed never runs. **No existing relation, policy,
 * trigger or grant moves**, and the one behaviour change reachable from a
 * seeded session is that an administrator has a second queue to read.
 *
 * Contracts 175 to 178 are checked against the one question this number exists
 * to answer — has a migration introduced a new gate on something a seeded user
 * already reads — and the answer is no, for a reason that holds across all four
 * rather than four separate reasons.
 *
 * **Every one of them is purely additive to the surfaces a seeded session
 * touches.** No existing relation, function, policy, trigger, grant or default
 * privilege is altered by any of the four; `git diff` over the migration set
 * shows five `create or replace function` statements against names that did not
 * previously exist, two `create table` statements in `predictor_internal`, and
 * no `alter` against anything a seeded read reaches. Contract 177 is the only
 * one that writes at all, and it writes by calling `save_season_prediction`
 * unchanged rather than by touching the table — its own source assertion
 * refuses a definition that does otherwise — so the seeded write path is
 * literally the same code it was at 174.
 *
 * The two new relations are `predictor_internal.shadow_scoring_runs` and
 * `shadow_scoring_mismatches`, both with row-level security on and revoked from
 * both browser roles, so no seeded read can reach them at all. Of the five new
 * functions, three are granted to `authenticated` and resolve their own
 * boundary internally, one refuses inside on `require_competition_admin()` —
 * the gate the seeded admin already passes for `admin_open_season_competition`
 * — and one is `service_role`-only and is never called by the seed.
 *
 * The seeded Euro tournament is additionally out of scope for all four by
 * construction: every one of them refuses a competition whose `kind` is not
 * `league_season`.
 */
export const SEED_REVIEWED_AT_CONTRACT = 178

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
