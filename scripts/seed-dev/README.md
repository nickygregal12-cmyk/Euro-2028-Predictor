# Dev seed — fake mid-tournament

A **dev-only** script that fills the database with a realistic populated state so
every page from Phase 2 on is built and reviewed against real-shaped data, never
an empty screen (the hostile-data rule, `docs/design-system.md` §6).

It creates:

- **~20 test users** with hostile-variety display names (very short, single
  word, hyphenated, accented/unicode, emoji, ALL CAPS, punctuation, and the
  longest plausible name at the 40-char DB limit).
- a **complete submitted entry** each — all 36 group scores, a predicted order
  per group, a full knockout progression, up to five jokers, a total-goals guess.
- **~12 entered group results**, so the state reads as a group stage in progress.

The scores you see on pages are computed live from these predictions + results by
the real domain pipeline (`calculateScore`). The dry run also runs that pipeline
(`scoreEntries.ts`) to print the resulting leaderboard, so the seed is proven
internally consistent before anything is written.

## Run it

**Dry run (default — writes nothing):**

```sh
npx tsx scripts/seed-dev/index.ts
```

Prints the generated leaderboard and one sample points breakdown. Safe to run
anywhere; touches no database and needs no credentials.

**Commit to the dev database:**

```sh
SEED_DEV=i-understand \
SUPABASE_URL="https://<your-dev-project>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<dev service-role key>" \
npx tsx scripts/seed-dev/index.ts --commit
```

- **Idempotent** — it first deletes any prior seed users (identified by their
  `@seed.euro28.test` email domain, cascading to their entries/predictions), then
  recreates everything from the same deterministic seed. Re-run it freely.
- Requires the fixture to be seeded already (`supabase/seed.sql`). It maps onto
  the existing tournament/teams/matches by stable references (group letter +
  slot, `GA-1..GF-6` match refs), so placeholder team names are fine.

## Fail-closed (never production)

Committing goes through `evaluateSeedPolicy` (`seedPolicy.ts`, unit-tested),
which mirrors the auto-login shim's guard and **refuses** unless:

- `SEED_DEV=i-understand` is set (explicit acknowledgement this is a dev DB), and
- `NODE_ENV` is not `production`, and
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are present, and
- `SUPABASE_URL` does **not** equal `SUPABASE_PROD_URL` (set that once a prod
  project exists for belt-and-braces protection).

The service-role key bypasses RLS, which is why the guard is strict. It only
writes freely because the tournament is in the future (nothing is locked yet);
the mid-tournament is simulated purely by entering results.

## Files

| file | purpose |
| --- | --- |
| `seedPolicy.ts` | pure fail-closed guard (unit-tested) |
| `fixture.ts` | self-contained six-group / 36-match model, keyed by stable refs |
| `generate.ts` | deterministic users + predictions + jokers + results |
| `scoreEntries.ts` | runs the real `calculateScore` pipeline → ranked leaderboard |
| `index.ts` | CLI: dry-run print, or committing DB writes |
