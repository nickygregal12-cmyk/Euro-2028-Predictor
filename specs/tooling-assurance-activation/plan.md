# Tooling assurance activation — implementation plan

## Surfaces

1. Documentation-current-state parsers/tests and the stale hosted migration
   prose already merged to `main`.
2. Graphify scripts, workflow summary, pull-request template and focused tests.
3. Python project metadata/lock, AI workflows and Python verification tests.
4. Package manifest, Knip baseline/checker and CI wiring.
5. CodeQL/security/workflow pinning, Storybook accessibility, Lighthouse,
   production smoke, dependency automation and link checking.
6. Playwright cross-browser smoke after the vNext Matches branch no longer
   owns the same Playwright configuration files.

## Test-first sequence

- Add a failing mutation case for contradictory hosted-state prose before
  repairing the merged document.
- Add Graphify wrapper/configuration tests before the wrapper and workflow
  summary change.
- Establish current Knip output as structured baseline evidence before making
  new findings blocking.
- Capture the Python test/coverage baseline before selecting a ratchet floor.
- For each workflow change, extend the existing configuration tests so missing
  pins, commands or trigger coverage fail locally.

## Architecture impact

No new application dependency direction is intended. Run
`scripts/agent-tools/architecture-check.sh` after tooling changes. New Python
development dependencies stay in the AI project, and developer-only JavaScript
packages stay in `devDependencies`.

## Rollout and rollback

- Deliver repository-only batches; no hosted rollout is part of this work.
- Keep optional/report-only controls non-blocking until a measured baseline is
  committed.
- Promote only “no new regression” gates first. A rollback is the revert of the
  relevant repository commit; application/database state is unaffected.

## Risks to falsify

- The uv lock must work on CI's Python version and include all workflow extras.
- Graphify snapshot download must work for GitHub-first agents without assuming
  a globally installed CLI.
- Storybook accessibility integration must match the installed Storybook major.
- Source-map configuration must not make ordinary builds require Sentry secrets.
- Path-scoped workflows must not become impossible required checks; the main CI
  aggregate must always report a conclusion.
- PR #855 merged as `caa47ae`; the branch was rebased onto that state before
  adding the bounded Firefox/WebKit projects.

## Completion record — 18 August 2026

Repository-complete work:

- semantic hosted-state regression checks and corrected contract-198 prose;
- Graphify fetch/freshness/query wrapper plus pull-request usage evidence;
- committed Python 3.12 `uv.lock`, locked workflow sync, Ruff, pip-audit,
  branch coverage, Hypothesis and CodeQL Python;
- Knip no-growth baseline, Lenis removal and declared test dependency repair;
- blocking architecture aggregate, three-run Lighthouse gate, Storybook a11y,
  bounded Firefox/WebKit smoke and scheduled anonymous production smoke;
- trusted-build-only Sentry source-map upload, offline internal/anchor Lychee
  checking, expanded mutation testing and a 90% measured Stryker floor;
- duplicate workflow removal, selected Harden Runner expansion and a zero-
  baseline full-SHA policy across all external GitHub Actions.

External activation still required:

- require the always-present `CI / Required merge gate` in the GitHub ruleset
  after this workflow has passed on the merged configuration;
- install/activate the Renovate GitHub App and retain Dependabot until a real
  Renovate PR proves the integration;
- configure build-only `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` and
  `SENTRY_SOURCEMAPS_ENABLED=true` only in the trusted production build.

Deliberate non-additions remain the conditional/conflicting tools named in the
specification: no second test runner, browser runner, SAST, secret scanner,
visual baseline, load tool, SBOM or API fuzzer was introduced.
