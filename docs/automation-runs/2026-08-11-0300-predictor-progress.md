# Euro 2028 Predictor — 03:00 progress handover — 2026-08-11

## Executive summary

The 01:00 handover was overtaken by successful repository-controlled Production promotion work before this session began. The authoritative baseline is now repository Contract 157, Development Contract 157 and Production Contract 157. Production reached 157 through the guarded sequence recorded on `main`: fresh encrypted backup run `31445515426`, Production-shaped rehearsal run `31446161436`, guarded rollout run `31446392236`, independent verification and the generated hosted-authority update merged by PR #678.

No database migration, data mutation, Edge Function deployment, provider backfill, Netlify configuration change or Production application deployment was performed in this 03:00 session.

The remaining highest-value work is application/repository convergence: generated database types still record Contract 151, and PR #672 is now materially stale against current `main`. Its Main CI failure is exactly the generated-types contract assertion (expected 157, received 151). Its latest Browser E2E failure occurred before any application journey, at disposable local Supabase startup; only that failed job was re-run and the retry was still in progress at handover time.

## Authoritative baseline

- `main`: `2cf8b450be34bd3839f888ed7692e013b1926bfa` (`Record Production at contract 157 (#678)`).
- Repository deployment contract: 157 / 157 required migrations.
- Development project `iouzoutneyjpugbbtdem`: independently queried at 157 migrations; latest `20260810230000_player_preferences`.
- Production project `vkfnsqdyhvtwyqkisxhk`: independently queried at 157 migrations; latest `20260810230000_player_preferences`.
- The repository still separates database promotion from application release. Do not infer that Production database Contract 157 means all Contract-157-consuming frontend code is live.
- Active Netlify site only: `euro28predictor`, site ID `c69da01a-4650-43db-a1d2-b78b7f8e198a`.
- Active Production deploy observed: `6a7a44d10fbd4c00087a8c3c`, state `ready`.
- Historic site `euro28-predictor-dev` was not inspected, configured or used.

## Production promotion discovered and verified

The 01:00 report left Production at Contract 151 and correctly required fresh backup -> pinned rehearsal -> guarded rollout. That sequence subsequently completed through repository controls before this session started:

1. fresh encrypted Production backup: `31445515426`;
2. Production-shaped 151 -> 157 rehearsal: `31446161436`;
3. guarded Production 151 -> 157 rollout: `31446392236`;
4. independent hosted verification;
5. Production hosted-authority PR #678 merged.

Fresh direct reads from both hosted projects in this session independently confirmed 157 migrations and the same latest migration. No direct-apply shortcut was used.

## PR #672 — frontend Contract 147–151 consumption

PR #672 remains open at exact head `57b99590b7ab8f5455c1e4aad73b05c5f29812e1`. It contains valuable frontend work: server-driven competition discovery, Match Centre improvements, private-league Matchweek/Table/Members views, rank movement, player-profile routes, and the domestic `/profile` dead-end correction.

However, it is no longer a safe direct merge candidate:

- its branch is based on an older repository state and has diverged from current Contract-157 `main`;
- Main CI failed only at `tests/services/databaseTypes.test.ts`, where the generated-types metadata reports Contract 151 but the repository now requires 157;
- Visual Contracts passed;
- CodeQL passed;
- the latest Browser E2E failure did not execute an application journey: `Start disposable local Supabase` failed and all subsequent migration/seed/journey steps were skipped.

The Browser E2E job was re-run in this session because this is infrastructure/startup evidence, not evidence of an application regression. The retry was still running at the handover cutoff.

Do not merge #672 as-is. Once generated types are reconciled, clean-restack the genuine frontend delta onto exact current `main` rather than force-merging its old history.

## Generated database types — current blocking repository drift

`src/services/supabase/database.types.meta.json` on `main` still identifies the generated schema as Contract 151, while the deployment contract and both hosted databases are Contract 157.

This is now legitimate drift rather than a pre-rollout guard: Development is at 157, so the canonical `npm run generate:types` path can now regenerate `src/services/supabase/database.types.ts` and its metadata from hosted Development without weakening the test.

A fresh Development type-generation read was successfully obtained in this session and includes Contract-152–157 surfaces such as `competition_follows`, `pinned_rivals`, `season_wrapped`, `get_my_preferences`, `set_competition_follow`, `set_pinned_rival`, onboarding progress and related current RPCs. The repository files have not yet been mutated because the connected generation call returns the generated TypeScript as data, while the repository-owned generator is the authority that writes both the type file and provenance metadata coherently.

The next session should prefer the repository-owned generation path or an existing repository-controlled workflow. Do not simply edit the metadata from 151 to 157 without regenerating the actual schema file.

## PR #670 — audit remediation

PR #670 remains useful but its competing Contract-152 migration history is obsolete now that the canonical Contracts 152–157 are merged and hosted in both environments. Do not merge the old stack.

After #672 is cleanly restacked, preserve only #670's unique validated audit/security work (including authority-source cleanup, typed-client work, `pg_net` exposure assertion and recurring active-Netlify checks) and drop the superseded migration history.

## Netlify

Only the active `euro28predictor` site was inspected. The current Production deploy remains ready. No deploy, site configuration or protection change was made. The historic site was not queried.

Keep application releases repository-controlled. Database Contract 157 is necessary authority for Contract-157-consuming code, but does not itself authorise a manual Netlify Production deploy.

## Cleanup performed

PR #675, the 01:00 handover PR, was closed as superseded rather than merged because its Production-151 continuation path became false after the successful guarded Production rollout. Its historical branch/report remains preserved.

## Mutations performed in this session

- Re-ran only PR #672's failed Browser E2E job after proving the failure occurred at disposable local Supabase startup before any application journey.
- Closed superseded handover PR #675.
- Created this 03:00 handover branch/report.
- No Supabase write or migration.
- No Edge Function deployment.
- No provider request/backfill.
- No Netlify mutation or deployment.
- No Production application release.

## Risks / blockers

1. **Generated type drift:** repository-generated DB types still claim Contract 151 although repository/Development/Production are 157. This is the immediate deterministic CI blocker for #672 and should be repaired through the canonical generator.
2. **#672 stale stack:** valuable UI changes are mixed with old branch history. Clean restacking is safer than merging the divergent branch.
3. **Browser E2E infrastructure flake:** the observed failure is local Supabase startup, not an application assertion. Do not change UI code unless the retry reaches a real journey and demonstrates a reproducible defect.
4. **Application release lag:** Production database is 157, but do not equate that with the Production application being at the same capability level. Release only through repository controls after the consuming frontend is merged and verified.
5. **#670 superseded migration:** retain its unique audit repairs but never reintroduce its old Contract-152 migration lineage.

## Exact next action for 05:00

1. Recheck PR #672 Browser E2E retry. If disposable Supabase starts and authenticated journeys pass, record that as green evidence; if it fails again at startup, treat it as CI infrastructure and inspect the startup logs/artifacts rather than changing application code.
2. Regenerate `database.types.ts` plus `database.types.meta.json` from hosted Development Contract 157 through the repository-owned `npm run generate:types` path or its repository-controlled workflow. Verify the generated-types test, build, lint and full CI on an isolated PR and merge it first.
3. Clean-restack PR #672's genuine frontend changes onto exact post-types `main`, excluding obsolete branch history. Run Main CI, Browser E2E, Visual Contracts, CodeQL and the active-site Netlify deploy preview. Merge only an exact-head green candidate.
4. Reassess the Production application release after #672 lands. Use only the repository-controlled active-site release path; do not manually deploy through Netlify merely because the database is now Contract 157.
5. Then clean-restack #670, keeping unique audit/security repairs and discarding its superseded Contract-152 migration.
