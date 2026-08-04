# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and freshly verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 4 August 2026

## Product position

The product is the **Football Prediction Hub** (ADR 0020): a multi-competition football prediction platform. Euro 2028 is the first recoverable competition baseline, not the endpoint of the programme. The first supported domestic competition seasons are Premier League 2026/27 and Scottish Premiership 2026/27, alongside Euro 2028.

- **User evidence:** [`../architecture/phase-0-world-cup-evidence.md`](../architecture/phase-0-world-cup-evidence.md) — owner observation of a live World Cup predictor with roughly 60 users across a full tournament. It is the only user evidence the programme holds, and it corrects six recorded planning assumptions.
- Recoverable Euro baseline: `euro-2028-baseline` → `1fb8ffd36ad113079181829a8bcc47175c43b6da`.
- Remaining Euro-specific work: parked in [`../../MASTER-TODO.md`](../../MASTER-TODO.md) until **January 2028**.
- Product phases and gates: [`../architecture/programme-plan.md`](../architecture/programme-plan.md).
- Engineering sequence: [`../architecture/multi-competition-hub-build-plan.md`](../architecture/multi-competition-hub-build-plan.md).
- Current execution sequence: [`../roadmap.md`](../roadmap.md).
- Platform decisions: [`../adr/0011-multi-competition-platform.md`](../adr/0011-multi-competition-platform.md) through [`../adr/0024-development-environment-operating-model.md`](../adr/0024-development-environment-operating-model.md).

## Repository and release baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Current `main` | Read it from git. A hand-copied SHA in a live-authority document is stale the next time anything merges. Fixed anchors that do not move are the `euro-2028-baseline` tag and dated per-PR evidence. |
| Repository contract | **94** — 94 canonical migrations through `20260804223000_provider_ingestion_custody.sql`. Contracts 92 and 93 supply the season replay link and scoring job; contract 94 adds server-only provider-response custody and strict decoder evidence. Development Supabase is hosted at **91**, applied 4 August 2026 by fast-lane run 30916033941 on `a0af06d`, whose postflight reported `Development is at contract 91.` Production remains at **63**. Repository inclusion does not deploy `provider-poll`, configure a provider credential or call a provider. |
| Contract at Euro baseline | **63** canonical migrations through `20260729154931_prediction_consensus_minimum_cohort.sql`; the tag stays there while `main` moves forward. |
| Stage C governance | C1 competition-season foundation may progress; C2 profile ownership and account erasure remain blocked by issue #272. |
| Game-owned lock policy | PR #353: Original Predictor entry/0-minute, Main Predictor matchweek/0-minute, Last Man Standing matchweek/30-minute. Missing, unknown, stale or incompatible policies fail closed. |
| Season rule authorities | Pure rule authorities exist under `src/domain/season/` for Main Predictor, Last Man Standing and Predictor Cup. They remain separated from tournament rules and have no network, storage or ambient-clock reads. |
| Season SQL and persistence | Main Predictor has fixture, prediction, card, settlement and score storage plus its recurring scoring job through contract 93. Last Man Standing has storage, deterministic assignment, replay and its settlement job through contract 89. The season Cup has shared SQL sources, schedule and storage-domain support through contract 79. **No player-facing season surface renders these systems yet.** |
| Provider-ingestion custody | Contract 94 fixes approved provider origins and bounded relative paths, checks a named caller key before provider I/O, archives exact raw response text before parsing, records append-only processing evidence, exposes custody RPCs only to `service_role`, bounds response reads, allowlists response headers and rejects credential-shaped query parameters. It has no authority path into official fixtures, results, locks, scores, totals, ranks or standings. |
| Next executable issue | Merge contract 94 only with exact-head CI, Database parity, Browser E2E, hosted-inventory and protected Netlify preview evidence. After merge, contracts 92–94 may reach Development only through the ADR-0024 fast lane using the required confirmation phrase and postflight proof. No provider credential, provider request, Edge Function deployment, C2 work or production write is authorised by repository inclusion. |
| Production posture | Controlled pre-launch target; production remains contract 63 and deploys stay paused until an intentional release milestone. |

## Hosted evidence boundary

This status includes fresh read-only GitHub and hosted-inventory evidence. It does **not** authorise a database, provider, Edge Function, credential or production mutation.

| Target | Current evidence | Fresh check required |
| --- | --- | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | Healthy Postgres 17. Contract **91** applied 4 August 2026 by ADR-0024 fast-lane run 30916033941 on `a0af06d`; postflight reported `Development is at contract 91.` The ledger was independently verified through `20260804193000_matchweek_settlement_parity`; the score store, trigger, settlement functions, privilege boundary and representative rule outputs were corroborated read-only. | Contracts 92–94 are pending. Apply them only after contract 94 merges through `.github/workflows/development-fast-lane-rollout.yml`, requiring additive proof, the lightweight snapshot and postflight `Development is at contract 94.` |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | Owner-verified at contract **63** on 29 July 2026 with preserved-data postflight; not freshly inspected here. | **REQUIRES OWNER VERIFICATION:** read-only applied-state, privilege and preservation checks before any write. |
| Production Netlify `main` | Last good ready deploy remains live. Production deploys are paused while Production Supabase remains at contract 63. This is a paused pipeline, not an outage. | Keep paused until an intentional migration/release milestone with exact-origin smoke and owner approval; do not promote merely to equalise contract numbers. |
| Non-production Netlify | `dev`, branch-deploy and deploy-preview point to Development, retain their separately managed deployed-contract declaration and require Netlify team login. | Protected preview must be verified against the exact final PR head. Align the hosted declaration only after the verified Development rollout. |
| Non-production Turnstile | Netlify non-production contexts use Cloudflare's always-pass test site key; production retains a separate real key. | **OPEN issue #28:** verify the matching Development Supabase test secret and prove preview sign-up, login and recovery without CAPTCHA errors. |
| Legacy `euro28-predictor-dev` Netlify site | Retired from current operations and protected by Netlify team SSO. | **OPEN issue #27:** disable the hourly scheduled function and verify its legacy Supabase disposition; current Euro environments remain untouched. |
| Production data/recovery | Owner-verified preserved counts and same-day encrypted backup/restore evidence on 29 July 2026. | **REQUIRES OWNER VERIFICATION:** fresh backup/restore proof before a data-risk milestone. |

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Euro 2028 baseline | **Tagged and recoverable.** Tournament work through contract 63 is preserved. |
| Euro 2028 forward work | **Parked.** Remaining official-data, presentation, rehearsal and release work returns in January 2028. |
| Context engine | **Complete.** Home, Matches, Match Centre and entry-lock decisions consume the shared competition context; `MatchTemporalState` is retired. |
| Cross-tournament read safety | **Landed.** `group_teams` reads are scoped through the selected tournament's groups. |
| Database API hardening | **Guarded.** Public-table RLS, security-definer `search_path`, public views, direct browser grants and deployed RPCs have executable inventories. |
| Account deletion | **Unsafe current behaviour, fully characterised and owned by C2.** C1 non-interference prevents ownership/deletion changes; issue #272 remains the blocker. |
| TypeScript/static coverage | **Exhaustive for committed TS/TSX.** Application, tests, e2e, production-smoke, tools and configs are covered by explicit projects and guards. |
| Leaderboard scale | **Measured, not redesigned.** ACQ-R02 remains open; hosted concurrency is untested and no materialised standings table exists. |
| Stage C1 | **Implemented and hosted in Development through contract 91.** Later repository contracts remain separately gated. |
| Stage C2 | **Blocked.** Independent data-protection review issue #272 must approve the retention/erasure boundary before profile ownership, pseudonymisation or related RLS work. |
| Provider custody | **Repository candidate complete at contract 94.** Raw-before-decode custody and processing evidence exist without giving provider data official-state authority. |
| Public launch readiness | **Not ready.** Domestic-season surfaces, provider rehearsal, operations, accessibility, legal/client and brand gates remain. |
| Production mutation | **Prohibited without action-specific owner approval and the full milestone process.** |

## Baseline capabilities carried forward

- authoritative tournament locks, submission, results, revisions, scoring, qualification and bracket replay;
- automatic valid-entry submission using the authoritative validator;
- deterministic group/tie resolution and real knockout winner propagation;
- bounded overall/private standings, profiles, H2H and post-lock consensus;
- richer post-lock My Entry, Trends and final standings;
- private Account controls and race-safe Original entry clearing;
- isolated KO Predictor, Last Man Standing and Predictor Cup tournament implementations;
- protected browser result/qualification administration;
- authenticated desktop/phone Bonus Games lifecycle coverage;
- automated desktop/phone accessibility and targeted overflow checks;
- deployment-contract, migration timestamp, CI, full Database parity, Browser E2E and exact-release controls.

These remain evidence for the first competition. The domestic-season backend now has substantial rule, storage and job coverage, but no player-facing season surface is complete.

## Season domain authorities

Pure modules under `src/domain/season/` remain the rule authorities:

| Area | Modules | Authority |
| --- | --- | --- |
| Main Predictor | `scoring`, `standings`, `matchweekSettlement`, `cardSubmission`, `fixtureReassignment` | ADR 0012 as amended by ADR 0020 |
| Last Man Standing | `lmsEligibility`, `lmsRoundResolution`, `lmsPresets` | ADR 0013 as amended by ADR 0020 and ADR 0022 |
| Predictor Cup | `cupFormat`, `cupTieSettlement`, `cupSchedule`, `cupGroupTable`, `cupLaunch` | ADR 0014 as amended by ADR 0020 and ADR 0022 |

| Game | Persistence | Driven by | Surface |
| --- | --- | --- | --- |
| Main Predictor | Fixtures, predictions, cards, lock outcomes and `season_matchweek_scores`. | Contract 93's hourly scoring job over contract 91 settlement parity and contract 92 replay linkage. | None. |
| Last Man Standing | Selections, windows and entrant state. | Contract 89's hourly settlement job with contract 88 lock-time auto-assignment. | None. |
| Predictor Cup | Cup stores and neutral sources through contracts 74–79. | No complete season-Cup execution caller yet. | None. |

`standings.ts` still has no complete bounded browser-facing season leaderboard read. The totals contract 93 writes are therefore not yet a visible season product.

## Provider-ingestion authority boundary

Contract 94 is custody, not promotion:

- the Edge Function accepts only named, fixed providers and bounded relative paths;
- the caller key is checked before any provider I/O;
- exact raw response text is archived before parse or strict decode;
- processing attempts are append-only evidence;
- browser roles receive no relation or RPC access;
- safe response headers are allowlisted and response size is bounded;
- credential-shaped query parameters are rejected;
- no provider path may write official fixtures, results, lock state, points, totals, ranks or standings.

The Edge Function remains undeployed and no provider credential or request is part of contract 94 delivery.

## Development operating model — implemented controls

[ADR 0024](../adr/0024-development-environment-operating-model.md) controls Development operations. Each control below exists in the repository and is guarded by an executable test; none changes a production boundary.

| Control | Implementation | Guard |
| --- | --- | --- |
| Additive Development migrations use the guarded fast lane | `.github/workflows/development-fast-lane-rollout.yml` — dispatch-only, main-only, clean-checkout-only, confirmation phrase, production ref refused by name, secret target verified, pending migrations proven additive and a lightweight snapshot taken before apply. | `tests/scripts/developmentFastLaneRollout.test.ts` |
| A trailing hosted database no longer fails a preview build | `scripts/validate-deployment-contract.mjs` — non-production contexts report the gap and build; production still throws. | `tests/scripts/deploymentContractExpectations.test.ts` |
| Browser journeys are selected from the change | `scripts/select-browser-journeys.mjs` — unmapped, mixed, empty or schema changes widen to the full suite. | `tests/scripts/browserJourneySelection.test.ts` |
| Development data is reseedable | `npm run reset:development` refuses both hosted project refs and any non-local host. | `tests/scripts/seedContract.test.ts` |
| The browser seed states which contract it was reviewed against | `e2e/seed-contract.ts` declares `SEED_REVIEWED_AT_CONTRACT`, identities and requirements in one place. It is reviewed through contract **94**. | `tests/scripts/seedContract.test.ts` |

## Stage C implementation boundary

The original combined design remains in:

- [`../architecture/stage-c-competition-season-schema.md`](../architecture/stage-c-competition-season-schema.md);
- [`../architecture/stage-c-schema-coverage.md`](../architecture/stage-c-schema-coverage.md).

The accepted governance amendment [`../architecture/stage-c1-c2-governance.md`](../architecture/stage-c1-c2-governance.md) controls the split, [`../architecture/stage-c1-contract-classification.md`](../architecture/stage-c1-contract-classification.md) controls the assertion boundary, and [`../architecture/stage-c1-schema-overlay.md`](../architecture/stage-c1-schema-overlay.md) is the C1 implementation authority. C1 may implement competition-season identity, rounds, timezone, locks and same-season safeguards while preserving current auth ownership. C2 owns profile ownership, account erasure, pseudonymisation and related RLS and remains blocked.

No production schema operation is authorised by the contract-94 repository change.

## Open platform gaps

- independent data-protection review and later Stage C2 implementation;
- Development rollout of contracts 92–94 after merge, followed by hosted declaration alignment;
- provider rehearsal, canonical identity mapping and official-data promotion controls;
- player-facing season Predictor, Last Man Standing and Cup surfaces;
- cross-competition hub and weekly action surfaces;
- hosted/concurrent leaderboard performance evidence before a material cap increase;
- notification/client distribution;
- manual accessibility, legal, operations, load and public-launch proof;
- brand selection after Phase 0 discovery and before the closed cohort.

## Documentation authority

- Current facts: this file.
- Parent programme phases and gates: [`../architecture/programme-plan.md`](../architecture/programme-plan.md).
- Child engineering sequence: [`../architecture/multi-competition-hub-build-plan.md`](../architecture/multi-competition-hub-build-plan.md).
- Current position and next executable slice: [`../roadmap.md`](../roadmap.md).
- Stage C split: [`../architecture/stage-c1-c2-governance.md`](../architecture/stage-c1-c2-governance.md).
- Stage C assertion boundary: [`../architecture/stage-c1-contract-classification.md`](../architecture/stage-c1-contract-classification.md).
- Stage C1 implementation authority: [`../architecture/stage-c1-schema-overlay.md`](../architecture/stage-c1-schema-overlay.md).
- Detailed active/parked inventory: [`../../MASTER-TODO.md`](../../MASTER-TODO.md).
- Decisions: [`../adr/README.md`](../adr/README.md).
- Current risks and findings: [`risk-register.md`](risk-register.md).
- Scoring: [`../scoring-rules.md`](../scoring-rules.md).
- State architecture: [`../architecture-and-tournament-states.md`](../architecture-and-tournament-states.md).
- Operations: the relevant `docs/ops/` runbook.
- Dated reconciliations and audits: historical evidence only.
