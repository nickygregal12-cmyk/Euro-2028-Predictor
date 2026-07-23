# Ops runbook — Confirming and correcting match results

This runbook describes the **repository result contract** introduced by migrations 28–32. It is not permission to apply migrations or enter results in a hosted project.

## Hosted status — 23 July 2026

Neither development nor production Supabase has the authoritative result-lifecycle migrations.

- Production currently has no stored match scores, so the result preflight may be able to pass after full review.
- Development has 12 legacy scored matches. Migration `20260723183000_knockout_result_lifecycle.sql` deliberately fails while those scores exist because their regulation/extra-time/penalty method cannot be inferred safely.
- No browser administrator result-entry interface or version-controlled admin role exists.

Do not use the functions below until the target environment has applied and verified the complete required migration chain.

## Absolute rules

- Never update score, method, shootout, winner, result-state or result-version columns directly.
- Never disable result-boundary or propagation triggers to force a result through.
- Never guess whether a legacy knockout score was reached in regulation, extra time or penalties.
- Corrections and clears require a meaningful reason.
- A failed preflight or constraint is a stop condition.
- Clear confirmed downstream results before changing an upstream winner.
- Use an exact tournament ID and match reference; never rely on “latest tournament” ordering.

## Supported server functions

After migrations 28–32 are applied, the only supported result write paths are:

- `public.confirm_match_result(...)`
- `public.correct_match_result(...)`
- `public.clear_match_result(...)`

They are denied to `PUBLIC`, `anon` and `authenticated` in the repository chain and are intended for `service_role` through a future server-side administrator adapter. A privileged database owner can call them during an explicitly authorized interim operation.

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

For penalties, the public football score remains tied at 120 minutes. The shootout score is separate and `winner_team_id` drives progression and champion scoring.

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
  m.result_version
from public.matches m
left join public.teams ht on ht.id = m.home_team_id
left join public.teams at on at.id = m.away_team_id
where m.tournament_id = '<TOURNAMENT_UUID>'::uuid
  and m.match_ref = '<MATCH_REF>';
```

Confirm the fixture and both participants against an authoritative match source before writing.

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
  p_reason => 'Verified after extra time'
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
  p_reason => 'Verified shootout result'
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

If the changed upstream winner already feeds a confirmed/corrected downstream match, the database rejects the correction. Clear the downstream result first, then correct the upstream match, then re-confirm downstream results in order.

## Clear a result

```sql
select public.clear_match_result(
  p_match_id => '<MATCH_UUID>'::uuid,
  p_reason => 'Fixture postponed before completion'
);
```

Clearing returns the match to `scheduled`, removes the current result/winner, removes propagated winner-fed participants where safe, appends a revision and recomputes scoring.

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

A privileged investigator may inspect revisions:

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
- the result and revision versions advanced exactly once.

## Current repository behavior

The latest repository chain does include:

- result confirmation/correction/clear;
- immutable revisions;
- serialized score recomputation;
- penalty-decided champion scoring;
- real winner propagation through QF, SF and final;
- protection against changing an upstream winner under a confirmed downstream result.

It does **not** yet include:

- automatic population of the real R16 from completed groups;
- a browser/server administrator adapter;
- automatic data-feed ingestion;
- hosted rollout verification;
- automatic repair of legacy scores.

## Related documents

- `docs/quality/current-status.md`
- `docs/quality/audits/2026-07-23-live-environment-audit.md`
- `docs/ops-pending-migrations.md`
- `docs/ops-admin-bootstrap.md`
- `docs/quality/reconciliations/2026-07-23-knockout-result-lifecycle.md`
- `docs/quality/reconciliations/2026-07-23-knockout-bracket-tree-integrity.md`
