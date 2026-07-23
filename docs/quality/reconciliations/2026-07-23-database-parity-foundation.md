# Database-parity foundation — 23 July 2026

This is the first database-parity slice after TypeScript group-order Batches 1–3.
It establishes a disposable local Supabase test boundary. It does **not** claim
that a SQL resolver exists or that TypeScript/PostgreSQL parity has been achieved.

## Included in this slice

- committed `supabase/config.toml` for a local project;
- a dedicated `predictor_internal` schema for future server-side resolver helpers;
- explicit revocation of schema access from `PUBLIC`, `anon` and `authenticated`;
- pgTAP checks proving the private schema boundary;
- a separate GitHub Actions workflow that starts disposable local Supabase,
  reapplies all committed migrations, lints the local database, runs pgTAP and
  deletes the local data volume afterwards.

## Safety boundary

The workflow uses only local Docker containers. It does not run `supabase link`,
`db pull`, `db push`, `db dump --linked`, `test db --linked` or any command that
requires a hosted project reference, access token or database password.

No development or production Supabase project is accessed by this slice.

## Next slices

1. Define the SQL resolver's pure JSON/text contract from the merged TypeScript
   fixtures, without coupling it to entry tables.
2. Implement automatic criteria and recursive tied-subset handling in the private
   schema.
3. Add exact manual-resolution validation and hostile/stale-input handling.
4. Build a differential runner that sends every canonical fixture to TypeScript
   and local PostgreSQL and compares order, ranks, unresolved blocks and flags.
5. Add meaningful pgTAP behaviour tests plus function-permission tests.
6. Only after parity is proven, decide whether and how a private database resolver
   should be integrated with application entry tables.

## Non-goals

- no hosted database changes;
- no production resolver integration;
- no client-callable RPC;
- no grants to anonymous or authenticated users;
- no scoring, route, UI or entry-boundary changes;
- no reuse of the superseded PR #2 SQL implementation.
