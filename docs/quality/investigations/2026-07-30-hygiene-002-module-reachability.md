# HYGIENE-002 — module reachability inventory

**Date:** 30 July 2026
**Register item:** `HYGIENE-002` — "Some pure modules may be test/reference-only" (Low, **Open; verify before deletion**)
**Scope:** report only. No module is deleted, moved, renamed or edited by this investigation.
**Baseline:** `origin/main` at `a83121dc2e73690b3880e7d6d13b8f06f985fecd`

## Purpose

`HYGIENE-002` is held open with the condition *verify before deletion*. This document performs that verification: it establishes which `src/` modules the production application actually reaches, classifies everything it does not, and states for each candidate whether deletion is safe, blocked, or wrong.

The headline correction is that the register wording invites a deletion sweep, and **most of what an orphan scan surfaces here is not deletable**. Only two files are unreferenced by both the application and its tests.

## Method

Reachability was computed from the production entry point `src/main.tsx` (the only script `index.html` loads) by resolving relative import specifiers across `src/**/*.{ts,tsx}`:

- `import`/`export … from '…'`, distinguishing `import type` from value imports;
- side-effect `import '…'`;
- dynamic `import('…')`, which is how every route is loaded (`lazy(() => import(…))`).

Resolution tried `<spec>`, `<spec>.ts`, `<spec>.tsx`, `<spec>/index.ts`, `<spec>/index.tsx`. Bare specifiers are external packages and were not followed. Importers from `tests/`, `e2e/`, `production-smoke/`, `scripts/` and `fixtures/` were collected separately, so a module can be shown as test-only rather than merely unreached.

Counts reconcile: **258** modules under `src/` (excluding `.d.ts`), **252** reached, **6** unreached.

### Method defect found and corrected

The first run reported `src/instrument.ts` and `src/services/observability/sentryReporter.ts` as unreachable, which would have described the entire Sentry pipeline as dead code. That was wrong.

A single combined import pattern allowed `[\s\S]*?` to run past a side-effect import and bind to a later `from` clause, so every `import './x'` edge was invisible. `src/main.tsx` opens with `import './instrument'` and imports four stylesheets the same way. Splitting the three import forms into separate patterns fixed it and moved five edges back into the graph.

Anyone repeating this analysis should verify the parser against `src/main.tsx` first: if `./instrument` is not among its resolved edges, the results are wrong.

## Summary

| Classification | Count | Deletable? |
| --- | --- | --- |
| Runtime-reachable from `src/main.tsx` | 249 | No — live |
| Type-only reachable (never value-imported) | 3 | No — supply types |
| Reachable only through the DEV-gated previews | 5 | No — see below |
| Live tests located under `src/` | 3 | No — they run |
| Test-only pure modules | 2 | Not without authority |
| Unreferenced anywhere in the repository | 2 | Yes, with the notes below |

## A. Live tests in an unconventional location — not dead code

| File | Evidence |
| --- | --- |
| `src/domain/tournament/matchNavigation.test.ts` | collected by Vitest |
| `src/features/matches/MatchCentreScreen.test.tsx` | collected by Vitest |
| `src/services/supabase/adminAccess.test.ts` | collected by Vitest |

`npx vitest list --filesOnly` collects exactly these three from `src/`. They appear in an orphan scan only because nothing *imports* a test file — Vitest is their entry point. They are executing coverage and must not be removed.

The real observation is a consistency one: every other test in the repository lives under `tests/`, and Vitest's `include` glob picks these up from `src/` by default. Relocating them to `tests/` would make the layout uniform and keep `src/` free of test files. That is a deliberate move with import-path updates, not cleanup, and it collides with in-flight work (see §F).

## B. Unreferenced anywhere — safe to retire

### `src/domain/tournament/seedData.ts` (31 lines)

Zero references in the entire repository — no application module, no test, no script, no fixture. Its own header calls it *"Placeholder seed data for building and testing domain logic in isolation … Team names are placeholders."* Its exported `teams` are `Team A1`, `Team A2`, …

It has been superseded by `scripts/seed-dev/fixture.ts`, which builds the six-group, 36-match fixture from real qualified teams (`England`, `Scotland`, `Turkey`, `Serbia`, `Spain`, `Italy`, …) and is exercised by `tests/scripts/seedData.test.ts`. Note that test's name refers to the **seed-dev** generator, not to this module; the similarity is a trap worth stating.

**Assessment:** genuinely orphaned. Deleting it removes a placeholder that contradicts the real fixture. It also exports its own `Team`/`Group` types, so confirm nothing starts importing those instead of the repository shapes in `src/services/supabase/tournamentData.ts`.

### `src/App.css` (1 line)

Entire content: `/* Design system styles will replace this file */`. Zero references — `src/main.tsx` imports `./styles/fonts.css`, `./styles/flags.css`, `./styles/tokens.css` and `./index.css`, and there is no `@import` anywhere in the CSS. Scaffolding residue whose stated replacement has happened.

**Assessment:** genuinely orphaned. It is the only unreferenced stylesheet of the 67 under `src/`.

## C. Test-only pure modules — do not delete as cleanup

### `src/domain/rateLimit.ts` — keep, and close the parity gap

Imported only by `tests/domain/rateLimit.test.ts`. The application never calls it, and correctly so: its header states it is *"MIRRORED by the SQL enforce_rate_limit (20260720210000_rate_limits.sql), which is the real server-side gate."* That function exists at `supabase/migrations/20260720210000_rate_limits.sql:34`, with browser execution revoked.

So this module is reference-only **by design** — it documents and unit-tests the rule the database enforces. But its stated purpose is parity, and nothing verifies the mirror: `tests/database-parity/` contains a single file, `predictedGroupOrderParity.test.ts`. The window (`RATE_LIMIT_WINDOW_MS`) and ceilings (`prediction_save: 60`, `league_membership: 5`) could drift from the SQL with no test failing.

**Assessment:** deleting it would discard the documented rule. The useful action is the opposite — add a Database parity case comparing these constants to `enforce_rate_limit`, or demote the file to a comment on the migration. This is worth carrying into `DATA-007`, which is separately open on rate limiting being count-then-insert.

This also qualifies the "Make Database parity apply to all `src/domain/**`" line in `CLAUDE.md` and the `CI-001` fix: the *path filter* now covers all of `src/domain/**`, but the *suite* covers one subject. Broad triggering is not broad coverage.

### `src/domain/tournament/calculateLeagueRank.ts` (96 lines) — needs authority, not cleanup

Imported only by `tests/domain/calculateLeagueRank.test.ts`. It implements the section-5 tie-break order from `docs/scoring-rules.md` — exact scores, correct outcomes, correct knockout teams, correct champion, closest total goals — as a pure client-side ranking.

It is unreached while `src/domain/tournament/finalStandings.ts` *is* reachable and used by `src/features/league/OverallStandingsPage.tsx` and `src/features/league/FinalStandingsNote.tsx`. `LEAGUE-001` records the documented tie-break order as **resolved and production-hosted at contract 62**, i.e. the authoritative ordering now runs in the database, consistent with ADR 0004 and the bounded-read model.

**Assessment:** most likely a superseded client implementation of a rule that moved server-side — but it encodes a documented scoring rule, and `CLAUDE.md` states *no scoring or rule change without authority and test updates*. Retiring it is a scoring-authority decision with an explicit statement that contract 62 owns the order. It must not be deleted as hygiene. If it is kept, it belongs under Database parity for the same reason as `rateLimit.ts`.

## D. Reachable only through the DEV-gated previews

`src/App.tsx` gates both preview routes behind `import.meta.env.DEV`, so these are absent from a production build:

| File | Note |
| --- | --- |
| `src/dev/ComponentsPreview.tsx` | the component gallery |
| `src/dev/MatchCentreScenarioPreview.tsx` | Match Centre scenario preview |
| `src/domain/tournament/matchCentreScenarios.ts` | scenario fixtures |
| `src/domain/tournament/rankLeaderboard.ts` | **also used by `scripts/seed-dev/scoreEntries.ts`** — dev-preview-only from the application graph, not repository-orphaned |
| `src/features/scoring/index.ts` | reached only from `ComponentsPreview.tsx` |

**Assessment:** all legitimate development tooling; none ships. `DOC-003` ("Component gallery large/partly historical", Open, development-only) is the right home for any decision about the gallery's size, and `src/features/scoring/index.ts` should be examined there rather than here — it is a feature-shaped module whose only consumer is the gallery.

`rankLeaderboard.ts` is called out explicitly because an application-graph scan alone would misclassify it as removable.

## E. Type-only modules

Never value-imported, so they contribute types and no runtime code. All three are correct as they are:

- `src/design-system/types.ts`
- `src/domain/competition/kinds.ts`
- `src/domain/competitions/competitionModel.ts`

Repeating the trap recorded in the 30 July landed-state verification: `src/domain/competitions/` (**plural**) is the pre-existing Bonus Games model and is **not** `src/domain/competition/` (**singular**), the new shared competition engine. Both appear in this list. Do not treat one as evidence about the other.

## F. Concurrency — what must not be touched now

Checked against every open branch. `src/domain/competition/kinds.ts` is modified by five of them — `agent/reconcile-stage-b-status`, `agent/retire-match-temporal-state`, `agent/migrate-entry-lock-context`, `agent/migrate-match-centre-context`, `agent/migrate-matches-tab-context` — as part of the Stage B competition-context migration (PRs #216, #222, #223, #224, #225).

No open branch touches any file in §B, §C or §D. The two safe retirements in §B are therefore actionable without conflict; the §A relocation is not, because `src/features/matches/` and `src/domain/tournament/` are heavily rewritten by the Stage B stack, and moving test files across that boundary would collide.

## Recommended disposition

| Action | Files | Blocked on |
| --- | --- | --- |
| Delete | `src/domain/tournament/seedData.ts`, `src/App.css` | nothing — no references, no branch conflict |
| Add Database parity coverage, then decide | `src/domain/rateLimit.ts` | parity suite work; relates to `DATA-007` |
| Refer to scoring authority | `src/domain/tournament/calculateLeagueRank.ts` | owner decision that contract 62 owns the tie-break order |
| Relocate to `tests/` | the three `src/**/*.test.*` files | Stage B integration on `main` |
| Assess with the gallery | `src/features/scoring/index.ts` | `DOC-003` |
| Leave alone | everything in §E, `rankLeaderboard.ts` | — |

`HYGIENE-002` should **not** close on this document. Two files can be retired; the two genuinely interesting cases — an unverified parity mirror and a superseded scoring rule — are findings that outlive the deletion question, and both point at coverage rather than cleanup.

## Constraints observed

- No file under `src/`, `tests/`, `supabase/`, `scripts/` or `config/` was created, modified or deleted.
- No module was deleted, including the two assessed as safe to delete.
- No register row was edited; severity and status remain the owner's call.
- No hosted Supabase or Netlify access was used, and no hosted claim is made.
- The analysis script was run from a scratchpad and is not committed; the method section states enough to reproduce it, including the parser defect to check for first.
