# Current quality status

> The only live implementation and hosted-status authority. Current code, migrations, executable tests and freshly verified hosted evidence override older audits, reconciliations, TODOs and chat narratives.

**Status date:** 30 July 2026

## Product position

The repository is a multi-competition prediction platform in transition. The completed Euro 2028 tournament product is the first recoverable competition baseline, not the endpoint of the forward programme.

- the annotated `euro-2028-baseline` tag resolves to `1fb8ffd36ad113079181829a8bcc47175c43b6da`;
- the remaining Euro 2028 scope is parked in [`../../MASTER-TODO.md`](../../MASTER-TODO.md);
- the scheduled return date is **January 2028**;
- product phases and gates are in [`../architecture/programme-plan.md`](../architecture/programme-plan.md);
- engineering sequencing is in [`../architecture/multi-competition-hub-build-plan.md`](../architecture/multi-competition-hub-build-plan.md);
- the thin current-position roadmap is [`../roadmap.md`](../roadmap.md);
- platform decisions are governed by [`../adr/0011-multi-competition-platform.md`](../adr/0011-multi-competition-platform.md) through [`../adr/0018-pre-launch-promotion-cadence.md`](../adr/0018-pre-launch-promotion-cadence.md).

## Repository baseline

| Field | Current value |
| --- | --- |
| Repository | `nickygregal12-cmyk/Euro-2028-Predictor` |
| Current `main` | `873567912a459130ae0690f4ccecba5a27b7f37f` |
| Stage B integration | PR #226 → `2648540dc001c50305f1effa526fc16e43dcdb26` |
| Control/scoping integration | PR #228 → `ae78a57b5beabd6a415975b24daae28215ed509d` |
| Scoring parity | PR #229 → `5a726c6c2839305182872b0f6cb47ccad9179074` |
| Full Database parity harness | PR #232 → `eba31f34a7d8e9c00282972a82e8c8c043c57047` |
| CSP parity | PR #233 → `7af065f414cb25f72ed49309de45ae5d12141e6b` |
| Environment/privilege contract parity | PR #235 → `2c57898d2eefed943a24bfe342d6da227bdd5267` |
| Stage B inventory closure | PR #239 → `69f6e364132f6586d5de9ed8706b0802d14ec0fc` |
| Timezone-authority characterisation | PR #245 → `4d553a8084ebf258bf527d3c7799da77ff5433c8` |
| Account-deletion characterisation | PR #246 → `972febd017dbecf0ef3b02b16b55c07c74535038` |
| RLS/search-path guard | PR #250 → `183544b7b29a5360b1c0a04a2c7007e821cbce97` |
| Competition/viewer timezone seam | PR #252 → `1ec505a7d423c8d0b2b03327f8893e3954fa2246` |
| Test-suite typecheck | PR #255 → `cadc7c37e4e5e253e60e2ea31f8f52341d789891` |
| E2E/tools typecheck | PR #258 → `873567912a459130ae0690f4ccecba5a27b7f37f` |
| Recoverable Euro baseline | `euro-2028-baseline` → `1fb8ffd36ad113079181829a8bcc47175c43b6da` |
| Application/database contract at the tag | 63 canonical migrations through `20260729154931_prediction_consensus_minimum_cohort.sql` |
| Current development position | Stage B and the required cross-tournament, environment, parity, security and broad TypeScript controls are complete on `main`; the timezone seam is landed but the persisted season value is absent |
| Active Stage C work | Draft PR #236, design and coverage manifest only; no migration exists |
| Parallel hardening | PR #261, fully green compiler-project coverage/explicit-strict guard; open and unmerged |
| Production posture | Controlled pre-launch target; no development or simulation write path is permitted |

## Hosted evidence boundary

This reconciliation includes fresh read-only GitHub and Netlify inspection and limited read-only development Supabase catalogue inspection. It does **not** refresh the canonical migration applied-state, target privileges, production data or preservation counts.

The development Supabase inspection was limited to project identity/version and catalogue metadata: public relations, columns, constraints, triggers, RLS policies and function definitions. No application rows or personal data were read, and no database write was performed.

| Target | Current evidence | Fresh check required |
| --- | --- | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | active healthy, Postgres 17; read-only catalogue shows 34 RLS-enabled public tables plus `entry_totals` and the existing same-tournament validator graph | **REQUIRES OWNER VERIFICATION:** run canonical applied-state and privilege queries before relying on contract alignment or applying a migration |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | owner-verified at contract 63 on 29 July 2026 with preserved-data postflight; not inspected in this reconciliation | **REQUIRES OWNER VERIFICATION:** run read-only applied-state, privilege and preservation checks before any write |
| Production Netlify `main` | ready deploy `6a6b776513962b00087ba68e` from exact commit `873567912a459130ae0690f4ccecba5a27b7f37f`, published 30 July 2026; 35 redirects and one header rule processed successfully; no secret-scan matches | rerun exact-origin smoke before a production-risk milestone |
| Production data/recovery | owner-verified preserved counts and same-day encrypted contract-60 backup/restore evidence on 29 July 2026 | **REQUIRES OWNER VERIFICATION:** take a fresh backup/restore proof before a data-risk milestone |

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Euro 2028 baseline | **Tagged and recoverable.** Product work through contract 63 is preserved at `euro-2028-baseline`. |
| Euro 2028 forward work | **Parked.** Remaining tournament data, presentation, rehearsal and release items return in January 2028. |
| Platform direction | **Established by ADRs 0011–0018.** Forward documents and agent framing are aligned to the multi-competition programme. |
| Context engine | **Complete on `main`.** Home, Matches, Match Centre and entry-lock decisions consume the shared competition context, and the legacy `MatchTemporalState` layer is retired. |
| Stage B exit | **Met and recorded.** PR #226 merged the complete surface sequence, and PR #239 closed the retained Stage B checklist with the satisfying PRs. |
| Cross-tournament read safety | **Landed.** `group_teams` reads are scoped through the selected tournament's groups. |
| Database API hardening | **Guarded in ordinary CI.** PR #250 proves every current public table has RLS enabled and every current security-definer function pins `search_path`; disposable database lint remains additional evidence. |
| Automated control coverage | **Landed.** Original scoring, full Database parity execution, CSP/application requirements, `VITE_*` declarations/templates, deployment-RPC/database-privilege relationships, timezone authority, account-deletion actions, public-table RLS and definer `search_path` have direct tests. |
| Timezone authority | **Seam landed, season value absent.** PR #252 separates `competitionTimeZone` from `viewerTimeZone`, but every adapter deliberately falls back to the viewer until Stage C supplies `tournaments.display_timezone`; viewer-dependent authoritative grouping therefore remains. |
| Timezone positive-control quality | **Corrected.** PR #255 replaces the vacuous nonexistent `activeLock` comparison with real `lockScopes` and corrects a fixture using `viewerTimeZone` where the config requires `competitionTimeZone`. |
| Account deletion | **Current behaviour is unsafe and fully characterised.** Competitive rows still reference `auth.users` through mixed cascade, restrict, set-null and one undeclared/no-action path. Account deletion can erase settled history or be blocked; PR #246 pins the effective matrix but does not fix it. |
| TypeScript static coverage | **Broad but not yet exhaustive.** PRs #255 and #258 strict-check application code, `tests/`, Playwright/e2e fixtures, TypeScript scripts and Playwright configs. `production-smoke/anonymous.spec.ts` is still outside a compiler project; fully green PR #261 covers it, states `strict` explicitly and adds a future-directory coverage guard. |
| Stage C | **Design active; implementation not started.** Draft PR #236 defines the schema direction and complete current-object coverage manifest without adding SQL. |
| Contract alignment | **Repository contract remains 63; hosted applied-state was not freshly verified.** |
| Public launch readiness | **Not ready.** Domestic-season implementation, ingestion, operations, accessibility and legal/client gates remain. |
| Production mutation | **Prohibited without explicit owner approval and the full milestone process.** |

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
- automated desktop/phone accessibility checks and targeted overflow tests;
- deployment-contract, migration timestamp, CI, full Database parity, Browser E2E and exact-release controls.

These capabilities are evidence for the first competition. They do not imply that season rules, season scoping or multi-competition surfaces already exist.

## Active work

### Stage A — authority and control alignment

The ADR stack, planning hierarchy, domain-path controls and current implementation authorities are established. Brand-clearance work remains governed by ADR 0017 and must not be inferred complete from engineering progress.

### Stage B — competition-context foundation and surface migration

Stage B is complete on `main`:

1. pure competition kinds, lock resolver, context resolver and match-state resolver merged through PR #212;
2. Home migration merged through PR #219;
3. Matches, Match Centre, entry-lock migration and `MatchTemporalState` retirement integrated through PR #226;
4. PR #226 passed build/typecheck, lint, full Vitest, dependency audit, Database parity, exact preview smoke, authenticated journeys, signup and recovery;
5. superseded PRs #216, #221, #222, #223, #224 and #225 were closed with links to the merged integration;
6. PR #239 closed the retained Stage B inventory with the satisfying PR for each item.

### Landed control/parity and Stage C foundation batches

- **PR #228:** production guard derivation, tournament-scoped `group_teams`, real 404 routing, RPC allowlist enforcement, browser-key validation, reachability and TypeScript/SQL parity.
- **PR #229:** Original Predictor TypeScript/SQL scoring-value parity.
- **PR #232:** Database parity executes the entire `tests/database-parity/` directory and guards against future narrowing.
- **PR #233:** committed CSP requirements are checked against Sentry, Supabase, Turnstile and application resource usage.
- **PR #235:** `VITE_*` reads, declarations and `.env.example` entries are held in step; deployment RPC requirements are related to database privilege evidence; Sentry environment variables are documented without committing credentials.
- **PR #245:** timezone-authority coverage pins timezone-free resolver source, the four device-timezone readers, current grouping divergence and invalid-zone fail-quiet behaviour; PR #255 corrects its false-positive lock assertion.
- **PR #246:** account-deletion tests resolve effective `auth.users` foreign-key actions in migration order, pin the cascade/restrict/set-null/undeclared matrix, and prove that no table currently references `profiles`.
- **PR #250:** ordinary CI proves all 34 public tables have RLS enabled and all 110 current security-definer functions pin `search_path`, using latest-definition and schema-aware parsing.
- **PR #252:** application adapters and domain config distinguish `competitionTimeZone` from `viewerTimeZone`; fallback keeps existing behaviour until the persisted season timezone exists.
- **PR #255:** ordinary build strict-checks TypeScript tests, and the known false-positive timezone fixtures are corrected.
- **PR #258:** the build also covers Playwright/e2e fixtures, TypeScript scripts and Playwright configs; the H2H local fixture retains its nullable cleanup handles while using a non-null resolved tournament id after setup.

PRs #245 and #246 are **before-state controls**. PR #252 is the application seam. PRs #255 and #258 make the relevant TypeScript evidence enforceable. None supplies the Stage C schema or completes the timezone/deletion design.

### Parallel TypeScript project guard — PR #261

PR #261 is open, mergeable and fully green. It:

- adds `production-smoke/anonymous.spec.ts` to the tools TypeScript project;
- states `strict: true` explicitly in the two base TypeScript projects rather than relying on the TypeScript 6 default;
- adds a Git-aware test proving every committed `.ts`/`.tsx` file belongs to a referenced compiler project;
- proves derived projects still extend the strict base;
- contains no migration, hosted change, scoring change or expectation change.

It may integrate independently and does not block Stage C design approval. Until it lands, compiler-project coverage must not be described as exhaustive.

### Stage C — competition-season schema design

Draft PR #236 contains:

- `docs/architecture/stage-c-competition-season-schema.md`;
- `docs/architecture/stage-c-schema-coverage.md`;
- the architecture index update.

The design is grounded in ADRs, the Stage C build contract, read-only inspection of the current Postgres constraints, triggers, policies and function graph, and the landed PR #245/#246/#250/#252/#255/#258 foundations. It proposes one evolved shared model rather than parallel tournament/season tables, composite competition-season safeguards, explicit rounds and monotonic lock events, `profiles` as the durable pseudonymisable competitive anchor, a persisted competition timezone wired through the landed seam and preservation/hostile-cross-season test requirements.

No migration exists and no hosted schema operation is authorised. The next decision is review of the design baseline. After design approval, remaining pre-migration contracts may be committed before an append-only development migration is created.

## Parked Euro 2028 scope

The complete inventory is in [`../../MASTER-TODO.md`](../../MASTER-TODO.md). It includes official data, final tournament-only slices, administration fit-for-final verification, the full rehearsal, operational recovery and the published-release decision.

## Open platform gaps

- reviewed and implemented competition-season schema;
- exhaustive TypeScript project coverage guard if PR #261 remains unmerged;
- fixture/result ingestion and provider evidence;
- season Predictor, Last Man Standing and Cup implementations;
- cross-competition hub and weekly action surfaces;
- notification/client distribution;
- manual accessibility, legal, operations, load and public-launch proof;
- brand clearance and close-season product decision.

## Documentation authority

- Current facts: this file.
- Parent programme phases and gates: [`../architecture/programme-plan.md`](../architecture/programme-plan.md).
- Child engineering sequence: [`../architecture/multi-competition-hub-build-plan.md`](../architecture/multi-competition-hub-build-plan.md).
- Current position and next executable slice: [`../roadmap.md`](../roadmap.md).
- Detailed active/parked inventory: [`../../MASTER-TODO.md`](../../MASTER-TODO.md).
- Decisions: [`../adr/README.md`](../adr/README.md).
- Current risks and findings: [`risk-register.md`](risk-register.md).
- Scoring: [`../scoring-rules.md`](../scoring-rules.md).
- State architecture: [`../architecture-and-tournament-states.md`](../architecture-and-tournament-states.md).
- Operations: the relevant `docs/ops/` runbook.
- Dated reconciliations and audits: historical evidence only.