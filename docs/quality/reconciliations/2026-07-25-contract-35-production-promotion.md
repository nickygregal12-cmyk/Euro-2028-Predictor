# Contract-35 production rollout and application promotion

**Date:** 25 July 2026  
**Scope:** Production migration-history reconciliation, migrations 21–35, Netlify production contract promotion and live application verification.  
**Repository source:** `main` commit `902a37aa6c50c967f8080d751147a5733b251fe3`.  
**Production Supabase:** `vkfnsqdyhvtwyqkisxhk`.  
**Production Netlify deploy:** `6a652c3d3416d26d595ae2ef`.  
**Production application/database contract:** `35`.

## Owner approvals

The owner separately and explicitly approved:

1. metadata-only production migration-history repair for migrations 1–20;
2. the exact 21–35 dry run and forward migration application;
3. changing only the production Netlify `EURO28_DEPLOYED_DB_CONTRACT` value from 20 to 35;
4. deploying the approved `main` commit and running fail-closed production application checks.

The approvals excluded migration 36, draft PR #76, non-production Netlify contexts, Supabase URL/key changes and domain changes.

## Production database execution

The production database operation completed successfully:

- exact contract-20 preflight passed before writes;
- migration history was repaired as metadata for exactly migrations 1–20;
- source counts, submitted timestamp and all three rollout fingerprints remained unchanged;
- the dry run listed exactly migrations 21–35 in timestamp order;
- migrations 21–35 applied successfully;
- migration history contained exactly 35 canonical versions through `20260724003000`;
- the final dry run reported the remote database was up to date;
- migration 36 was absent and was not applied.

Final production source state:

| Item | Verified value |
| --- | ---: |
| Auth users | 1 |
| Profiles | 1 |
| Entries | 1 |
| Submitted entries | 1 |
| Submitted timestamp | `2026-07-21T21:51:49.639442+00:00` |
| Match predictions | 36 |
| Predicted tie resolutions | 2 |
| Predicted progression rows | 8 |
| Derived group-position rows | 24 |
| Stored/non-scheduled results | 0 |
| Result revisions | 0 |
| Score events | 0 |
| Rank-history rows | 0 |

Preserved rollout fingerprints:

- predictions `320cf25d62767dee307d3602212909af`;
- ties `a4dcf183f5c48e3ba11ff75c59622598`;
- progression `0d7bc491daa9b24013204d061a2d38f1`.

## Database verification

The committed post-rollout verifier returned exactly 63 passing checks before and after rollback-only smoke operations. Verified controls include:

- private `predictor_internal` schema denied to browser roles;
- RPC-only submission and server-derived group positions;
- both contract-35 client RPCs present;
- denied direct browser progression and score-deletion writes;
- authoritative result lifecycle and immutable revision boundaries;
- exact authenticated and service-role function allowlists;
- no anonymous application-function execution;
- source-equivalent `entry_totals` ACLs;
- valid predicted bracket replay and submission;
- no invented score, result, revision or rank data.

Rollback-only smoke checks passed for authenticated identity, atomic bracket replacement, submission settlement, service-role result confirmation/clearing and revision-table denial. Every smoke write rolled back.

Security advisors returned no `ERROR` finding. Remaining warnings are documented non-blocking items: intentional signed-in `SECURITY DEFINER` RPCs, internal RLS tables without browser policies, the existing trigger-only `enforce_joker_rules` search-path warning and leaked-password protection being disabled. Performance advisors returned informational findings only.

## Recovery evidence

The accepted encrypted production artifact remained intact throughout the operation. Its corrected empty-target restore rehearsal had already passed source integrity, Auth/profile restoration, exact history repair, migrations 21–35, the 63-check verifier, advisors and rollback-only smoke tests without manual ACL repair.

Fresh preproduction backup evidence and production forward-rollout evidence are retained outside the repository under the operator's restricted evidence location. No archive passphrase, database credential, raw Auth record or private backup URL is committed.

## Netlify production promotion

Only the approved production-context declaration changed:

```text
EURO28_DEPLOYED_DB_CONTRACT: 20 → 35
```

Non-production contexts remained at contract 35 and continued to use development Supabase. Production continued to use production Supabase.

Netlify published deploy `6a652c3d3416d26d595ae2ef` from exact commit `902a37aa6c50c967f8080d751147a5733b251fe3`. The deploy reached ready state with no build error and no secret-scan match. Redirect and security-header rules were processed successfully.

## Live application verification

Read-only anonymous verification passed against both the production alias and immutable deploy URL:

- both roots returned HTTP 200;
- production alias HTML matched the immutable deploy;
- title, description, canonical metadata and React root were correct;
- Content-Security-Policy, HSTS, frame denial, MIME-sniffing protection, referrer policy and permissions policy were present;
- tested SPA routes returned the production application shell;
- initial JavaScript and CSS assets returned HTTP 200;
- the complete configured Supabase URL was production;
- the complete development Supabase URL was absent;
- the bare development project reference in the bundle was confirmed as fail-closed auto-login guard data;
- browser requests used no development or unexpected Supabase host;
- login, signup, password-reset, signed-out protected-route and not-found journeys passed;
- no form was submitted and no production data was changed.

Live evidence is retained outside the repository in `netlify-production-live-20260725T214235Z`.

## Finding disposition

The production application/database mismatch `OPS-006` is resolved. Contract-35 production backend controls are now deployed and verified for derived positions, submission, result lifecycle, serialized scoring, bracket replay, atomic bracket replacement and function privileges.

`TEST-001` remains partial because authenticated production browser mutation journeys, browser result administration and manual screen-reader review are still outstanding. `OPS-003` remains open only for monitoring, alert ownership, periodic recovery rehearsal and final launch rollback readiness; recovery proof and this production execution are complete.

## Remaining boundaries

This operation does not make the product tournament-launch-ready. Remaining work includes:

- production monitoring and alert ownership;
- an approved admin authorization and browser result-management path;
- Turnstile/non-production CAPTCHA verification and leaked-password protection decision;
- branch-protection verification;
- official Euro 2028 teams, fixtures, regulations and lock instant;
- full tournament dress rehearsal and manual assistive-technology review;
- wider reference integrity work, including draft PR #76 only after separate review.

Migration 36 was not applied. Draft PR #76 remained unchanged. No production-to-development fallback, direct-table compatibility shortcut, non-production context change, Supabase URL/key change or domain change occurred.