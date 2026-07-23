# Function privilege and search-path hardening

**Workstream:** `SECURITY-003`  
**Date:** 24 July 2026  
**Repository migration:** `20260724001500_harden_function_privileges.sql`  
**Development project:** `iouzoutneyjpugbbtdem`  
**Production project:** `vkfnsqdyhvtwyqkisxhk`

## Verdict

| Area | Result |
| --- | --- |
| Repository migration | **Implemented.** Additive migration 34 closes public function execution by default and applies explicit allowlists. |
| Disposable database assurance | **Covered by `supabase/tests/080_function_privileges.sql`; final result depends on database-parity CI.** |
| Hosted development | **Applied and verified.** Exact privilege matrix, default ACL, search paths, signup trigger and authenticated RPC smoke tests passed. |
| Security advisors | **Material drift removed in development.** Anonymous security-definer and mutable-search-path warnings are gone. |
| Production | **Unchanged.** Old broad function grants remain until the separately approved migrations 21–34 rollout. |

`SECURITY-003` is implemented and verified in repository/development but remains open for production.

## Root cause

PostgreSQL functions receive `EXECUTE` for `PUBLIC` by default unless default privileges are changed. Supabase API roles may also hold direct execution grants.

Earlier migrations often used statements such as:

```sql
revoke all on function public.some_function(...) from public;
```

That removed inherited `PUBLIC` access in a clean local rebuild, but the hosted projects also contained direct grants to `anon`, `authenticated` and `service_role`. As a result, many internal, trigger and maintenance functions remained callable through the Data API despite the migration intent.

Three non-definer helpers also inherited the caller's mutable search path:

- `gen_invite_code()`;
- `_stage_ord(text)`;
- `enforce_write_version()`.

## Migration design

Migration 34 is fail-closed:

1. change future `postgres` default privileges in `public` so new functions are owner-only;
2. revoke execution on every current public function from `PUBLIC`, `anon`, `authenticated` and `service_role`;
3. regrant only the explicit authenticated application RPC allowlist;
4. regrant the same application RPCs plus result/scoring operations to `service_role`;
5. leave trigger, signup and internal helper functions without direct API execution;
6. set empty search paths on the three mutable pure/trigger helpers.

No function body, table, RLS policy, score value or user data is changed.

## Authenticated application RPC allowlist

The following remain executable by `authenticated` and `service_role`:

- `submit_entry(uuid)`;
- `replace_predicted_progression(uuid,jsonb,jsonb)`;
- `get_leaderboard(uuid)`;
- `create_league(uuid,text)`;
- `get_league_preview(text)`;
- `join_league(text)`;
- `get_my_leagues(uuid)`;
- `get_league(uuid)`;
- `get_league_members(uuid)`;
- `leave_league(uuid)`;
- `transfer_ownership(uuid,uuid)`;
- `delete_league(uuid)`;
- `get_rival_entry(uuid,uuid)`;
- `get_league_match_picks(uuid,uuid)`;
- `get_match_prediction_distribution(uuid)`.

These functions remain `SECURITY DEFINER` where cross-user or protected-table reads/writes are required. Their authentication, ownership, league co-membership, tournament scope and lock checks remain inside the function bodies.

## Service-only operations

The following are callable by `service_role` but not browser roles:

- `recompute_tournament_scores(uuid)`;
- `recompute_all_scores()`;
- `capture_rank_history(uuid)`;
- `confirm_match_result(...)`;
- `correct_match_result(...)`;
- `clear_match_result(uuid,text)`.

The result-revision table still denies direct select/insert/update/delete to browser and service roles; result functions write it through their owner context.

## Internal functions

No direct browser or service-role execution is retained for:

- actual/predicted group-order helpers;
- trigger functions;
- signup profile creation;
- display-name enforcement;
- rate-limit enforcement internals;
- invite-code and stage-order helpers;
- write-version enforcement;
- bracket validation helpers in the private schema.

Trigger execution does not require callers to hold direct `EXECUTE` on the trigger function. This was verified by creating and deleting a temporary Auth user after hardening; the `auth.users` trigger still created the expected profile.

## Hosted development verification

The exact privilege query returned:

- zero anonymous executable public functions;
- zero missing authenticated allowlist functions;
- zero unexpected authenticated functions;
- zero missing service-role allowlist functions;
- zero unexpected service-role functions;
- owner-only future public-function default ACL;
- empty search paths for all three targeted helpers.

Authenticated smoke tests ran under the cloned production user's JWT context and successfully exercised:

- overall leaderboard;
- match prediction distribution;
- idempotent `submit_entry()`.

The original submission timestamp remained:

```text
2026-07-21 21:51:49.639442+00
```

The complete migrations 21–34 post-rollout verifier then returned:

```text
overall_pass = true
```

All source fingerprints, 24 derived positions, eight progression rows, R16 resolution and bracket validation remained unchanged.

## Advisor result

After migration 34, hosted development no longer reports:

- anonymous security-definer functions executable through the Data API;
- mutable function search paths.

Expected remaining notices:

- signed-in security-definer warnings for the intentional authenticated application RPC allowlist;
- leaked-password protection disabled, which is an Auth setting rather than a database migration;
- informational no-policy notices for deny-all internal tables such as `rate_limit_events` and `match_result_revisions`.

The remaining signed-in warnings must not be “fixed” by revoking the application RPCs without replacing their product functionality and authorization boundary.

## Executable coverage

`supabase/tests/080_function_privileges.sql` adds 18 assertions covering:

- no anonymous public-function execution;
- exact authenticated allowlist;
- exact service-role allowlist;
- owner-only future default ACL;
- all three immutable search paths;
- critical authenticated/service grants;
- denial of direct signup-trigger execution;
- continued signup-trigger behaviour.

The hosted development database does not expose pgTAP, so the suite could not be invoked there. Equivalent live SQL assertions and the behavioural trigger test passed. The committed suite is intended for the disposable database-parity workflow.

## Production boundary

Production was not changed.

Migration 34 is now the fourteenth pending production migration after the independently proven 1–20 baseline. The approved rollout must apply migrations 21–34 in strict timestamp order and run the updated `scripts/database-rollout/post-rollout-verification.sql`.

Production closure requires:

1. verified backup/recovery evidence;
2. final baseline and source-data preflights;
3. migration-history repair for proven migrations 1–20 only;
4. dry run showing migrations 21–34 only;
5. strict ordered push;
6. post-rollout exact function matrix passing;
7. advisor output showing no anonymous/internal exposure or mutable path;
8. authenticated browser smoke tests for bracket, leaderboard, Match Centre and leagues.

## Separate remaining work

Not included in this migration:

- leaked-password protection setting;
- Netlify preview/environment isolation (`OPS-007`);
- pending-write submission flush (`REL-003`);
- admin authorization/UI;
- automatic real R16 population;
- performance-advisor index review.