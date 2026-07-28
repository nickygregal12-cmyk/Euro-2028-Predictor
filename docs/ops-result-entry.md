# Ops runbook — Confirming and correcting match results

> **Superseded for normal result entry (2026-07-27):** authorised administrators now confirm, correct and clear results through the browser Admin Control Room (`/admin/results`, shipped via PRs #110-follow-ons and #120 on the `admin_*` result RPCs from migration `20260727075922`). This runbook remains valid as the service-role/SQL reference and for operations the UI does not cover; the authority rules below still apply.

This runbook describes the production result contract introduced by migrations 28–32. The functions are live in development and production at contract 35 (production now at contract 38). This document does not grant authority to enter or change a result.

## Hosted status — 25 July 2026

| Environment | Result-lifecycle position |
| --- | --- |
| Development `iouzoutneyjpugbbtdem` | Migrations 28–32 are applied and verified. Confirm/correct/clear, immutable revisions, serialized scoring and winner propagation are available. |
| Production `vkfnsqdyhvtwyqkisxhk` | Migrations 28–32 are applied within the exact 35-version chain. The 63-check verifier and rollback-only service-role confirm/clear smoke passed. No real result, revision, score event or rank-history row is currently stored. |

Since this snapshot, a browser administrator result-entry interface exists (`/admin/results`, capability-checked via server-owned Auth `app_metadata` — see the note at the top). The underlying migration 28–32 RPCs described below remain service-role-only. A database owner or service-role operator may use them only during an explicitly authorized operation with a verified source and retained evidence.

## Absolute rules

- Never update score, method, shootout, winner, state or version columns directly.
- Never disable result-boundary or propagation triggers.
- Never guess whether a knockout score occurred in regulation, extra time or penalties.
- Corrections and clears require a meaningful reason.
- A failed preflight or constraint is a stop condition.
- Clear confirmed downstream results before changing an upstream winner.
- Use an exact tournament ID and match reference; never rely on “latest tournament” ordering.
- Verify the result against an authoritative source before writing.
- Do not use production for training, rehearsal or speculative entry.
- Retain operator, source, reason, time, function result and post-verification without secrets.

## Supported server functions

The only supported result write paths are:

- `public.confirm_match_result(...)`
- `public.correct_match_result(...)`
- `public.clear_match_result(...)`

They are denied to `PUBLIC`, `anon` and `authenticated` and granted only to `service_role`. A future server-side administrator adapter must call these functions rather than direct table writes.

Direct `service_role` access to `public.match_result_revisions` is intentionally denied. Revision creation occurs only inside the protected lifecycle functions. Investigation of revision rows requires a separately authorized database-owner path.

## Result model

A match stores:

- `result_state`: `scheduled`, `confirmed` or `corrected`;
- `result_method`: `regulation`, `extra_time` or `penalties`;
- 90-minute score;
- optional 120-minute score;
- optional shootout score;
- public football score excluding shootout kicks;
- derived `winner_team_id`;
- result version, timestamps and reason metadata.

For penalties, the public football score remains tied at 120 minutes. Shootout kicks are separate and `winner_team_id` drives progression/champion scoring.

## Pre-operation verification

Before any production result write:

1. confirm explicit operator authorization;
2. confirm production project identity `vkfnsqdyhvtwyqkisxhk`;
3. confirm the exact tournament and match reference;
4. confirm home/away participants;
5. confirm current `result_state` and `result_version`;
6. confirm the official source and match completion method;
7. inspect downstream confirmed/corrected results before changing an upstream match;
8. capture a read-only pre-operation snapshot;
9. prepare the post-operation verification query;
10. stop if any identity, source or dependency is ambiguous.

## Find and verify the match

```sql
select
  m.id,
  m.match_ref,
  m.round,
  m.home_team_id,
  ht.name as home_team,
  m.away_team_id,
  at.name as away_team,
  m.result_state,
  m.result_method,
  m.result_version
from public.matches m
left join public.teams ht on ht.id = m.home_team_id
left join public.teams at on at.id = m.away_team_id
where m.tournament_id = '<TOURNAMENT_UUID>'::uuid
  and m.match_ref = '<MATCH_REF>';
```

Confirm the fixture and participants against an authoritative match source before writing.

## Confirm a regulation result

Group draws are allowed. A knockout regulation result cannot be tied.

```sql
select public.confirm_match_result(
  p_match_id => '<MATCH_UUID>'::uuid,
  p_method => 'regulation',
  p_home_90 => 2::smallint,
  p_away_90 => 1::smallint,
  p_reason => 'Verified against the official match report'
);
```

## Confirm an extra-time result

The 90-minute score must be tied and the 120-minute score must produce a winner.

```sql
select public.confirm_match_result(
  p_match_id => '<MATCH_UUID>'::uuid,
  p_method => 'extra_time',
  p_home_90 => 1::smallint,
  p_away_90 => 1::smallint,
  p_home_120 => 2::smallint,
  p_away_120 => 1::smallint,
  p_reason => 'Verified against the official extra-time result'
);
```

## Confirm a penalty result

Both 90 and 120 minutes must be tied; the shootout cannot be tied.

```sql
select public.confirm_match_result(
  p_match_id => '<MATCH_UUID>'::uuid,
  p_method => 'penalties',
  p_home_90 => 1::smallint,
  p_away_90 => 1::smallint,
  p_home_120 => 1::smallint,
  p_away_120 => 1::smallint,
  p_home_penalties => 5::smallint,
  p_away_penalties => 4::smallint,
  p_reason => 'Verified against the official shootout result'
);
```

## Correct a result

Supply the complete corrected result and a non-empty reason.

```sql
select public.correct_match_result(
  p_match_id => '<MATCH_UUID>'::uuid,
  p_method => 'penalties',
  p_home_90 => 1::smallint,
  p_away_90 => 1::smallint,
  p_home_120 => 1::smallint,
  p_away_120 => 1::smallint,
  p_home_penalties => 4::smallint,
  p_away_penalties => 5::smallint,
  p_reason => 'Corrected from the official match report'
);
```

If an upstream winner feeds a confirmed/corrected downstream match, the database rejects the correction. Clear downstream results first, correct upstream, then reconfirm downstream in order.

## Clear a result

```sql
select public.clear_match_result(
  p_match_id => '<MATCH_UUID>'::uuid,
  p_reason => 'Fixture postponed before completion'
);
```

Clearing returns the match to `scheduled`, removes current result/winner, removes propagated winner-fed participants where safe, appends a revision and recomputes scoring.

## Verify result, progression and scoring

```sql
select
  match_ref,
  result_state,
  result_method,
  home_score_90,
  away_score_90,
  home_score_120,
  away_score_120,
  home_score,
  away_score,
  home_penalties,
  away_penalties,
  winner_team_id,
  result_version,
  confirmed_at,
  corrected_at
from public.matches
where id = '<MATCH_UUID>'::uuid;
```

A separately authorized database owner may inspect revisions:

```sql
select revision, action, reason, recorded_at, previous_result, new_result
from public.match_result_revisions
where match_id = '<MATCH_UUID>'::uuid
order by revision;
```

Also verify:

- the correct winner-fed child participant changed;
- no unrelated fixture changed;
- expected `score_events` were rederived;
- leaderboard totals and rank history are coherent;
- result and revision versions advanced exactly once;
- the function action/reason/source were recorded in the operational change record.

## Rollback and correction policy

Do not attempt direct SQL rollback of a confirmed result. Use the protected lifecycle:

- wrong but completed result → `correct_match_result`;
- result should not remain authoritative → `clear_match_result`;
- upstream correction blocked by downstream result → clear downstream in reverse order, correct upstream, reconfirm forward in order.

A failed function call should leave the transaction unchanged. Stop and inspect rather than weakening a constraint.

## Current implemented behaviour

Implemented and production-hosted:

- result confirmation, correction and clear;
- immutable revisions;
- serialized score recomputation;
- penalty-decided champion scoring;
- real winner propagation through QF, SF and final;
- protection against changing an upstream winner beneath a confirmed downstream result;
- exact service-role-only result-function privileges;
- direct revision-table denial;
- rollback-only production result lifecycle smoke.

Not yet implemented/live:

- automatic real R16 population from completed groups;
- browser/server administrator adapter and authorization model;
- automatic data-feed ingestion;
- automatic repair of legacy scores.

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/reconciliations/2026-07-25-contract-35-production-promotion.md`
- `docs/ops-pending-migrations.md`
- `docs/ops-hosted-migration-rollout.md`
- `docs/ops-admin-bootstrap.md`
- `docs/quality/reconciliations/2026-07-23-knockout-result-lifecycle.md`
- `docs/quality/reconciliations/2026-07-23-knockout-bracket-tree-integrity.md`