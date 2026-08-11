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

### Class 2 — ~~a nullable column read as non-null~~ — **wrong, corrected 10 August 2026 (AUD-10-b-ii)**

> **This class does not exist.** It was described as `cup.ts:32`,
> `knockoutPredictions.ts:39–40, 58`, `lms.ts:26`, `predictions.ts:192` and
> `seasonMatchPredictor.ts:195–197` assigning a `T | null` **from** the schema
> **into** a `T`. Every one of those sites is an **RPC argument object going the
> other way** — a value the code sends *to* the database, not a column it reads
> *from* one. There is no read-side error in the 19, and there never was.
>
> This is the **second** time this document has had the direction of an error
> backwards; class 3 below records the first. The lesson is the same both times
> and is worth stating plainly: `Type 'number | null' is not assignable to type
> 'number'` does not say which way the value is travelling, and the fix for a
> misread argument is the opposite of the fix for a misread column. **Read the
> call site, not the error message.**
>
> The original wording is preserved above the correction rather than swapped,
> because it is what the AUD-10-b split was reasoned about. What it got right
> stands: a genuine nullable read would be either a latent defect or an
> unexpressed invariant, and the fix would be an explicit narrowing with a
> stated reason and **never** a cast.

**What the 19 actually were**, measured at HEAD on 10 August 2026 by typing the
client and de-duplicating across TypeScript projects:

| Count | Shape | Resolution |
| ---: | --- | --- |
| 8 | RPC argument the function branches on as NULL | `rpcArgs`, one named parameter at a time |
| 5 | RPC argument whose SQL default is `null` | omitted rather than sent |
| 3 | insert whose scope column a trigger fills | `preparedInsert` |
| 2 | RPC argument dropped by JSON when `undefined` | **a real defect** — see below |
| 1 | RPC argument sent as `null` where the comment claimed omission | comment and code reconciled |

### The defect this actually found

`seasonAdmin.ts` sent `p_home: input.home` where `home` is `number | undefined`.
`SeasonAdminPage` passes an absent score deliberately, under a comment saying
*"the server refuses a result with a missing score and says so; refusing here
first would be this page holding an opinion about the rule."*

That refusal is real — the shared writer raises `A season result needs both
scores` with errcode `22023` — and **it was never reached**. `undefined` is
dropped by JSON serialisation, and neither `admin_confirm_season_fixture_result`
nor `admin_correct_season_fixture_result` declares a default for `p_home` or
`p_away`, so the call resolved to *no function at all* and PostgREST answered
with a schema-cache error. The administrator saw a shape complaint instead of
the domain refusal the page had promised to show them. Sending `null` keeps the
function resolvable and lets its own guard speak.

**This is the payoff.** One real defect, invisible to every test because every
test mocked the client, surfaced by making the compiler read the schema.

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
| `AUD-10-b-ii` | The remaining 19 errors, and the deletion of the seam | **Done** |
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

**Superseded 10 August 2026: none do.** All thirty-nine moved in AUD-10-b-ii,
the `supabase` export was deleted from `client.ts`, and
`databaseTypeMigration.test.ts` was deleted with it — both exactly as the
paragraph above and the module's own comment said they should be once the count
reached zero. `tests/services/typedDatabaseClient.test.ts` replaces it, and
guards a different property: not *how much is left*, but *that there is no way
back*.

## What this does not close

> **Superseded 10 August 2026.** The paragraph below was written when
> thirty-nine modules were still untyped. `TYPE-001` is now **closed**: all
> forty-six service modules are on the typed client, the untyped export is
> deleted, and no service module can reach the database without the generated
> types. `AUD-10-c` — regenerate-and-diff against a local database — remains
> open, but it guards the *freshness* of the artifact rather than its
> application, and `databaseTypes.test.ts` already fails the moment a migration
> lands without a regeneration.
>
> **Two documented exceptions survive**, each spanning a fact SQL knows and
> TypeScript cannot express, each holding exactly one assertion, each citing the
> migration that establishes it, and each bound to a single named table or
> function so it cannot be pointed anywhere else:
> [`preparedInsert.ts`](../../src/services/supabase/preparedInsert.ts) for the
> three scope columns a `before insert` trigger fills, and
> [`rpcArguments.ts`](../../src/services/supabase/rpcArguments.ts) for the
> arguments a function's own body branches on as NULL. A PostgreSQL signature
> carries no nullability at all, so the generator can never write `| null` on an
> argument — that is not the generator guessing wrong, it is a fact the
> generated file has no room to record.

`TYPE-001` stays **open**. It is reduced, not resolved: seven modules are typed
and their eight argument defects fixed, and thirty-nine modules are not. The
finding is that hand-written types and casts can hide schema drift, and they
still can everywhere the untyped export is used. Closure is the remaining
groups, ending with the deletion of the `supabase` export.
