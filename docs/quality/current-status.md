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
| Current `main` | `2c57898d2eefed943a24bfe342d6da227bdd5267` |
| Stage B integration | PR #226 → `2648540dc001c50305f1effa526fc16e43dcdb26` |
| Control/scoping integration | PR #228 → `ae78a57b5beabd6a415975b24daae28215ed509d` |
| Scoring parity | PR #229 → `5a726c6c2839305182872b0f6cb47ccad9179074` |
| Full Database parity harness | PR #232 → `eba31f34a7d8e9c00282972a82e8c8c043c57047` |
| CSP parity | PR #233 → `7af065f414cb25f72ed49309de45ae5d12141e6b` |
| Environment/privilege contract parity | PR #235 → `2c57898d2eefed943a24bfe342d6da227bdd5267` |
| Recoverable Euro baseline | `euro-2028-baseline` → `1fb8ffd36ad113079181829a8bcc47175c43b6da` |
| Application/database contract at the tag | 63 canonical migrations through `20260729154931_prediction_consensus_minimum_cohort.sql` |
| Current development position | Stage B and the required cross-tournament, environment and parity foundations are complete on `main` |
| Active Stage C work | Draft PR #236, design and coverage manifest only; no migration exists |
| Active reconciliation | Draft PR #230 updates the live authorities and closes the Stage B inventory |
| Production posture | Controlled pre-launch target; no development or simulation write path is permitted |

## Hosted evidence boundary

This reconciliation includes fresh read-only GitHub and Netlify inspection and limited read-only development Supabase catalogue inspection. It does **not** refresh the canonical migration applied-state, target privileges, production data or preservation counts.

The development Supabase inspection was limited to project identity/version and catalogue metadata: public relations, columns, constraints, triggers, RLS policies and function definitions. No application rows or personal data were read, and no database write was performed.

| Target | Current evidence | Fresh check required |
| --- | --- | --- |
| Development Supabase `iouzoutneyjpugbbtdem` | active healthy, Postgres 17; read-only catalogue shows 34 RLS-enabled public tables plus `entry_totals` and the existing same-tournament validator graph | **REQUIRES OWNER VERIFICATION:** run canonical applied-state and privilege queries before relying on contract alignment or applying a migration |
| Production Supabase `vkfnsqdyhvtwyqkisxhk` | owner-verified at contract 63 on 29 July 2026 with preserved-data postflight; not inspected in this reconciliation | **REQUIRES OWNER VERIFICATION:** run read-only applied-state, privilege and preservation checks before any write |
| Production Netlify `main` | ready deploy `6a6b58eb31dbcd0008ad068d` from exact commit `2c57898d2eefed943a24bfe342d6da227bdd5267`, published 30 July 2026; 35 redirects and one header rule processed successfully; no secret-scan matches | rerun exact-origin smoke before a production-risk milestone |
| Production data/recovery | owner-verified preserved counts and same-day encrypted contract-60 backup/restore evidence on 29 July 2026 | **REQUIRES OWNER VERIFICATION:** take a fresh backup/restore proof before a data-risk milestone |

## Executive verdicts

| Area | Verdict |
| --- | --- |
| Euro 2028 baseline | **Tagged and recoverable.** Product work through contract 63 is preserved at `euro-2028-baseline`. |
| Euro 2028 forward work | **Parked.** Remaining tournament data, presentation, rehearsal and release items return in January 2028. |
| Platform direction | **Established by ADRs 0011–0018.** Forward documents and agent framing are aligned to the multi-competition programme. |
| Context engine | **Complete on `main`.** Home, Matches, Match Centre and entry-lock decisions consume the shared competition context, and the legacy `MatchTemporalState` layer is retired. |
| Cross-tournament read safety | **Landed.** `group_teams` reads are scoped through the selected tournament's groups. |
| Automated control coverage | **Landed.** Original scoring, full Database parity execution, CSP/application requirements, `VITE_*` declarations/templates and deployment-RPC/database-privilege relationships have direct contract tests. |
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
6. `MASTER-TODO.md` retains the completed Stage B checklist with the satisfying PRs rather than deleting the history.

### Landed control/parity batches

- **PR #228:** production guard derivation, tournament-scoped `group_teams`, real 404 routing, RPC allowlist enforcement, browser-key validation, reachability and TypeScript/SQL parity.
- **PR #229:** Original Predictor TypeScript/SQL scoring-value parity.
- **PR #232:** Database parity executes the entire `tests/database-parity/` directory and guards against future narrowing.
- **PR #233:** committed CSP requirements are checked against Sentry, Supabase, Turnstile and application resource usage.
- **PR #235:** `VITE_*` reads, declarations and `.env.example` entries are held in step; deployment RPC requirements are related to database privilege evidence; Sentry environment variables are documented without committing credentials.

### Stage C — competition-season schema design

Draft PR #236 contains:

- `docs/architecture/stage-c-competition-season-schema.md`;
- `docs/architecture/stage-c-schema-coverage.md`;
- the architecture index update.

The design is grounded in ADRs, the Stage C build contract and read-only inspection of the current Postgres constraints, triggers, policies and function graph. It proposes one evolved shared model rather than parallel tournament/season tables, composite competition-season safeguards, explicit rounds and monotonic lock events, durable anonymisable competitor identity and preservation/hostile-cross-season test requirements.

No migration exists and no hosted schema operation is authorised. The next decision is review of the design baseline. Only after design approval should pre-migration contract tests be committed and an append-only development migration be created.

## Parked Euro 2028 scope

The complete inventory is in [`../../MASTER-TODO.md`](../../MASTER-TODO.md). It includes official data, final tournament-only slices, administration fit-for-final verification, the full rehearsal, operational recovery and the published-release decision.

## Open platform gaps

- reviewed and implemented competition-season schema;
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
