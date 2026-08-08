# Predictor progress handover — 2026-08-08 01:00

## Scope

This session continued from the current repository rather than replaying earlier work. It inspected exact `main`, the current authority/control documents, open PRs and CI, both Supabase migration ledgers, and only the active Netlify site `euro28predictor` (`c69da01a-4650-43db-a1d2-b78b7f8e198a`). The historic `euro28-predictor-dev` site was not inspected, configured or used.

## Final authoritative state

- GitHub `main`: `305b4e12b43a28f349f5fd27c954bd8247742a52`.
- Repository contract: **132**, through `20260807210812_provider_initial_fixture_approval.sql`.
- Development Supabase `iouzoutneyjpugbbtdem`: **131 migrations**, through `20260806220000_period_standings_display_names`.
- Production Supabase `vkfnsqdyhvtwyqkisxhk`: **131 migrations**, through the same migration.
- Production promotion remains unauthorised by repository policy; equality at 131 before this merge did not create continuing authorisation.
- Active Netlify project: `euro28predictor`; current production deploy `6a6bac566b6e440008d44e5b`, state `ready`.
- No Supabase migration, Edge Function deployment, Netlify configuration change, production deploy or production database mutation was performed in this session.

The repository now intentionally leads both hosted databases by one contract. Development must receive Contract 132 through the repository-controlled Development fast lane before Contract 133 may be treated as hosted-ready. Production must not be advanced merely to restore numeric equality.

## Contract 132 — completed and merged

PR #583, `Contract 132: approve initial provider fixture calendars`, was the highest-priority schema candidate.

The contract establishes the repeatable initial provider-fixture adoption boundary:

- successfully decoded `contract-132-v1` fixture evidence is staged as immutable pending proposal evidence;
- provider club names and SportMonks round identity are retained in normalized evidence;
- explicit competition-admin approval is required before canonical teams, matchweeks and scheduled fixtures are created;
- approval refuses incomplete initial calendars: Scottish Premiership 198 fixtures / 33 rounds / 12 clubs, Premier League 380 / 38 / 20;
- canonical fixtures are created as scheduled with null scores;
- provider score/status information remains evidence only and does not become official result truth;
- the protected result-confirmation/scoring/settlement lane remains separate;
- internal helpers remain behind the internal schema/privilege boundary and the public decision RPCs retain the competition-admin capability gate.

### CI defects found and repaired before merge

Two repository-integrity failures were found while verifying the candidate. Neither was bypassed.

1. The deterministic E2E seed authority was still stamped as reviewed at Contract 131. Contract 132 does not tighten or replace an existing authenticated seeded-user read: its new public entry point is administrator-only and its projection helpers are internal. The marker was raised to 132 only after Database parity and authenticated Browser E2E had passed. The long historical seed-review commentary was deliberately preserved.
2. The Stage C1 overlay inventory had not registered Contract 132's two new admin RPCs. `docs/architecture/stage-c1-schema-overlay.md` now records `admin_approve_initial_provider_fixtures` and `admin_reject_initial_provider_fixtures`, and `tests/scripts/stageC1SchemaOverlayCoverage.test.ts` moves its positive control from 62 to 64 reviewed functions.

Temporary branch-only repair helpers used during concurrent branch work were removed before the final candidate. The final PR changed-file inventory contains no `_contract132-*` helper workflow.

### Final exact-head verification

Final PR #583 head: `339fd903a89bc7ffc45e754f87c3330276561842`.

All required gates passed on that exact head:

- Hosted migration inventory — run `31230437348`: **success**.
- CodeQL — run `31230437338`: **success**.
- Database parity — run `31230437337`: **success**.
  - populated migration transition rehearsals passed;
  - zero-to-current rebuild passed;
  - provider-poll unauthorised request rejection passed;
  - database lint passed;
  - pgTAP passed;
  - TypeScript/PostgreSQL parity passed.
- Browser E2E — run `31230437344`: **success**.
  - authenticated application journeys passed;
  - signup/password-recovery journeys passed;
  - exact active-site deploy-preview smoke passed;
  - protected release identity remained non-public.
- Main CI — run `31230437394`: **success**.
  - migration timestamp validation, documentation authority, generated-current-state validation, build, compressed bundle budgets, lint, domain coverage, isolated full Vitest suite and dependency audit all completed through the normal workflow.
- No unresolved review threads remained.

PR #583 was squash-merged with expected-head protection. Merge commit:

`305b4e12b43a28f349f5fd27c954bd8247742a52`

The push to `main` started the normal post-merge repository CI. No production deployment was forced from this session.

## Hosted rollout boundary

Fresh direct migration-ledger reads after the merge show both Development and Production still at Contract 131. This is the correct state until a controlled rollout occurs.

`.github/workflows/development-fast-lane-rollout.yml` is `workflow_dispatch` only and requires the exact Development project reference plus its explicit confirmation input. It also refuses the Production project. The connected GitHub action surface available in this session exposes workflow inspection and reruns but not workflow dispatch.

Therefore Contract 132 was **not** applied through `Supabase.apply_migration` as a substitute. Doing so would bypass the repository preflight, exact pending-set proof, additive-scope proof, snapshot, postflight and hosted-authority evidence path. Preserving that gate is intentional.

## Contract 133 / private Predictor Championship

PR #587, `Contract 133: expose private Championship player state`, already contains the next bounded server-read slice:

- `public.get_my_season_cup_instances(uuid)` — current public Championship plus private instances only when the caller is already an entrant;
- `public.get_season_cup_player_view(uuid)` — explicit entered-player view reusing the existing phase/table authority, with bounded member display names and fixture schedule;
- private non-member indistinguishability is preserved;
- scoring, settlement and ranking remain server-owned rather than duplicated in React.

Its rollback-only Development prototype already proved the intended Scottish rehearsal shape: Nicky Gregal discovers exactly one private Championship, Matchweek 2 vs Alex Turner; an outsider discovers no private instance; guessing the real private UUID yields the same minimal denied shape as a nonexistent UUID. The prototype functions were rolled back and are not hosted.

PR #587 is still **draft** and must not be merged yet. Although its PR base now points at post-Contract-132 `main`, its branch history was cut from a pre-squash Contract-132 ancestor, so the branch must be cleanly restacked/cherry-picked onto exact `305b4e12...` before its current CI failures are treated as product evidence. Its genuine Contract-133 delta is the new migration, pgTAP/privilege coverage, deployment-contract 133 update and small authority-document increments; the already-merged Contract-132 history must not be reintroduced.

PR #585, `Domestic Frontend Alpha: surface private Predictor Championships`, remains draft behind Contract 133. It supplies the instance chooser and canonical My Fixture / Table / Fixtures routes, but it must remain unmergeable until the two server RPCs exist in the active deployment contract and the real signed-in hosted journey is verified.

PR #588 remains temporary integration-validation evidence only and must not be merged. It should be retired once equivalent validation is represented by the clean Contract-133 + UI stack.

## Handover-report correction

An earlier documentation-only PR #589 was opened while Contract 132's final CI was still running. Once the final CI passed and #583 merged, that report was stale within the same session. PR #589 was closed unmerged rather than preserving a pre-merge state report as current evidence. This final handover is based directly on post-merge `main`.

## Mutations performed

- Updated Contract 132's deterministic seed-review authority from 131 to 132 after direct database/browser evidence.
- Updated the Stage C1 overlay and its positive-control function inventory for the two Contract-132 admin RPCs.
- Removed temporary branch-only repair helper workflows before merge.
- Squash-merged PR #583 under expected-head protection as `305b4e12b43a28f349f5fd27c954bd8247742a52`.
- Closed stale documentation PR #589 unmerged after its recorded state was superseded.
- Published this final post-merge handover from exact Contract-132 `main`.
- No Supabase, Edge Function, Netlify configuration, production deploy or production database mutation occurred.

## Risks / blockers

1. **Development is one contract behind the repository.** Contract 132 must be applied through the guarded Development fast lane; the connected GitHub surface in this run cannot dispatch that workflow.
2. **Production is also one contract behind, intentionally.** There is no reason to promote it merely to match the repository. A future production rollout needs separate repository-controlled authorisation and all production hard gates. The live authority audit also found stale prose in `AGENTS.md` and `docs/quality/current-status.md` claiming Contract 132 Production promotion was authorised; this PR reconciles both to the machine record `promotionAuthorised: false`.
3. **PR #587 needs a clean restack.** The logical Contract-133 work is soundly isolated, but the branch still carries pre-squash Contract-132 ancestry. Do not merge or force a risky history rewrite without re-verifying the exact delta.
4. **PR #585 remains backend-dependent.** The instance-aware UI must not bypass the deployment-contract guard or query revoked private tables directly.
5. **Provider initial-calendar approval is repository-only until Development 132 is hosted.** Do not configure production provider credentials or adopt a real initial calendar as part of merely closing the contract-number gap.

## Exact next action for 03:00

1. Re-read exact `main` and confirm post-merge CI for `305b4e12b43a28f349f5fd27c954bd8247742a52` is green.
2. Dispatch the repository-controlled Development fast lane from that exact main head for project `iouzoutneyjpugbbtdem`, applying **only Contract 132**. Do not substitute a direct Supabase migration if workflow dispatch remains unavailable.
3. Verify Development reaches `20260807210812_provider_initial_fixture_approval` directly, and verify the proposal table/RPC grants, internal helper revokes, admin capability gate and result-truth separation on hosted Development.
4. Merge the generated hosted-authority follow-up only after its own exact-head checks pass.
5. Restack PR #587 so only the genuine Contract-133 delta sits on post-132 main; keep it draft until CI, Database parity, pgTAP, Browser E2E and the active-site preview are green.
6. After Development 132 is verified, advance Contract 133 through the normal workflow and guarded Development rollout, then verify the real signed-in Nicky Gregal private Championship journey.
7. Restack PR #585 on the verified Contract-133 tree and retire temporary validation PR #588 once equivalent checks are represented by the real stack.
8. Leave Production at Contract 131 unless a separate repository-controlled release explicitly authorises Contract 132 promotion.
