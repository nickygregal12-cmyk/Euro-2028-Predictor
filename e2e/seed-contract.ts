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
export const SEED_REVIEWED_AT_CONTRACT = 118

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
