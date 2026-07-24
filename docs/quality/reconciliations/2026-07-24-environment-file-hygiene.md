# Environment file hygiene reconciliation

**Date:** 24 July 2026  
**Finding:** `REPO-002`  
**Scope:** repository ignore policy only

## Previous gap

The repository ignored `.env`, `.env.local` and `.env.*.local`, but did not ignore common environment variants such as:

- `.env.production`;
- `.env.development`;
- `.env.test`;
- `.env.deploy-preview`.

Those files can contain browser keys, local passwords or other environment-specific values and should never be committed accidentally.

## Implemented policy

`.gitignore` now contains:

```gitignore
.env
.env.*
!.env.example
```

This fails safe for current and future `.env.*` variants while keeping the documented `.env.example` template committable.

## Executable verification

`tests/scripts/envFileHygiene.test.ts` invokes Git's own `check-ignore --no-index` engine. It verifies that:

- `.env` is ignored;
- local, development, production, test and deploy-preview variants are ignored;
- compound variants such as `.env.production.local` are ignored;
- `.env.example` is not ignored.

PR #31 head `a6716136741d12470faaf1ffeb2615530bd54299` passed:

- `npm ci`;
- build with both Netlify prebuild guards;
- lint;
- the full test suite including Git ignore semantics;
- production dependency audit.

Netlify deploy preview `6a631f38f8b53c0008f2919d` reached ready state. Lighthouse reported 97 performance and 100 accessibility, best practices and SEO. The one-point performance variance is unrelated to this repository-only change.

## Verdict

`REPO-002` is resolved. Reopen if `.env.example` becomes ignored, if a sensitive `.env.*` variant becomes committable, or if environment values are committed despite this guard.

## Safety boundary

No environment value, Netlify setting, Supabase project, Auth configuration, database schema, migration history, production data or legacy World Cup environment changed.
