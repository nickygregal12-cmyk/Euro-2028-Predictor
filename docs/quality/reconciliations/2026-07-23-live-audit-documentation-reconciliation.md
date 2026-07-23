# Live audit documentation reconciliation — 23 July 2026

**Audit:** `2026-07-23L`  
**Source commit/deploy:** `51d8ac607ee9d04bc932df1fea01a488f844f05a`  
**Scope:** Documentation only

## Why this reconciliation was required

The post-audit integrity PRs substantially changed the repository, but the main planning and operations documents still described an earlier state. Direct hosted inspection then established facts that had never been recorded in the repository:

- both hosted Supabase projects remain on the original 20-migration shape;
- the repository contains 33 migrations;
- production Netlify serves the post-PR #14 application;
- production lacks the bracket RPC used by that application;
- production Netlify values are scoped to all deploy contexts;
- the documented administrator role does not exist;
- legacy hosted function grants/search paths need review.

Leaving the old documents in active use would have caused agents to prioritize new feature work ahead of a live compatibility incident and could have encouraged invalid admin or migration operations.

## Documents added

- `AGENTS.md` — authoritative Git, database and documentation discipline.
- `docs/quality/audits/2026-07-23-live-environment-audit.md` — full repository/Netlify/Supabase evidence and fresh verdict.
- this reconciliation note.

## Documents updated

| Document | Reconciliation |
| --- | --- |
| `README.md` | Surfaces the app/schema mismatch and current authority order. |
| `CLAUDE.md` | Removes stale Tier 2/19-migration/DNS narratives and points agents to live evidence. |
| `docs/quality/current-status.md` | Makes verified hosted state and `OPS-006` the immediate priority. |
| `docs/quality/risk-register.md` | Retests all original IDs, adds `OPS-006`, `OPS-007` and `SECURITY-003`, resolves/supersedes supported findings. |
| `docs/quality/feature-baseline.md` | Replaces the old structural snapshot with current hosted/repository feature classifications. |
| `docs/ops-pending-migrations.md` | Corrects the inventory from 20 “fully applied” migrations to 33 repository migrations with 13 pending in each hosted project. |
| `docs/ops-admin-bootstrap.md` | Prohibits the invalid `profiles.role` SQL and records the missing admin model. |
| `docs/ops-result-entry.md` | Reflects current result lifecycle, winner propagation and hosted absence. |
| `docs/ops-prod-cutover.md` | Preserves the environment boundary, corrects the admin claim and records the current compatibility incident. |
| `docs/roadmap.md` | Reorders work around recovery, hosted integrity and reliability before feature expansion. |
| `docs/build-todo.md` | Replaces the stale tier checklist with an actionable recovery-first list. |

## Documents deliberately not rewritten

- dated audits remain immutable historical evidence;
- workstream reconciliation notes remain exact records of their repository/local boundary at the time;
- scoring, tournament structure, architecture, design-system and competition-rule documents remain authoritative for their subject unless a later official fact or implementation change requires a separate update.

## Result

The active documentation now consistently states:

1. repository/local integrity work is not hosted;
2. production application and database are currently incompatible;
3. production and development must remain isolated;
4. no hosted migration is approved without explicit review and preflight evidence;
5. administrator bootstrap is not implemented;
6. the next work is recovery and hosted integrity, followed by `REL-003` and real R16 population;
7. bonus games remain planned launch scope but cannot outrank the current integrity gates.

No code, migration, hosted data, Auth setting, Netlify setting or deployment was changed by this reconciliation.
