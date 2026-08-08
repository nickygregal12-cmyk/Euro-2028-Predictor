# Predictor progress handover — 2026-08-08 03:00

## Scope

Continued from the completed 01:00 session on `nickygregal12-cmyk/Euro-2028-Predictor`, preserving the repository hard gates and environment separation. Only the active Netlify site `euro28predictor` (`c69da01a-4650-43db-a1d2-b78b7f8e198a`) was inspected. The historic `euro28-predictor-dev` site remained out of scope.

## Starting state revalidated

- `main`: `305b4e12b43a28f349f5fd27c954bd8247742a52`.
- Repository contract: 132 (`20260807210812_provider_initial_fixture_approval`).
- Development Supabase `iouzoutneyjpugbbtdem`: directly verified at 132 migrations through `provider_initial_fixture_approval`.
- Production Supabase `vkfnsqdyhvtwyqkisxhk`: directly verified at 132 migrations through the same migration.
- Contract 132 reached Development and Production through the repository-controlled guarded rollout/rehearsal/promotion jobs before this continuation; no direct database promotion was substituted in this run.
- Active Netlify project remains repository-linked `euro28predictor`; published production deploy remains the existing ready deploy. No Netlify mutation was performed.

## Contract 132 postflight security check

Direct read-only Development verification confirmed:

- `predictor_internal.stage_provider_fixture_proposals` and `predictor_internal.block_provider_fixture_proposal_rewrite` are not executable by `anon`, `authenticated`, or `service_role`.
- `public.admin_approve_initial_provider_fixtures` and `public.admin_reject_initial_provider_fixtures` are not executable by `anon` or `service_role`; authenticated execution remains the narrow public RPC surface and the functions enforce competition-admin authority internally.
- `predictor_internal.provider_fixture_proposals` exposes no table privileges to `anon`, `authenticated`, or `service_role`.

This preserves the archive/normalise -> immutable proposal -> explicit admin approval boundary. Provider score evidence is still not official result truth.

## Hosted-authority drift identified

Fresh hosted ledgers show both Development and Production at contract 132, but `main` still records contract 131 in:

- `config/development-hosted-contract.json`
- `config/production-hosted-contract.json`
- the current hosted-state sections of `docs/quality/current-status.md`
- the current hosted-state sections of `docs/ops/ops-pending-migrations.md`

This is documentation/machine-authority lag, not database drift. It must be reconciled through a coherent authority update; the two JSON files must not be advanced alone because the hosted-inventory guard also checks the operational inventory rows. `promotionAuthorised` remains false for future Production promotions.

## Contract 133 restack

Old PR #587 was not safe to merge. Its branch was 41 commits ahead and 12 commits behind current `main`, carrying Contract 132 and unrelated provider/documentation history. It was closed as superseded.

Created clean branch `feature/contract-133-private-championship-restack` from exact Contract-132 `main` and transplanted only the genuine Contract-133 delta:

- `config/deployment-contract.json` (132 -> 133)
- `supabase/migrations/20260808003000_private_season_cup_player_reads.sql`
- `supabase/tests/080_function_privileges.sql`
- `supabase/tests/185_private_season_cup_player_reads.sql`

Initial clean commit: `941a393247aed0f6dc41f702dd60850782624a36`.

Opened draft PR #591: **Contract 133: restack private Championship player reads**.

Contract 133 adds two authenticated, caller-scoped read surfaces for the private season Predictor Championship journey:

- discover Championship instances the caller is entitled to see;
- read one selected entered-player view containing the server-owned current group, opponent, table and fixture schedule.

It does not grant direct browser access to private Cup tables and does not move scoring, ranking, phase, settlement or lifecycle authority out of their existing server-owned boundaries. A non-member probing a private UUID remains indistinguishable from a missing ID.

## Contract 133 authority and generated-state repairs

The first clean-head CI run passed migration-order validation but correctly failed documentation-authority validation because twelve live authority documents still stopped at contract 132.

A one-shot branch-only workflow appended bounded Contract-133 authority notes to those twelve current documents. The resulting documentation commit is `8f95d80ea172a06e4a52adbf5d0fc94fc56fb27c`; that temporary workflow was then removed.

The next exact-head CI run confirmed migration ordering and documentation authority were both repaired, then correctly failed the generated-state check because `NOW.md` had not been regenerated. A second one-shot branch-only workflow ran the repository-owned `npm run generate:now` command. It completed successfully and committed only the generated `NOW.md` delta as `efc0d55f69f0c3bad6a9d82096ec7bd68fdd091e`.

The NOW-generator workflow was then removed from the candidate. Final clean Contract-133 candidate head at handover: `b756d25215dd1cfccbdf0db65ecf597c15135615`.

PR #591 is mergeable but remains draft while the final exact-head checks run. The candidate contains the four Contract-133 implementation/test files, the required bounded Contract-133 notes in the twelve current authority documents, and generated `NOW.md`; neither one-shot helper workflow remains in the final tree.

## Verification status at handover

Verified during the repair cycle:

- hosted migration inventory passed on the clean Contract-133 line;
- CodeQL passed on the initial clean line;
- migration timestamp ordering passed;
- the twelve-document authority sweep passed after repair;
- `npm run generate:now` completed successfully and changed only generated `NOW.md`.

Fresh exact-head workflows for `b756d25215dd1cfccbdf0db65ecf597c15135615` are now registered: CI and hosted migration inventory have started; Browser E2E and Database parity are queued; CodeQL is pending. Those exact-head checks, plus the active-site Netlify preview, must complete before #591 leaves draft or merges.

No Contract-133 migration has been applied to Development or Production.

## Stale branch / handover cleanup

- Closed stale PR #587 as superseded by clean restack #591.
- Closed PR #590 as superseded. It was written before the guarded Contract-132 Development rollout and Production promotion completed and therefore incorrectly described both hosted environments as contract 131. It was deliberately not merged into `main`.

## Handover publication

This report is published through PR #592 from branch `automation/2026-08-08-0300-authority-reconcile`.

## Mutations performed in this run

Repository only:

- created clean Contract-133 branch;
- committed the four-file Contract-133 restack;
- opened PR #591;
- reconciled the twelve required Contract-133 documentation authorities on that branch;
- regenerated `NOW.md` with the repository-owned generator;
- removed both temporary one-shot helper workflows from the final candidate;
- closed stale Contract-133 PR #587;
- closed stale 01:00 handover PR #590;
- published and refreshed this 03:00 handover in PR #592.

Hosted systems:

- no Supabase schema/data/migration mutation;
- no Edge Function deployment;
- no Netlify configuration, branch-deploy or production-deploy mutation;
- no production data mutation.

## Risks / blockers

1. PR #591 cannot merge until all exact-head required checks on `b756d25215dd1cfccbdf0db65ecf597c15135615` complete successfully, including CI, Database parity/pgTAP, Browser E2E, CodeQL, hosted migration inventory and the active-site Netlify preview.
2. The repository hosted-authority files still lag the directly verified Contract-132 state. Generated `NOW.md` therefore truthfully reflects the repository authorities rather than the fresher hosted ledger; reconcile the machine authority coherently before using it for a Contract-133 rollout.
3. Contract 133 is repository-only; Development and Production remain at 132 until repository-controlled rollout gates explicitly advance them.
4. The dependent private Championship UI must not be integrated on top of stale PR #587; it should be restacked on the clean Contract-133 line after the backend contract is green and Development is verified.

## Exact next action for 05:00

1. Recheck PR #591 at exact head `b756d25215dd1cfccbdf0db65ecf597c15135615`.
2. Inspect and repair any exact-head CI, Database parity/pgTAP, Browser E2E, CodeQL or active-site preview failure; do not bypass a required gate.
3. Once every gate is green, mark #591 ready and squash-merge it using expected-head protection.
4. Reconcile the stale Contract-132 hosted-authority record coherently (development JSON, production JSON and the current hosted inventory/status rows) and let its guard pass; keep `promotionAuthorised` false.
5. Run the guarded Development rollout for Contract 133 only after repository authority is coherent, directly verify the two new RPC privilege/privacy boundaries and the Development migration ledger, then merge the generated hosted-authority follow-up.
6. Restack the dependent private Championship UI on exact post-Contract-133 `main` and verify the real signed-in My Fixture / Table / Fixtures journey. Keep any disposable integration-validation PR out of `main`.
