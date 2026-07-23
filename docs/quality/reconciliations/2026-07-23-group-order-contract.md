# Group-order contract reconciliation — 23 July 2026

This note reconciles the live tracking position after the first two predicted-group-order contract batches. It is a dated status overlay, not a replacement for the historical audits in `docs/quality/audits/`.

## Authoritative merge record

| Item | Status | Evidence |
| --- | --- | --- |
| Baseline GitHub Actions CI | Merged | PR #1; merge commit `74a99f4046d3be06b7d60b02e5bd0d5b01889ce6` |
| TypeScript group-order contract — Batch 1 | Merged | PR #3; merge commit `3c0b5cd77490666e706cf3a7855e11417d94c824` |
| TypeScript group-order contract — Batch 2 | Merged | PR #4; merge commit `cba741da488d58d1da5bb96986f4633e316d7497` |
| Superseded early SQL/Supabase foundation | Closed without merge | PR #2; must not be revived |

## What is now covered

The production resolver itself was not changed by either batch. The merged contract now executes the real TypeScript group-table and tie-resolution functions against canonical fixtures and proves:

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

GitHub Actions passed install, build, lint, the full Vitest suite and the high-severity production-dependency audit on the final Batch 2 head before merge.

## Product rule for a remaining complete tie

The predictor follows the score-derived UEFA-style sequence as far as the user’s predictions allow:

1. predicted group points;
2. head-to-head points;
3. head-to-head goal difference;
4. head-to-head goals scored;
5. reapply those criteria to a smaller tied subset;
6. overall goal difference;
7. overall goals scored;
8. user-confirmed finishing order when teams are still inseparable.

The manual decision is a predictor-specific substitute for real-tournament criteria such as disciplinary records, because users are not predicting yellow and red cards.

## Post-group user flow decision

The overall post-group step is named **Finalise Group Standings**, not “Third-Place Ties” or another name that implies only third place can be affected.

The page sequence is:

1. resolve any remaining tie in any group position;
2. review the best third-placed table;
3. review the final knockout qualifiers;
4. continue to the bracket.

For each unresolved block, explain simply that the predicted scores still leave the teams level and that real disciplinary records could be used next. The user may:

- drag the tied teams into a different order; or
- choose **Keep this order & continue**.

Keeping the displayed order must save it as the user’s explicit manual prediction. It must not silently use input order as an automatic sporting tiebreaker. Changing scores later must invalidate a saved choice when the exact tied-team set no longer matches.

## Remaining work

### Batch 3 — manual-resolution contract

Still required before the UI is treated as locked:

- valid manual resolution of the exact unresolved block;
- the keep-as-shown path as an explicit saved decision;
- missing, duplicated, foreign and incorrectly scoped team IDs;
- stale resolutions after score changes;
- wrong-block and cross-group resolutions;
- multiple unresolved blocks without interference;
- hostile stored data failing safely;
- proof that no manual decision is inferred from arbitrary resolver input order.

### Database parity

Still pending and must be rebuilt from current `main` after Batch 3:

- local disposable Supabase/PostgreSQL harness only;
- SQL resolver with exact TypeScript parity;
- differential runner using the same canonical JSON fixtures;
- meaningful pgTAP behaviour and permission tests;
- no hosted development or production Supabase access during implementation;
- resolver permissions kept private from public, anonymous and authenticated client roles.

### UI

The current shipped `ThirdPlacePage` name and route description are legacy implementation labels. A later UI task should adopt the **Finalise Group Standings** product name and the agreed keep/reorder behaviour after the manual-resolution contract is complete.

## Effect on existing documents

- Historical audit reports remain unchanged as dated evidence.
- Findings that stated there was no CI or no canonical TypeScript group-order fixture contract are superseded by PRs #1, #3 and #4.
- Findings concerning database integration coverage, SQL parity, RLS/RPC boundaries and hosted-schema assurance remain open.
- `docs/roadmap.md` and `docs/build-todo.md` retain their broad product sequence; this note is the authoritative reconciliation for the group-order contract batches until their next normal maintenance pass.
