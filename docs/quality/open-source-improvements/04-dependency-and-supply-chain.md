# Dependency and supply-chain improvements

## 1. Dead-code and dependency analysis with Knip

The project now contains multiple application surfaces, scripts, workflows, domain modules and historical transitions. Add Knip to find code that normal linting and TypeScript checks do not identify.

### Install

```bash
npm install --save-dev knip
```

### Implement

- add `knip.json` or `knip.config.ts` with explicit Vite, Vitest, Playwright and script entry points;
- include application, Edge Function and repository-script workspaces only where Knip can understand their module boundaries;
- exclude generated Supabase types, migration evidence, build output and immutable historical artefacts;
- add `npm run check:dead-code`;
- run report-only until genuine entry points and intentional public exports are configured;
- remove confirmed unused dependencies and files in small dedicated PRs rather than one large deletion.

### Acceptance criteria

- the configuration has no blanket ignore for `src` or `tests`;
- each ignored export/file has a documented reason;
- the stable report becomes part of CI;
- dependency removals pass the full build, test and bundle checks.

## 2. Controlled dependency updates with Renovate

Use Renovate for update discovery and PR creation. It should reduce manual checking without creating a constant stream of unreviewable PRs.

### Configuration policy

- create a dependency dashboard issue;
- schedule updates weekly, not continuously;
- group patch/minor development dependencies where risk is low;
- keep React, Vite, TypeScript, Supabase, Sentry, Playwright and database tooling in separate review groups;
- never auto-merge major versions;
- only auto-merge low-risk patch updates after the existing CI suite is proven to cover them;
- apply a minimum release age before routine updates where supported;
- preserve exact pins where the repository intentionally uses them;
- include GitHub Actions updates but review and repin them to full commit SHAs;
- do not allow Renovate to rewrite migration files, hosted contract records or generated audit evidence.

### Acceptance criteria

- update PR volume is bounded;
- each PR explains the changed dependency and release risk;
- lockfile changes remain reproducible;
- major framework updates require a normal implementation plan and manual review;
- Renovate is automation only and is not linked into the shipped application.

## 3. PR dependency admission with Dependency Review Action

The repository is public, so GitHub's open-source Dependency Review Action can inspect dependency changes introduced by pull requests.

### Implement

Create a dedicated workflow triggered by `pull_request` and configure it to:

- fail on newly introduced high or critical vulnerabilities;
- fail on explicitly disallowed licences;
- summarise added, removed and changed dependencies;
- comment or report clearly enough that the dependency can be traced to the package/lockfile change;
- run with minimum required permissions;
- pin the action to a reviewed full commit SHA.

Start with a documented licence allow-list suitable for the project. Treat non-standard licences as manual-review cases rather than silently accepting them.

### Acceptance criteria

- a deliberately vulnerable test branch is rejected during setup verification;
- normal source-only PRs do not produce noise;
- the workflow cannot write repository contents;
- the licence policy is documented and version-controlled.

## 4. Workflow and repository review with OpenSSF Scorecard

The project has a growing number of GitHub Actions workflows and custom actions. Run OpenSSF Scorecard as an advisory scheduled workflow first.

### Focus areas

- actions pinned to mutable tags instead of full SHAs;
- excessive workflow permissions;
- token exposure risks;
- branch protection and review practices;
- dependency update and vulnerability response practices;
- dangerous workflow triggers involving untrusted pull-request code;
- release and provenance controls where applicable.

### Rollout

1. Run Scorecard manually or weekly and save the report as an artefact/security result.
2. Triage findings against the repository's actual threat model.
3. Fix high-confidence workflow permission and pinning findings.
4. Add narrowly scoped repository guards for practices that must remain true.
5. Keep the score itself advisory; enforce the concrete controls, not an arbitrary target number.

### Acceptance criteria

- no workflow gains permissions merely to satisfy the tool;
- high-risk findings have a recorded disposition;
- action pinning and permission fixes preserve existing deployment and backup behaviour;
- untrusted PR code cannot access hosted secrets.

## 5. Generate a CycloneDX SBOM with npm

Node/npm already provides SBOM generation, so use the built-in command rather than adding another package.

### Implement

```bash
npm sbom --sbom-format=cyclonedx > sbom.cdx.json
```

- add a script such as `npm run security:sbom`;
- generate from a clean, locked install;
- validate that direct and transitive production dependencies are represented;
- publish the SBOM as a release or CI artefact when preparing a deployment milestone;
- do not commit a constantly changing SBOM to the main source tree unless the project deliberately adopts that policy;
- never treat the SBOM as a vulnerability scanner by itself.

### Acceptance criteria

- generation succeeds on the pinned Node/npm environment;
- the artefact contains the application name/version and dependency graph;
- release documentation states where the corresponding SBOM is stored;
- dependency review and vulnerability scanning remain separate controls.