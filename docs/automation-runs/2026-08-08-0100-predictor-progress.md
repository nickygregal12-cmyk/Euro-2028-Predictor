# Predictor progress handover — 2026-08-08 01:00

## Scope

This run continued from the latest repository state without re-running completed implementation work. It inspected current `main`, live authority/control documents, open pull requests and exact-head CI, both Supabase migration ledgers, and the single active Netlify site `euro28predictor` (`c69da01a-4650-43db-a1d2-b78b7f8e198a`). The historic `euro28-predictor-dev` project was not inspected or used.

## Current authoritative environment state

- GitHub `main`: `b76cd64a2f7290724f70f7c717180ec313fed2b5` (PR #584, Development-only Scottish private Championship weekend rehearsal).
- Repository contract on `main`: 131, through `20260806220000_period_standings_display_names.sql`.
- Development Supabase `iouzoutneyjpugbbtdem`: independently read at 131 migrations, through `20260806220000_period_standings_display_names`.
- Production Supabase `vkfnsqdyhvtwyqkisxhk`: independently read at 131 migrations, through the same migration. `config/production-hosted-contract.json` records the successful production continuation evidence and `promotionAuthorised: false`.
- Active Netlify project: `euro28predictor`; current production deploy `6a6bac566b6e440008d44e5b`, state `ready`.
- No Supabase, Edge Function, Netlify configuration, production deploy or production database mutation was performed in this run.

This supersedes older automation narratives that still described Production as contract 63. Current machine authority and a fresh direct ledger read both place Production at contract 131. Contract equality does not authorise a future production promotion.

## Contract 132 — PR #583

PR #583, `Contract 132: approve initial provider fixture calendars`, is the highest-priority schema candidate and remains open/ready/mergeable. Its current exact head at the end of this handover is `339fd903a89bc7ffc45e754f87c3330276561842`.

The contract introduces the repeatable initial provider-fixture adoption boundary:

- successfully decoded `contract-132-v1` fixture evidence is staged into an internal proposal table;
- proposal evidence is RLS-enabled, browser/service grants are revoked and decided evidence is immutable;
- `admin_approve_initial_provider_fixtures` and `admin_reject_initial_provider_fixtures` are explicit competition-admin decisions with pinned empty `search_path`;
- approval is empty-season-only and refuses incomplete initial calendars (Scottish Premiership 198 fixtures / 33 rounds / 12 clubs; Premier League 380 / 38 / 20);
- canonical fixtures are created as `scheduled` with null scores; provider score/status data remains evidence and does not become official result truth;
- the existing protected result-confirmation lane remains separate.

### CI repair completed on the branch

The preceding exact head `31df10108e9f0b39a80c0a061a77350bf3a919a1` failed the main CI test stage while Database parity, Browser E2E, hosted inventory and CodeQL passed. The branch repaired the Stage C1 overlay inventory: Contract 132 adds two reviewed admin RPCs, moving the positive-control function count from 62 to 64 and recording both RPC dispositions in `docs/architecture/stage-c1-schema-overlay.md`.

The repair was committed as `5c723d4fab8633ffe141e7f9aead056b96cde8a2` (`docs: register Contract 132 RPC overlay disposition`). A temporary branch-only helper workflow used to make that one sync was then removed; the current clean head is `339fd903a89bc7ffc45e754f87c3330276561842`.

### Exact-head verification at handover time

For `339fd903a89bc7ffc45e754f87c3330276561842`:

- Hosted migration inventory: passed (`31230437348`).
- CodeQL: passed (`31230437338`).
- Database parity: passed (`31230437337`), including rebuild/pgTAP/parity lanes.
- Browser E2E: passed (`31230437344`), including the exact-head active-site deploy-preview smoke.
- Netlify deploy preview on the active `euro28predictor` project: ready (`6a767960017d0800085c6faa`).
- Deploy-preview smoke verified protected release identity was not public.
- Main CI: still in progress at the final check, with migration timestamps, documentation authority, generated NOW, build, compressed bundle budgets, lint and coverage threshold steps already passed; the full test step was still running.
- No unresolved review threads were present.

The PR was therefore deliberately not merged. The one remaining exact-head gate, main CI, was not bypassed.

### Netlify observation

The current Contract-132 deploy preview is functionally ready but its Netlify Lighthouse report is anomalously low for Performance (20) and Best Practices (92), while Accessibility and SEO remain 100. This is recorded as a follow-up signal rather than treated as evidence that the database contract itself regressed UI performance. The normal exact-head CI/E2E gates remain the merge authority.

## Contract 133 / private Championship stack

The next dependent implementation is already isolated but must remain behind Contract 132:

- PR #587 — `Contract 133: expose private Championship player state` — draft, based on the Contract-132 branch. It adds bounded authenticated reads for the caller's public/private Championship instances and explicit entered-player view. It preserves private non-member indistinguishability, server-owned ranking/fixture facts and existing settlement authorities. Its rollback-only Development prototype proved Nicky Gregal discovers exactly one private Scottish Championship, Matchweek 2 vs Alex Turner, while an outsider discovers none and guessing the private UUID returns the same denied shape as a missing id. Prototype functions were rolled back and are not hosted.
- PR #585 — `Domestic Frontend Alpha: surface private Predictor Championships` — draft UI slice. It is intentionally not mergeable as product work until Contract 133 provides its RPC boundary and Development is upgraded in order.
- PR #588 — temporary integration-validation PR — draft and explicitly `do not merge`.

The old #588 validation CI failure was inspected. Its build failed because that temporary stack was based on an older dependency snapshot missing `src/features/season/SeasonGameSubNav.module.css`. That stylesheet is present on current `main`; this is stale-stack integration evidence, not a reason to modify current product code. The correct treatment is to restack/re-run after Contract 132 lands, then retire #588 when equivalent validation is green.

## Repository-control limitation observed

The connected GitHub action surface available in this run exposes workflow/read/rerun operations but no workflow-dispatch action. If Contract 132 merges, its additive Development migration must still go through the repository-controlled development fast lane from exact `main`; a direct `Supabase.apply_migration` would bypass ADR 0024's preflight/evidence path and is not an acceptable substitute.

## Mutations performed

- Created branch `automation/2026-08-08-0100-handover` from exact `main` `b76cd64a2f7290724f70f7c717180ec313fed2b5`.
- Added and refreshed this dated handover file.
- Opened PR #589, `Docs: record 2026-08-08 01:00 progress handover`.
- No product code, migration, Supabase, Edge Function, Netlify configuration or production mutation was made.

## Risks / blockers

1. Contract 132 cannot merge until exact-head main CI completes successfully; every other inspected exact-head gate is green.
2. The Contract-132 feature branch is substantially ahead of and behind `main`; GitHub currently reports it mergeable, but exact-head checks and expected-head protection remain mandatory because concurrent `main` work has landed.
3. Contract 133 and its UI must be restacked after 132; the current validation stack is stale and must not be merged.
4. Development rollout of 132 must use the guarded fast lane. No workflow-dispatch operation was exposed by the connected GitHub tool in this run.
5. The Contract-132 Netlify preview Lighthouse Performance score of 20 is a notable preview observation and should be rechecked on the post-merge/restacked application tree rather than ignored.

## Exact next action for 03:00

1. Re-read PR #583 and confirm its head is still `339fd903a89bc7ffc45e754f87c3330276561842` (or restart verification on any newer head).
2. Confirm the remaining main CI run has passed; Hosted migration inventory, CodeQL, Database parity, Browser E2E and the exact active-site Netlify preview/smoke are already green at this handover.
3. If main CI is green and no review thread appeared, squash-merge PR #583 with expected-head protection.
4. Run the repository-controlled additive Development fast lane for Contract 132 from exact post-merge `main`; verify the Development ledger reaches 132 and directly verify the new proposal/RPC privilege boundaries. Do not substitute a direct Supabase migration if workflow dispatch remains unavailable.
5. Merge the generated hosted-authority follow-up only after its own checks pass.
6. Restack PR #587 onto exact Contract-132 `main`, keep it as Contract 133, run full database/application gates, then apply Development 133 through the same controlled path.
7. Restack PR #585 onto the verified Contract-133 tree and run the real signed-in private Championship journey. Close the disposable #588 validation PR once equivalent validation is represented by the real stack.
8. Keep future Production promotion unauthorised unless a separate repository-controlled release explicitly changes `promotionAuthorised` and passes the production hard gates.
