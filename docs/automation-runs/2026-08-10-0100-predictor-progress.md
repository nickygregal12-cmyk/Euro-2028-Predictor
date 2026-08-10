# Predictor progress handover — 2026-08-10 01:00

## Executive summary

This run picked up from the actual current repository and hosted state rather than the now-stale 9 August 03:00 narrative. The repository had already advanced to Contract 144, Development was already hosted at Contract 144 and Production remained at Contract 132. The only open product PR was EURO-004 route enforcement (#627).

PR #627 was re-verified at its exact head, marked ready and squash-merged. The weekly application now consumes Contract 143's server-owned Euro publication state at the tournament route boundary. Player-facing Euro-only routes fail closed while the state is `hidden` or when the bounded state read fails; the Euro tournament data and prediction providers do not mount before the state permits the route. `/admin/results` remains independently protected and available for preparation while hidden.

No Supabase migration, data write, Edge Function deployment, Netlify configuration change or production deployment was made in this run.

## Starting authority and hosted state

- Starting `main`: `575a3446946dda7eb625fe236d987e1088e5aa4e`.
- Repository deployment contract: **144** / 144 canonical migrations, through `20260809140000_provider_team_profile_foundation.sql`.
- Development Supabase (`iouzoutneyjpugbbtdem`): **144** migrations, through `20260809140000_provider_team_profile_foundation`.
- Production Supabase (`vkfnsqdyhvtwyqkisxhk`): **132** migrations, through `20260807210812_provider_initial_fixture_approval`.
- Active Netlify site only: `euro28predictor`, site ID `c69da01a-4650-43db-a1d2-b78b7f8e198a`.
- Active production deploy: `6a6bac566b6e440008d44e5b`, state `ready`.
- Team SSO remains required for all Netlify deploy contexts.
- The historic `euro28-predictor-dev` site was not inspected or used.

The repository's current-status authority records that Development reached 144 through the guarded Development Fast Lane. Production promotion from 132 to 144 has been authorised but has not happened because the required production backup gate cannot connect using the current repository secret. The failed backup is GitHub Actions run `31327860208`; it failed before a production row was read.

## Production promotion blocker

The current blocker is infrastructure/secret configuration, not a migration defect.

`SUPABASE_PROD_DB_URL` currently resolves through the project's direct database host. That host is IPv6-only, whereas the GitHub-hosted runner used by the guarded backup/rehearsal/rollout workflow is IPv4-only. The repository-controlled fix is to repoint that secret to the eu-west-2 **session pooler** on port 5432 (or separately enable the project's IPv4 add-on). This run had no repository-secret write surface and did not bypass the backup gate with direct Supabase writes.

Until that secret is repaired, Production must stay at Contract 132. A direct application of Contracts 133–144 through the Supabase connector would bypass the mandatory encrypted backup, disposable rehearsal and workflow evidence, so it is not acceptable.

## PR #627 — EURO-004 route enforcement

PR: **#627 — EURO-004: enforce hidden Euro routes from server publication state**

Exact verified head before merge:

`60883b6a88008b39e0537deb5987c116cf09e941`

Changed files:

- `src/services/supabase/euroPublication.ts`
- `src/app/TournamentJourney.tsx`
- `tests/app/TournamentJourney.test.tsx`
- `e2e/bonus-games-fixture.sql`
- `docs/architecture/euro-publication-lifecycle.md`

### Behaviour delivered

- adds a typed client for the bounded `euro_publication_state()` RPC;
- recognises the server lifecycle `hidden`, `prelaunch`, `registration-open`, `live`, `completed`, `archived`;
- treats a malformed/failed publication-state read as refusal, not publication;
- redirects a guessable player-facing Euro route to Hub Home while `hidden`;
- mounts `TournamentDataProvider` and `PredictionsProvider` only after the server state permits the route;
- preserves `/admin/results` as a separately authorised preparation path while hidden;
- explicitly advances only the disposable Browser E2E fixture to `prelaunch`, preserving Contract 143's real default of `hidden` rather than weakening the application guard.

### Exact-head verification

All exact-head gates completed successfully before merge:

- CI run **#2752** / run ID `31344272363`: **success**;
- Browser E2E **#1512**: **success**;
- Visual Contracts **#25**: **success**;
- CodeQL **#465**: **success**;
- migration timestamp validation: **passed**;
- documentation authority validation: **passed**;
- generated-state validation: **passed**;
- build: **passed**;
- compressed bundle budgets: **passed**;
- lint: **passed**;
- domain coverage thresholds: **passed**;
- full test step: **passed**.

Active-site Netlify preview:

- deploy ID `6a7919ba745f490008e96832`;
- site `euro28predictor` only;
- exact commit `60883b6a88008b39e0537deb5987c116cf09e941`;
- state **ready**;
- redirect rules: passed;
- header rule: passed;
- secret scan: no matches;
- no functions or Edge Functions deployed.

Preview Lighthouse remains a follow-up quality signal rather than a release gate: Performance 19, Accessibility 100, Best Practices 92, SEO 100, PWA 40.

### Merge

#627 was marked ready after all exact-head gates passed and was squash-merged with expected-head protection.

New `main`:

`335eeff424ba8bd75fe6da325bbedce3a6f218eb`

There were no open PRs immediately after the merge.

## Hosted Development verification after merge

A fresh read-only call to `public.euro_publication_state()` on Development returned:

- state: `hidden`;
- changed at: `2026-08-09 17:56:56.564822+00`.

That is the desired operational position: repository application code now has the route guard, Development already has Contract 143's publication authority, and the hosted state remains fail-closed. No publication transition was made.

The Development security advisor was also re-run. It reported the project's existing RLS-with-no-policy informational findings and SECURITY DEFINER warnings, including the intentionally bounded `euro_publication_state()` read, plus the known `pg_net`-in-public warning and leaked-password-protection warning. No opportunistic privilege or Auth configuration change was made: those findings span established application authorities and need repository-level review rather than ad-hoc hosted mutation.

## Authority drift discovered

The moving implementation authority is correct on repository/hosted contract versions, but two Euro decision/register documents still carry pre-hosting wording:

- `docs/quality/accepted-requirements.md` still describes EURO-002 as a repository Contract-143 candidate that will leave the register once Development holds it, although Development now does hold it;
- the same register still says EURO-004 is unimplemented and describes EURO-001/EURO-003 as lacking a server-owned route guard, although #627 has now merged;
- `docs/adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md` still says Contract 143 has no hosted rollout and no EURO-004 guard.

This is documentation/requirement-state drift, not a live security gap. It should be reconciled before new Euro publication work is scheduled, while carefully distinguishing **repository implementation + Development hosting** from **Production hosting/application release**.

## Netlify release posture

The production Netlify artifact was not rebuilt or published by this run. The active production deploy remains `6a6bac566b6e440008d44e5b` and ready. Therefore, merging #627 does **not** mean the current public production artifact is serving the new route guard.

Netlify remains a separate release layer from the database contract. Do not publish an application bundle that requires Contract 143 while Production is still at Contract 132. The repository-controlled Production 132→144 promotion must complete first, followed by the separately gated application release.

## Mutations performed in this run

Repository only:

1. marked PR #627 ready after exact-head gates completed;
2. squash-merged PR #627 with expected-head protection;
3. created `automation/2026-08-10-0100-handover` from exact post-merge `main`;
4. added this handover report.

Hosted changes:

- Development Supabase: **none**;
- Production Supabase: **none**;
- Edge Functions: **none**;
- provider requests/backfills: **none**;
- Netlify configuration: **none**;
- Netlify production deploy: **none**.

## Risks / blockers

1. **Production 132→144 remains blocked at the mandatory backup gate.** The current `SUPABASE_PROD_DB_URL` points at the IPv6-only direct host; the GitHub runner needs the eu-west-2 session-pooler URI on port 5432 or an IPv4 add-on.
2. **The newly merged EURO-004 guard is not yet in the current production application artifact.** This is correct while Production still lacks Contract 143.
3. **Euro authority documentation is stale after the successful Development rollout and #627 merge.** It must be reconciled without overstating Production readiness.
4. **Deploy-preview Lighthouse performance remains poor (19).** This is not new to the route guard and did not fail repository gates, but it remains a frontend quality follow-up.
5. **Supabase advisor warnings require deliberate review, not blanket changes.** In particular, `euro_publication_state()` is intentionally a bounded publication-state read used by the route guard; changing its reachability without redesigning the pre-auth visibility boundary would break EURO-004.

## Exact next action for the 03:00 session

1. Fetch exact `main` and merge this handover PR if its own exact-head checks are green.
2. Reconcile `accepted-requirements.md` and ADR 0026 against facts now established: Contract 143 is hosted on Development and state remains `hidden`; EURO-004 has merged with executable fail-closed tests. Reassess EURO-001/EURO-003 status from the full weekly public surface, but do not claim Production enforcement until the application is actually released there.
3. Check whether `SUPABASE_PROD_DB_URL` has been repaired to the eu-west-2 session pooler. If it has, run the repository-controlled **Production backup → Production 132→144 rehearsal → Production 132→144 rollout** sequence exactly as encoded in the workflows. Independently verify the Production migration ledger, Contract-143 publication state and privilege boundaries before updating hosted authority.
4. If the secret remains broken, do **not** direct-apply Contracts 133–144 and do not add Contract 145 merely to create motion. Continue a non-migration Domestic Frontend Alpha slice (prefer the remaining DFA-004 route convergence/cleanup or another already-accepted UI/read-only slice) while preserving the production gate.
5. Only after Production is verifiably at 144 should the active `euro28predictor` application release be considered; its deploy-time DB contract and repository controls must agree before publishing the #627 code to production.
