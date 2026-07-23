# Database parity — foundation and completion record — 23 July 2026

This note began as the foundation record for the first local database-parity slice after TypeScript group-order Batches 1–3. PR #7 subsequently completed the planned private PostgreSQL resolver, pgTAP coverage and TypeScript/PostgreSQL differential verification on the same branch.

## Authoritative status

| Stage | Status | Evidence |
| --- | --- | --- |
| Local disposable Supabase foundation | Complete | PR #7; merge commit `a188ecfb048608813e887b7b02b97c67d6555b97` |
| Private pure PostgreSQL resolver | Complete | PR #7 |
| Automatic head-to-head and recursive-subset parity | Complete | PR #7 |
| Manual hostile/stale resolution parity | Complete | PR #7 |
| Fixture-driven TypeScript/PostgreSQL differential runner | Complete | PR #7 |
| pgTAP behaviour and permission tests | Complete | PR #7 |
| Hosted production integration or public RPC | Not included | Deliberate boundary |

## Foundation included

- committed `supabase/config.toml` for a local project;
- a dedicated private `predictor_internal` schema;
- explicit revocation of schema access from `PUBLIC`, `anon` and `authenticated`;
- pgTAP checks proving the private schema boundary;
- a separate GitHub Actions workflow that starts disposable local Supabase, reapplies all committed migrations, lints the local database, runs pgTAP and deletes the local data volume afterwards.

## Completed resolver contract

The private PostgreSQL implementation accepts pure JSONB inputs and remains independent of entries, profiles, hosted RLS and live tournament data. It implements the same ordering contract as production TypeScript:

1. overall points;
2. head-to-head points;
3. head-to-head goal difference;
4. head-to-head goals scored;
5. recursive reapplication to smaller tied subsets;
6. overall goal difference;
7. overall goals scored;
8. unresolved output when score-derived criteria cannot separate the teams;
9. an explicit exact-set manual order when supplied.

It also safely ignores duplicate, missing, extra, foreign, malformed and stale manual-resolution rows.

## Differential proof

The database workflow runs the committed canonical fixture corpus through both:

- production TypeScript `resolveGroupTies()`;
- private PostgreSQL `predictor_internal.resolve_predicted_group_order()`.

The normalized standings must match team by team, including:

- played, won, drawn and lost;
- goals for and against;
- goal difference and points;
- final order and rank;
- `tiedUnresolved` flags;
- unresolved team sets.

Additional cases cover explicit keep-order, rearranged order, a hostile malformed row before a later valid row, stale saved decisions and partial groups.

## Permission proof

The local pgTAP suite proves:

- the private schema exists;
- `anon` and `authenticated` cannot use the schema;
- public/client roles cannot execute the resolver;
- the intended internal database owner can execute it;
- no public client-callable wrapper has been added.

## Safety boundary

The workflow uses only local Docker containers. It does not run `supabase link`, `db pull`, `db push`, `db dump --linked`, `test db --linked` or any command requiring a hosted project reference, access token or database password.

No development or production Supabase project was accessed during this work.

## Remaining non-goals and open work

The completion of local group-order parity does not establish:

- live production schema or migration-history parity;
- entry ownership and same-tournament validation;
- submission-state and locking correctness;
- `predicted_group_positions` persistence/locking;
- multi-user or multi-tournament RLS/RPC behaviour;
- browser-level end-to-end correctness;
- a decision that the private resolver should be wired into entry-table workflows.

Those remain separate workstreams. The next implementation batch is `DB-INTEGRITY-ENTRY-BOUNDARY-1`; it must use the local disposable database harness and must not be combined with UI redesign or hosted production changes.