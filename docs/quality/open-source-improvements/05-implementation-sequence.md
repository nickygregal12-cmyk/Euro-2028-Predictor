# Implementation sequence

This sequence is designed to minimise overlap with active product, database and hosted-environment work. Each item should normally be a separate pull request or a deliberately small group of closely related changes.

## Phase 0 — record the policy

### PR 0A: testing conventions and tool ownership

- add the adapted Vitest/Playwright testing convention to the normal developer guidance;
- declare Lucide, `flag-icons` and Framer Motion as the approved generic icon, flag and motion systems;
- identify the existing component preview as the visual state harness;
- add ownership notes for generated flags, visual baselines and new CI reports.

Checks:

```bash
npm run lint
npm test
npm run build
```

## Phase 1 — low-risk repository hygiene

### PR 1A: Knip report-only baseline

- install Knip;
- configure all real entry points;
- add `check:dead-code`;
- commit no broad code deletion in the setup PR;
- attach the initial report and classify findings.

Exit condition: the report is stable and intentional ignores are narrow.

### PR 1B: dependency admission and SBOM

- add Dependency Review Action with minimum permissions;
- add a version-controlled licence policy;
- add `security:sbom` using built-in `npm sbom`;
- verify the action with a temporary setup branch before relying on it.

Exit condition: a known bad dependency change is rejected and a clean SBOM is generated.

### PR 1C: OpenSSF Scorecard advisory workflow

- run manually and weekly;
- upload results without making a numeric score a merge gate;
- open separate fixes for action pinning or permission findings.

Exit condition: high-confidence findings have owners and no workflow behaviour is weakened.

## Phase 2 — interface consistency

### PR 2A: flag correctness and generation

- convert dimensions to 4:3;
- generate the flag subset from authoritative team/venue data;
- add unknown-code fallback and coverage tests;
- add deterministic visual snapshots.

Exit condition: every configured code renders and the bundle remains within budget.

### PR 2B: generic icon consolidation

- create Lucide-backed wrappers behind the current icon interface;
- migrate navigation and status controls first;
- remove only confirmed duplicate custom SVGs;
- keep bespoke Predictor marks.

Exit condition: the first production slice and premium prototype share the same generic icon language.

### PR 2C: shared motion tokens

- extract durations, easing, distances and reduced-motion behaviour;
- apply to modal/sheet, save confirmation and competition switching;
- add reduced-motion tests.

Exit condition: no feature in the migrated slice defines its own competing motion values.

## Phase 3 — stronger correctness testing

### PR 3A: fast-check foundation

- install `fast-check` and `@fast-check/vitest`;
- add shared arbitraries/builders for scores, entrants, teams and competition states;
- create the first scoring, ranking and state invariant suites;
- record counterexample replay guidance.

Exit condition: failures reproduce from a printed seed and at least three critical domains have property coverage.

### PR 3B: MSW request-boundary pilot

- install MSW;
- add shared browser/Node handlers;
- cover successful, delayed, unauthorised, offline and malformed tournament-data scenarios;
- use the same scenarios in one integration test and one local UI mode.

Exit condition: no production bundle starts MSW and unhandled test requests fail closed.

### PR 3C: focused Stryker baseline

- install Stryker core;
- limit mutation targets to a small pure-domain list;
- run advisory only;
- convert meaningful surviving mutants into test improvements.

Exit condition: runtime and signal are documented and a stable baseline exists.

## Phase 4 — runtime and visual quality

### PR 4A: Playwright visual contracts

- add deterministic screenshot coverage to the existing component preview;
- cover mobile, desktop, light, dark and reduced-motion modes;
- publish diff artefacts on failure.

Exit condition: the premium landing page and core prediction/league states have reviewed baselines.

### PR 4B: Lighthouse CI baseline

- install `@lhci/cli`;
- audit a deterministic route set from a production build;
- keep performance metrics advisory while immediately failing severe functional/accessibility regressions;
- record route-specific baselines.

Exit condition: repeated CI runs are stable enough to set initial non-regression budgets.

## Phase 5 — dependency automation

### PR 5A: Renovate configuration

- enable a weekly schedule and dependency dashboard;
- group low-risk patch/minor development updates;
- isolate framework, Supabase, Sentry, Playwright and GitHub Actions updates;
- prohibit major-version auto-merge;
- add minimum release age and bounded PR limits.

Exit condition: the first update batch is reviewable and does not conflict with repository contract files.

## Phase 6 — deadline-load readiness

### PR 6A: local k6 smoke scripts

- add read-burst and authenticated submission scenarios;
- use environment variables for non-production endpoints and users;
- verify correctness and idempotency, not only status codes;
- keep the script incapable of defaulting to production.

### Controlled development run

- begin with 10–20 users;
- increase toward the current public cap only after each run is healthy;
- record p50/p95/p99, errors, rejected locks and duplicate retries;
- open normal implementation work for any bottleneck.

Exit condition: a documented safe non-production capacity exists for a realistic pre-lock arrival pattern.

## Required checks by change type

### Documentation/configuration only

```bash
npm run lint
npm test
npm run build
```

### Frontend or design-system change

```bash
npm run lint
npm test
npm run test:e2e
npm run check:bundle-budget
npm run build
```

Add visual and Lighthouse jobs once their baselines exist.

### Domain correctness change

```bash
npm run lint
npm test
npm run test:coverage:domain
npm run build
```

Add affected property and mutation suites. Database-authoritative changes still require the repository's existing pgTAP/local Supabase and parity gates.

### Workflow or dependency change

- normal CI;
- dependency review;
- workflow permission review;
- action commit-SHA verification;
- SBOM generation when preparing a release milestone.

## Final completion gate

The programme is complete when:

- the approved tools have stable owners and scripts;
- advisory checks have either become reliable gates or have a recorded reason to remain advisory;
- no duplicate UI/testing system has been introduced;
- the new controls are represented in the repository's current developer and quality guidance;
- development and production safety boundaries are unchanged.