# Late-read overwrite guard — 24 July 2026

## Finding

`REL-002` remained open because `PredictionsProvider` marked the entry ready after the primary score read, then allowed independent fail-soft tie, bracket and Golden Boot reads to update local state whenever they eventually settled. A response that began before a user edit could therefore replace the newer local choice. The same class of race also existed for the primary prediction slice if an edit occurred while that read was still pending.

## Repository implementation

Issue #62 adds a local-edit generation for each independently loaded slice:

- match predictions and Jokers;
- manual tie resolutions;
- knockout progression;
- Golden Boot.

Each initial read captures its slice generation and may apply either its successful payload or its fail-soft default only when that generation is unchanged. User edits advance only the relevant slice. A slow response therefore becomes inert instead of replacing newer work.

The entry-context effect also clears every prediction slice, save status and optimistic-concurrency baseline before loading a different user/tournament entry. The existing save controller, lock authority, conflict flow, fail-soft optional-data model and explicit `Load latest` / `Keep mine` actions are unchanged.

## Executable regression scope

`tests/app/PredictionsProvider.loading.test.tsx` covers:

1. a local score entered while the primary match read is pending;
2. a newer manual tie order followed by a stale successful read;
3. a newer bracket snapshot followed by a stale successful read;
4. a newer Golden Boot pick followed by a late failed read whose empty default must not clear it.

## Safety boundary

This is client reliability and documentation only. It changes no migration, schema, RLS policy, RPC, scoring value, Supabase project/configuration, Netlify setting, deployment-contract value, production data, Turnstile configuration or legacy World Cup environment.

## Closure boundary

The implementation remains recorded as in progress until the generated head passes the guarded build, lint, full Vitest suite and production dependency audit, then merges to `main`. After merge, update the current status and risk register to mark `REL-002` resolved and close issue #62.

## Validation

GitHub Actions bootstrap run `30128282074` passed `npm ci`, the guarded production build, lint, the complete Vitest suite and `npm audit --omit=dev --audit-level=high` against the exact implementation working tree. This documentation-only follow-up commit triggers the standard pull-request workflows on the resulting final head.
