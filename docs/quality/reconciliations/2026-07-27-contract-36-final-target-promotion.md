# Contract 36 final-target promotion — 27 July 2026

## Scope

This record reconciles the controlled final-target Supabase project and the production Netlify contract declaration after explicit owner approval to proceed without completing a fresh backup and restore rehearsal first.

## Final-target Supabase

Project: `vkfnsqdyhvtwyqkisxhk`

Promotion result:

- migration `20260725010000_authoritative_reference_integrity.sql` applied successfully;
- canonical migration history count verified as 36;
- latest canonical version/name verified as `20260725010000` / `authoritative_reference_integrity`;
- six private `predictor_internal` validation functions verified as security-definer with fixed empty search paths;
- six validation triggers verified installed and enabled;
- browser-role execution count verified as zero;
- post-change authoritative-reference integrity checks remained clean.

The connected migration action initially recorded a generated execution timestamp. Migration metadata was reconciled to the repository’s canonical version `20260725010000` only after the schema objects and migration identity were verified.

## Netlify production declaration

Site: `euro28predictor`

- `EURO28_DEPLOYED_DB_CONTRACT` production context changed from 35 to 36;
- `dev`, `branch-deploy` and `deploy-preview` remained at 36;
- Supabase URL/key environment isolation remained unchanged;
- no other production environment variables were changed.

## Recovery exception

The fresh logical backup and disposable restore rehearsal described in the preparation record were not completed before this promotion. The owner explicitly instructed the promotion to continue and accepted that recovery evidence would be completed later.

This exception must remain visible until a fresh backup, encrypted custody check and disposable restore rehearsal have been completed and recorded.

## Release state at reconciliation commit

Before this reconciliation commit, the current production deploy remained ready at deploy `6a6612da3628de000862baea`, sourced from repository commit `16ac10d42ff1e9b547303c3e85b8a29ceaa70056`. The production contract variable change requires a fresh production build before exact-head 36/36 release identity and production smoke can be considered complete.

## Remaining release gates

- publish a production build from current `main` with contract 36;
- verify deployed commit identity and production Supabase isolation;
- run HTTP and browser production smoke at contract 36;
- confirm privacy-safe Sentry delivery remains healthy;
- complete and record the deferred fresh backup and restore rehearsal.
