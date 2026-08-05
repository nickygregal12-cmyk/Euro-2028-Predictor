# Performance and launch-readiness improvements

## 1. Runtime budgets with Lighthouse CI

The existing bundle-budget script protects emitted asset size, but it does not measure runtime loading, rendering, accessibility, best practices or SEO. Add Lighthouse CI as a separate browser-level gate.

### Install

```bash
npm install --save-dev @lhci/cli
```

### Initial routes

Audit deterministic public or fixture-backed routes first:

- signed-out landing page;
- sign-in and sign-up;
- signed-in home using controlled development data;
- predictions list;
- league table;
- match centre;
- component preview route used for the premium redesign.

### Initial configuration

- run against a locally built and served application;
- collect at least three runs per route and use the median;
- use a fixed desktop profile and a fixed mobile profile;
- fail immediately on broken navigation, inaccessible names, invalid document structure and severe best-practice regressions;
- begin performance thresholds as warnings until a stable baseline is captured;
- keep raw Lighthouse output as a CI artefact, not committed source.

### Suggested baseline policy

Start with route-specific budgets rather than one universal score. Record and then tighten:

- Largest Contentful Paint;
- Cumulative Layout Shift;
- Total Blocking Time;
- accessibility score;
- best-practices score;
- transfer size for JavaScript, CSS and images;
- number of third-party requests.

### Acceptance criteria

- audits run from a clean production build;
- signed-in routes use deterministic non-production fixtures;
- no Lighthouse job requires production credentials;
- performance regressions produce route-specific evidence;
- the existing bundle-budget check remains in place.

## 2. Visual regression with existing Playwright tooling

Use Playwright's screenshot assertions rather than another external visual-testing service.

### Initial matrix

- mobile narrow viewport;
- representative modern phone viewport;
- tablet/desktop viewport;
- light and dark themes;
- reduced-motion mode.

### Initial screens

- premium signed-in landing page;
- fixture/prediction card states;
- league table and rank movement;
- knockout bracket or round switcher;
- modal, choice sheet and toast;
- loading, empty, unavailable, error and locked states;
- long-name and high-number hostile states from the component preview.

### Determinism requirements

- freeze time;
- disable carets, timers and non-essential animation;
- use local fonts already shipped by the app;
- use stable fixture data;
- mask only truly non-deterministic values;
- avoid giant full-page baselines when smaller component-region snapshots are clearer.

### Acceptance criteria

- CI uploads expected/actual/diff images for failures;
- baseline updates require deliberate review;
- visual tests remain separate from scoring or database authority;
- the suite detects both mobile overflow and theme regressions.

## 3. Deadline-burst load testing with Grafana k6

Predictor traffic is naturally bursty: users are most likely to read fixtures and submit predictions shortly before a lock. Add k6 scenarios before broader recruitment or public tournament launches.

### Test only safe environments

- run against a dedicated development or staging environment;
- use synthetic users created for the test;
- never run load tests against production without explicit owner approval;
- never embed credentials in the script or repository;
- use environment variables or short-lived test credentials;
- clean up generated test data through an approved non-production path.

### First scenarios

#### Read burst

- fetch application shell and tournament data;
- load fixtures, league snapshot and match centre;
- verify response status and latency thresholds;
- confirm cached/public reads do not create unexpected database load.

#### Submission burst

- authenticated users load their current predictions;
- users change and submit a small prediction set;
- responses are accepted before the deadline;
- duplicate retries remain idempotent;
- writes at/after the authoritative lock are rejected consistently;
- rate limiting returns the intended response rather than a generic failure.

#### Recovery

- repeat a safe request after a short simulated provider/database disruption;
- verify the UI-facing endpoint recovers without duplicate submissions;
- confirm error rates return to baseline.

### Thresholds to record

- p50, p95 and p99 latency;
- error rate by endpoint;
- successful submission count;
- duplicate/idempotent retry behaviour;
- rate-limit response count;
- database or Edge Function saturation indicators available in the non-production environment.

### Rollout

1. Create a small local smoke scenario.
2. Run a 10–20 synthetic-user development test.
3. Increase gradually toward the current public cap and a realistic lock-time arrival pattern.
4. Record the safe capacity and bottleneck.
5. Re-run after material submission, auth, provider-ingestion or database changes.

### Acceptance criteria

- scripts are read/write scoped to non-production;
- thresholds fail on elevated errors or unacceptable latency;
- submissions are verified for correctness, not merely HTTP 2xx;
- the test can be stopped without leaving an uncontrolled recurring workload.