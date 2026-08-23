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

## Hostile scenarios

`docs/design-system.md` binds every page to be reviewed against worst-case data
and names the cases. Three of them the ordinary seed cannot produce: a **tied
top**, a **non-submitter**, and a **pool too small for a leaderboard to mean
anything**. `--scenario=` seeds them on demand, and guarantees them rather than
leaving them to luck — a seed that ties by chance is no use for reviewing a
tie-break, because the next run may not tie.

| Scenario | Guarantees |
| --- | --- |
| `standard` (default) | Today's populated mid-tournament. Byte-identical to omitting the flag. |
| `contested` | Two players level on the top total, so a tie-break has something to resolve. |
| `sparse` | Entries that were never submitted, plus a one-member and a two-member pool. |

```sh
npx tsx scripts/seed-dev/index.ts --scenario=contested          # dry run
SEED_DEV=i-understand … --commit --scenario=sparse              # write it
```

An unrecognised name **refuses** rather than falling back to `standard`: a typo
that silently seeded the ordinary world would be found only by a reviewer
wondering why the state they asked for is not on the page.

The tie is created by construction — the best entry's predictions are copied
onto the worst, which must then score identically — so nothing here re-implements
or second-guesses scoring. `scripts/seed-dev/scenarios.ts` holds them, and
`tests/scripts/seedScenarios.test.ts` proves each guarantee actually bites.

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

## Exercising Home's "Today" card during dev

The seeded fixtures are dated to the real tournament window (June 2028), so on any
ordinary dev day Home's Today card shows the **next matchday**, not today. To see
the today/live rows, point one fixture's date at today in the SQL editor:

```sql
-- Make a group match "today" (kickoff in a couple of hours):
update matches
set match_date = current_date, kickoff_at = now() + interval '2 hours'
where match_ref = 'GA-1'
  and tournament_id = (select id from tournaments order by year limit 1);
```

(There's no live-score source yet, so a "today" row reads as upcoming, or
full-time if that match already has a result. Live rows are wired through Home
but unfed until Phase 3.)

## Files

| file | purpose |
| --- | --- |
| `seedPolicy.ts` | pure fail-closed guard (unit-tested) |
| `fixture.ts` | self-contained six-group / 36-match model, keyed by stable refs |
| `generate.ts` | deterministic users + predictions + jokers + results |
| `scoreEntries.ts` | runs the real `calculateScore` pipeline → ranked leaderboard |
| `index.ts` | CLI: dry-run print, or committing DB writes |
