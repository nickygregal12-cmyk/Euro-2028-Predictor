# Generated database types — baseline and classified disagreement report

**Generated:** 10 August 2026, `npm run generate:types` against hosted Development (`iouzoutneyjpugbbtdem`) at contract **151**.
**Artifact:** [`src/services/supabase/database.types.ts`](../../src/services/supabase/database.types.ts) — 3,727 lines, 53 tables.
**Provenance:** `src/services/supabase/database.types.meta.json`, guarded by `tests/services/databaseTypes.test.ts`.
**Closes, in part:** `TYPE-001`.
**Authority for what happens next:** the remediation ledger's `AUD-10-b` and `AUD-10-c`.

This is the baseline the `TYPE-001` work needs **before** the client is typed, in
the same shape as [`knip-baseline.md`](knip-baseline.md) and
[`lighthouse-baseline.md`](lighthouse-baseline.md). It changes no behaviour and
types no call site. Its job is to say what typing the client would actually
cost, and — more importantly — **which of the resulting errors are defects and
which are the generator being unable to see the database it is describing.**

## Why the types were generated from Development and not from the migrations

`supabase gen types --local` reads the committed migrations, needs no
credentials and cannot disagree with the repository. It also needs Docker, which
the authoring environment did not have. Hosted Development was the only
available source.

The tradeoff is real and is why the meta file exists: **the committed types are
true of Development at the instant they were generated**, which is only the same
thing as the repository when the two are level. They were level — repository 151,
Development 151, verified by fast-lane run `31417611501` — so this generation is
sound. `databaseTypes.test.ts` fails the moment a later migration lands, because
that is exactly when the file stops describing anything.

## The measurement: what typing the client costs

Typing the client as `createClient<Database>` was done, measured, and reverted.

> **Correction, 10 August 2026.** The first version of this document reported
> **81 errors**. That figure was wrong: `tsc -b` builds several TypeScript
> projects over the same sources (app, tests, gates), so each error was counted
> once per project it appeared in. De-duplicated, it is **27 unique errors
> across 17 modules**. The 81 is left recorded here rather than quietly swapped,
> because it was the number the AUD-10 split decision was taken on, and the
> split was still right — 27 across 17 modules needing per-site SQL verification
> is not one reviewable change either.

**27 unique errors across 17 service modules**, by shape:

| Count | Error | Class |
| ---: | --- | --- |
| 8 | `string \| null` not assignable to `string \| undefined` | RPC argument (below) |
| 8 | `number \| null` not assignable to `number` | nullable read as non-null |
| 3 | insert shape rejected (`RejectExcessProperties`) | trigger-filled column |
| 3 | `string \| null` not assignable to `string` | nullable read as non-null |
| 2 | RPC argument object not assignable | nullable RPC argument |
| 2 | `number \| undefined` not assignable to `number` | optional read as required |
| 1 | `number \| null` not assignable to `number \| undefined` | nullable read |

## Read this before fixing any of them

**An error here does not mean the code is wrong.** Three distinct causes are
mixed together in that 81, and they want opposite fixes. Fixing them as one
mechanical pass would break working code, which is the same trap
[`knip-baseline.md`](knip-baseline.md) records for unused exports.

### Class 1 — the generator cannot see triggers or defaults

The clearest case, and the reason this document exists.

`predictions.ts:159` upserts into `match_predictions` without `tournament_id`,
and the generated type demands it because
`20260730235602_stage_c1_competition_season_foundation.sql:1844` sets that column
`not null`. **The code is correct.** The same migration says, at line 1169,
*"Old RPC/insert shapes remain valid through the preparation trigger"* — a
trigger fills `tournament_id` on insert. The generated `Insert` type is derived
from column nullability alone and has no way to know a trigger exists.

`bonus.ts:70` is the same shape on `bonus_predictions`.

**Fixing these by adding `tournament_id` to the insert would be wrong twice
over**: it would duplicate a value the database owns, and it would hand a
browser caller a competition-scope field that the Stage C1 design deliberately
keeps server-owned.

### Class 2 — a nullable column read as non-null

`cup.ts:32`, `knockoutPredictions.ts:39–40, 58`, `lms.ts:26`,
`predictions.ts:192`, `seasonMatchPredictor.ts:195–197` and others assign a
`T | null` from the schema into a `T`.

**These are the ones worth looking at properly.** Each is either a real latent
defect — a null that reaches the UI and renders as `null` or crashes an
arithmetic — or a genuine invariant the schema does not express, in which case
the fix is an explicit narrowing at the boundary with a comment saying why the
null cannot occur. **Not a cast.** A cast here would restore exactly the
situation `TYPE-001` describes, with the added insult of looking deliberate.

### Class 3 — RPC arguments, and the correction this class needed

**The first version of this document classified these as response mapping** —
"the schema says `string | null` and the hand-written model says `string |
undefined`". That was wrong, and the direction matters.

They are **RPC arguments**, and the mismatch runs the other way: the code passes
an explicit `null`, and the *generated* type declares the parameter optional
(`p_after?: string`) because Supabase's generator renders a SQL argument with a
default as an optional property and does not add `| null` to it.

**The fix is to omit the argument rather than pass `null` — and it is only safe
where the SQL default is `null`.** That is a per-parameter fact that has to be
read from the migration, not assumed:

| Function | Parameter | SQL default | Safe to omit |
| --- | --- | --- | :---: |
| `get_leaderboard` | `p_after text` | `null` | yes |
| `get_ko_predictor_standings` | `p_after text` | `null` | yes |
| `get_league_members` | `p_after text` | `null` | yes |
| `get_season_leaderboard` | `p_after text` | `null` | yes |
| `get_season_league_standings` | `p_after text` | `null` | yes |
| `acknowledge_provider_review_items` | `p_note text` | `null` | yes |
| `get_season_fixtures` | `p_from`, `p_to timestamptz` | `null` | yes |
| *(counter-example)* `get_leaderboard` | `p_limit integer` | **`50`** | **no** |

The counter-example is the reason this cannot be a find-and-replace. `p_limit`
sits on the line above `p_after` in four of these calls; omitting it would send
50 where the code meant to send a value, or — if a caller ever passed `null` for
it — send NULL where the function expects an integer. Every one of the eight was
checked individually and every one was `default null`, so the conversion is
behaviour-identical. **Closed by AUD-10-b-i.**

## What was deliberately not done

- **The client is not typed.** `client.ts` still calls `createClient(...)`
  untyped, and `databaseTypes.test.ts` asserts that, so the day somebody types it
  the assertion fails and sends them here rather than leaving a stale note.
- **No error was suppressed.** No `@ts-expect-error`, no `as unknown as`, no
  widening of a model to make a number go down. The 81 are recorded, not hidden.
- **No regenerate-and-diff CI gate.** See below.

## The staleness gate, and the half that is missing

What exists: `databaseTypes.test.ts` compares the contract the file was generated
at against the repository's migration count, and fails when a migration lands
without a regeneration. No Docker, no credentials, no hosted call. It catches the
trigger for the rot.

What does not exist is the audit's stronger ask — regenerate in CI and diff.
Two reasons, both worth stating:

1. **Against hosted Development it would be wrong**, not merely expensive. ADR
   0024 treats Development trailing the repository as the normal working state,
   so a diff gate would fail legitimately on every schema-advancing pull request
   — the same circular gate ADR 0024 removed for deploy previews.
2. **Against a local database it is right, and unmeasured.** It needs Docker on
   the runner, and the local and hosted generators can differ cosmetically —
   `__InternalSupabase.PostgrestVersion` reads `"14.5"` from hosted PostgREST and
   would read whatever the local image ships. A gate that fails on that is a gate
   people switch off. Measure the difference first.

That work is `AUD-10-c` and belongs beside `database-parity.yml`, which already
builds a local Supabase from every committed migration.

## Progress

| Group | Scope | Status |
| --- | --- | --- |
| `AUD-10-a` | Generate the artifact, provenance, staleness guard | **Done** |
| `AUD-10-b-i` | The typed/untyped seam, and the 8-site RPC-argument cluster | **Done** |
| `AUD-10-b-ii…` | The remaining 19 errors — nullable reads, trigger-filled inserts, optional reads | Open |
| `AUD-10-c` | Regenerate-and-diff gate against a local database | Open |

**How the staging works.** `client.ts` exports one client twice: `db` with the
generated types applied, `supabase` with them erased. Modules move from the
second to the first in groups. It is not a cast — `SupabaseClient<Database>` is
assignable to `SupabaseClient`, so the widening is compiler-checked — and there
is one client instance, so auth, realtime and storage cannot diverge between the
halves. `tests/services/databaseTypeMigration.test.ts` names the migrated
modules, refuses to let one move back, and asserts how many remain, so the seam
cannot go quiet. When that count reaches zero the `supabase` export and that
test are both deleted.

**39 service modules still import the untyped export.** That is larger than the
17 with errors, because most modules compile identically either way — they get
their types the moment they move, without needing a fix first.

## What this does not close

`TYPE-001` stays **open**. It is reduced, not resolved: seven modules are typed
and their eight argument defects fixed, and thirty-nine modules are not. The
finding is that hand-written types and casts can hide schema drift, and they
still can everywhere the untyped export is used. Closure is the remaining
groups, ending with the deletion of the `supabase` export.
