# Group-order contract reconciliation — 23 July 2026

This note reconciles the live tracking position after the predicted-group-order contract, manual-resolution flow and private PostgreSQL parity work. It is a dated status overlay, not a replacement for the historical audits in `docs/quality/audits/`.

## Authoritative merge record

| Item | Status | Evidence |
| --- | --- | --- |
| Baseline GitHub Actions CI | Merged | PR #1; merge commit `74a99f4046d3be06b7d60b02e5bd0d5b01889ce6` |
| TypeScript group-order contract — Batch 1 | Merged | PR #3; merge commit `3c0b5cd77490666e706cf3a7855e11417d94c824` |
| TypeScript group-order contract — Batch 2 | Merged | PR #4; merge commit `cba741da488d58d1da5bb96986f4633e316d7497` |
| Tracking reconciliation | Merged | PR #5; merge commit `308f1e226510b0263fb59d6b8fadde9b6385e1e3` |
| Manual-resolution contract and user flow — Batch 3 | Merged | PR #6; merge commit `96abbe79501101e8212009007da6f6da5605e32d` |
| Private PostgreSQL parity and local database tests | Merged | PR #7; merge commit `a188ecfb048608813e887b7b02b97c67d6555b97` |
| Superseded early SQL/Supabase foundation | Closed without merge | PR #2; must not be revived |

## What is now covered

The merged contract executes the production TypeScript group-table and tie-resolution functions against canonical fixtures and proves:

- ordinary ordering by predicted group points;
- two-team head-to-head points;
- three-team head-to-head goal difference;
- three-team head-to-head goals scored;
- recursive reapplication to a smaller tied subset;
- both a recursively resolved and recursively unresolved subset;
- overall goal-difference fallback;
- overall goals-scored fallback, including a three-team case;
- partial-group behaviour;
- fully unresolved groups;
- team-input and match-input order independence;
- no arbitrary slot or input-order sporting fallback;
- the mathematical impossibility of an exactly-three-team overall-points tie being separated by head-to-head points in this four-team, single-round-robin, 3/1/0 format, checked across all `3^6 = 729` outcome combinations;
- structural validation of the canonical fixture corpus and its proof metadata.

Batch 3 additionally proves and implements:

- valid manual resolution of the exact unresolved block;
- **Keep this order** as an explicit stored prediction;
- safe rejection of missing, duplicated, foreign, extra and incorrectly scoped team IDs;
- stale-resolution invalidation after score changes alter the tied set;
- independent handling of multiple unresolved blocks;
- hostile stored rows failing safely without masking a later valid row;
- no manual decision inferred from arbitrary resolver input order;
- same-group prompting directly on the relevant group page;
- a **Change scores** route back to the relevant group’s complete score set;
- direct score-review routes from **Finalise Group Standings** for cross-group best-third issues;
- the chosen manual order being reflected immediately in the displayed table.

## Product rule for a remaining complete tie

The predictor follows the score-derived sequence as far as the user’s predictions allow:

1. predicted group points;
2. head-to-head points;
3. head-to-head goal difference;
4. head-to-head goals scored;
5. reapply those criteria to a smaller tied subset;
6. overall goal difference;
7. overall goals scored;
8. user-confirmed finishing order when teams are still inseparable.

The manual decision is a predictor-specific substitute for real-tournament criteria such as disciplinary records, because users are not predicting yellow and red cards.

## Finalise Group Standings flow

The overall post-group step is named **Finalise Group Standings**.

The page sequence is:

1. resolve any remaining cross-group issue;
2. review the best third-placed table;
3. review the final knockout qualifiers;
4. continue to the bracket.

Same-group ties are surfaced earlier, on the relevant group page once all six group scores are complete. The normal continuation action remains unavailable until the user explicitly keeps or rearranges the unresolved order. The user may return to the group’s match cards to change scores instead.

Cross-group best-third ties remain in **Finalise Group Standings**, because they cannot be known until all groups are complete. Review actions return the user to the relevant group’s full score set and provide a route back.

A single supposedly responsible match is not identified because several fixtures can combine to create the tie.

## Private PostgreSQL parity

PR #7 added a private `predictor_internal` implementation with a pure JSONB input/output contract. The local-only database workflow proves:

- disposable Supabase starts without linking to a hosted project;
- all committed migrations rebuild successfully;
- database lint passes;
- pgTAP behaviour and permission tests pass;
- every canonical fixture is executed through both production TypeScript and private PostgreSQL;
- normalized statistics, order, ranks, unresolved flags and unresolved team sets match exactly;
- manual keep/reorder, hostile-row-before-valid-row, stale-resolution and partial-group cases also match;
- `PUBLIC`, `anon` and `authenticated` cannot use or execute the private resolver;
- the disposable local data is deleted after every workflow run.

No public RPC, client-callable wrapper or hosted database access was added.

## Remaining boundaries

The group-order contract itself is complete for the current scope, but the following broader findings remain open:

- hosted production schema and migration-history assurance;
- entry ownership, same-tournament validation and submission-state protection;
- `predicted_group_positions` persistence and lock rules;
- multi-user and multi-tournament RLS/RPC regression tests;
- browser-level end-to-end coverage;
- knockout result modelling and transactional scoring concerns recorded elsewhere in `docs/quality/`.

## Effect on existing documents

- Historical audit reports remain unchanged as dated evidence.
- Historical statements that there was no CI, canonical group-order contract, manual-resolution coverage or local SQL parity harness are superseded by PRs #1 and #3–#7.
- Findings concerning hosted production assurance, entry boundaries, RLS/RPC behaviour and browser journeys remain open until separately verified.
- `docs/roadmap.md` and `docs/build-todo.md` retain their broad product sequence; this note is the authoritative reconciliation for the completed group-order workstream.