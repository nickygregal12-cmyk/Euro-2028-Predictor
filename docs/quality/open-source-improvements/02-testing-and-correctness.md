# Testing and correctness improvements

## 1. Property-based testing with fast-check

Use `fast-check` with the dedicated `@fast-check/vitest` connector. This is the highest-value new test dependency because the Predictor contains many combinatorial rules that are difficult to cover with hand-picked examples alone.

### Install

```bash
npm install --save-dev fast-check @fast-check/vitest
```

### First target properties

#### Scoring

- points are never negative;
- an exact score never earns fewer points than the corresponding correct result under the same rule set;
- joker multiplication applies exactly once;
- recomputing the same completed result is idempotent;
- two identical entries always receive identical scoring output.

#### Rankings and tiebreaks

- output contains every input entry exactly once;
- rank order is deterministic for equal inputs;
- adding an unrelated lower-scoring entry cannot change the order between two existing higher-scoring entries;
- all declared tiebreak levels terminate;
- shared-rank and ordinal-rank modes do not create impossible gaps.

#### Tournament and bonus-game state

- every accepted entrant count produces a valid competition shape or an explicit refusal;
- no entrant appears in two groups or knockout slots at the same time;
- advancement never creates or drops an entrant silently;
- restart and settlement functions are idempotent when repeated against the same state;
- lock boundaries reject writes at and after the authoritative deadline while reads remain valid.

#### Provider decoders

- malformed optional fields do not become trusted domain values;
- unknown enum values are rejected or mapped only through an explicit fallback;
- decoder output remains stable when unrelated provider fields are added;
- archived raw input and decoded identity remain traceable.

### Configuration

- use deterministic seeds in CI and print the failing seed/path;
- keep the generated run count modest on every PR;
- run a larger scheduled sweep overnight or weekly;
- preserve minimal counterexamples as explicit regression tests after fixing a failure;
- do not use uncontrolled random fixture generation outside property tests.

### Acceptance criteria

- at least one property suite exists for scoring, rankings and competition-state invariants;
- failures reproduce from the emitted seed;
- the normal PR suite remains fast enough for routine use;
- generated cases never call hosted services.

## 2. Focused mutation testing with StrykerJS

Mutation testing checks whether tests fail when production logic is deliberately changed. Use it only on critical pure-domain modules; a repository-wide run would be too slow and noisy.

### Initial scope

- group-match scoring;
- knockout scoring and method bonuses;
- ranking and tiebreak functions;
- entry-lock calculations;
- Last Man Standing elimination/settlement calculations;
- restart and competition-shape helpers that can run without a hosted database.

### Initial setup

```bash
npm install --save-dev @stryker-mutator/core
```

Use Stryker's command runner initially with an explicit, narrow `mutate` list and matching Vitest command. Keep concurrency bounded. Do not mutate React components, generated files, migrations or broad service layers in the first rollout.

### Rollout policy

1. Run locally or in a scheduled advisory workflow.
2. Record surviving mutants and fix meaningful assertion gaps.
3. Establish a baseline for the narrow domain set.
4. Only then add a non-regression threshold.
5. Do not make mutation testing a required PR check until runtime and stability are acceptable.

### Acceptance criteria

- reports are limited to the named critical modules;
- surviving mutants produce actionable work rather than blanket exclusions;
- the job cannot access production or hosted credentials;
- a stable baseline is documented before any blocking threshold is introduced.

## 3. Network-level test scenarios with Mock Service Worker

The current test suite often mocks service modules directly. Keep those small unit tests, but add MSW where confidence depends on the real request path, response parsing and loading/error behaviour.

### Install

```bash
npm install --save-dev msw
```

### Implement

Create a shared structure such as:

```text
src/mocks/
  browser.ts
  server.ts
  handlers/
  scenarios/
```

Use handlers for development and test-only endpoints. Scenarios should cover:

- successful tournament bootstrap;
- empty competition data;
- delayed responses and loading persistence;
- offline/network failure;
- expired or unauthorised session;
- stale foreground refresh;
- provider or Edge Function partial failure;
- rate limiting;
- malformed response rejected by the client boundary.

### Boundaries

- MSW must never intercept requests in a production build;
- unhandled requests should fail tests by default, with explicit passthrough only for known local assets;
- do not place service-role keys, provider credentials or real personal data in handlers;
- keep database-authoritative behaviour in pgTAP/local Supabase tests rather than pretending it is proven by a browser mock;
- reuse fixture builders where possible instead of maintaining a second inconsistent domain model.

### Acceptance criteria

- at least one provider-level integration test exercises the actual client request boundary;
- local UI scenarios can reproduce loading, unavailable and unauthorised states without hosted data;
- browser and Node handlers share scenario definitions;
- no production bundle contains the mock worker boot path.