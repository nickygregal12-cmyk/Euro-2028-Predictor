# Audit-control cleanup

**Date:** 24 July 2026  
**Issue:** #46  
**Branch:** `agent/repair-audit-controls`  
**Findings:** `TEST-002`, `TEST-003`, `DOC-001`, `DOC-006`  
**Status:** Repository implementation prepared; pull-request validation pending

## Scope

This repository-only batch:

- records the post-merge closure boundary for the repaired database-parity trigger;
- makes the environment-file hygiene suite skip explicitly when no Git work tree exists while retaining real ignore-policy enforcement in normal checkouts;
- repairs stale entry-flow test-script references to the current integrity-gated project sequence;
- repairs relative links in archived quality evidence after those files moved into `docs/quality/history/`;
- adds permanent Markdown-link and obsolete-reference regression coverage;
- adds a CI execution from `git archive` to prove Git-less checkouts skip rather than fail;
- updates the live quality status and risk register after validation.

It does not change migrations, hosted Supabase data or configuration, Netlify configuration, deployment-contract values, application behaviour, tournament rules or scoring.

## Implementation evidence

- PR #45 merged as `d9bba09543409067624223f6f3fc0a0c75152cc2`; its latest head passed CI run 188 and Database parity run 65 before merge.
- `.github/workflows/database-parity.yml` watches `scripts/database-rollout/**`, `config/deployment-contract.json` and its regression test.
- `tests/scripts/envFileHygiene.test.ts` detects whether Git work-tree semantics are available and names the skipped suite explicitly.
- `.github/workflows/ci.yml` runs the environment-file test from a `git archive` extraction with no `.git` directory.
- `docs/test-script.md` now uses current environment safety boundaries and finding IDs instead of superseded phase/batch names.
- both archived quality files now resolve moved links through `../audits/` and `../risk-register.md` without altering their finding/baseline contents.
- `tests/scripts/markdownDocumentation.test.ts` checks relative inline Markdown links repository-wide and prevents the obsolete entry-test terms from returning.

## Validation required before closure

1. application CI passes on the pull request;
2. the normal Git-checkout environment-file hygiene tests pass;
3. the Git-less CI step reports an explicit skipped suite rather than eight failures;
4. repository Markdown link validation reports no broken links;
5. the database-parity workflow trigger regression test remains green;
6. after merge, confirm the exact `main` tree and close issue #46 plus any finding whose full closure evidence is then satisfied.

Until those checks pass, `TEST-003`, `DOC-001` and `DOC-006` remain in progress. `TEST-002` is repository-resolved by merged PR #45, subject to the live register update in this batch.
