# Node runtime pinning reconciliation

**Date:** 24 July 2026  
**Finding:** `OPS-004`  
**Pull request:** #30

## Verdict

The application build runtime is now pinned to Node `22.22.2` across every supported build surface:

- local NVM through `.nvmrc`;
- package metadata through `package.json` `engines.node`;
- GitHub Actions through `.github/workflows/ci.yml`;
- Netlify through `netlify.toml` `build.environment.NODE_VERSION`.

A regression test fails when any declaration diverges. This resolves the previously open Netlify runtime-pin portion of `OPS-004`.

## Implementation

`tests/scripts/nodeRuntimePin.test.ts` reads the repository files directly and requires all four declarations to equal `22.22.2`.

The test deliberately covers configuration rather than the current process version so it remains deterministic in ordinary local and CI execution.

## Executable evidence

PR #30 head `8da69c167adcecc9af3e4530f122d23dc3a1e842` passed:

- `npm ci`;
- build with the Netlify environment and application/database contract guards;
- lint;
- the full Vitest suite, including runtime alignment;
- `npm audit --omit=dev --audit-level=high`.

Netlify deploy preview `6a631a83faa871000839f18a` reached ready state on that head after reading the version-controlled `NODE_VERSION = "22.22.2"` setting.

The package engine declaration did not require a package-lock rewrite; `npm ci` passed with the existing lockfile.

## Operational rule

Changing the supported Node version requires one reviewed change that updates:

1. `.nvmrc`;
2. `package.json`;
3. `.github/workflows/ci.yml`;
4. `netlify.toml`.

The runtime-alignment test must remain enabled. Do not override the Netlify version in the dashboard without making the same version-controlled change.

## Safety boundary

- No application feature or scoring rule changed.
- No Supabase project, schema, data, Auth setting or migration history changed.
- No Turnstile configuration changed.
- No legacy World Cup environment changed.
- Production continues to declare database contract 20, so this PR cannot replace the current ready production deploy while the repository requires contract 35.