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

**81 errors across 17 service modules.**

| Module | Errors | | Module | Errors |
| --- | ---: | --- | --- | ---: |
| `seasonAdmin.ts` | 12 | | `lms.ts` | 3 |
| `seasonMatchPredictor.ts` | 9 | | `leagues.ts` | 3 |
| `knockoutPredictions.ts` | 9 | | `leaderboard.ts` | 3 |
| `seasonFixtureList.ts` | 6 | | `koPredictorStandings.ts` | 3 |
| `predictions.ts` | 6 | | `cup.ts` | 3 |
| `adminResults.ts` | 6 | | `bonus.ts` | 3 |
| `tieResolutions.ts` | 3 | | `seasonClubForm.ts` | 3 |
| `seasonLeagueStandings.ts` | 3 | | `providerReviewQueues.ts` | 3 |
| `seasonLeaderboard.ts` | 3 | | | |

By error code: **66 × TS2322** (assignment) and **15 × TS2345** (argument).

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

### Class 3 — `null` versus `undefined`

The largest group by count and the least interesting: roughly 20 sites where the
schema says `string | null` and the hand-written model says `string | undefined`.
PostgREST returns `null`; the models chose `undefined`. Neither is wrong, and the
repository has no stated convention.

**This wants a decision, not 20 fixes.** Adopting `null` at the service boundary
and converting once, or keeping `undefined` and converting in one shared mapper,
are both defensible; doing it ad hoc per call site is not.

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

## What this does not close

`TYPE-001` stays **open**. The finding is that hand-written types and casts can
hide schema drift; a generated file that nothing imports hides nothing and
prevents nothing. It is closed when the client is typed and the call sites
consume it — `AUD-10-b` — and the 81 disagreements above are the work that
closure consists of.
