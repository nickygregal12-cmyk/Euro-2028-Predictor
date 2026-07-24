# Audit-control cleanup

**Date:** 24 July 2026  
**Branch:** `agent/repair-audit-controls`  
**Findings:** `TEST-002`, `TEST-003`, `DOC-001`, `DOC-006`

## Scope

This repository-only batch:

- records the post-merge closure boundary for the repaired database-parity trigger;
- makes the environment-file hygiene suite skip explicitly when no Git work tree exists while retaining real ignore-policy enforcement in normal checkouts;
- repairs stale entry-flow test-script references to the current integrity-gated project sequence;
- repairs relative links in archived quality evidence after those files moved into `docs/quality/history/`;
- updates the live quality status and risk register after validation.

It does not change migrations, hosted Supabase data or configuration, Netlify configuration, deployment-contract values, application behaviour, tournament rules or scoring.

## Validation required

- application CI passes;
- the environment-file hygiene tests still pass in a normal Git checkout;
- a Git-less execution reports an explicit skip rather than eight false failures;
- repository Markdown link validation reports no broken archived links;
- the database-parity workflow trigger remains protected by its regression test;
- `TEST-002`, `TEST-003`, `DOC-001` and `DOC-006` are updated only to the status supported by the final evidence.
