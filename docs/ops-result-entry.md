# Ops runbook — Confirming and correcting match results

This runbook describes the repository result contract introduced by `DATA-002`.
It is **not permission to apply the migrations to a hosted Supabase project**.
Hosted rollout requires separate approval, preflight review and legacy-data
reconciliation.

There is no browser admin result-entry page yet. Until that server-side admin
adapter exists, an authorised operator may call the protected functions from a
privileged SQL session after the lifecycle migrations have been applied.

## Absolute rules

- Never update `matches.home_score`, `away_score`, result method, shootout fields,
  winner, result state or result version directly.
- Never disable the result-boundary trigger to force a result through.
- Never guess whether an existing knockout score was regulation, extra time or
  penalties.
- A correction or clear must include a meaningful reason.
- A failing constraint or migration preflight is a stop condition, not a prompt
  to weaken the database rule.

Direct result-column updates are rejected even for a privileged ordinary SQL
caller. The only supported write paths are:

- `confirm_match_result(...)`
- `correct_match_result(...)`
- `clear_match_result(...)`

The functions are denied to `PUBLIC`, `anon` and `authenticated`. They are
available to the server role for a future server-side admin adapter and remain
callable by the database owner in a privileged SQL session.

## Result model

The match row stores:

- `result_state`: `scheduled`, `confirmed` or `corrected`;
- `result_method`: `regulation`, `extra_time` or `penalties`;
- `home_score_90` / `away_score_90`;
- `home_score_120` / `away_score_120` when extra time was played;
- `home_penalties` / `away_penalties` when a shootout occurred;
- `home_score` / `away_score`: the public football score excluding shootout
  kicks;
- `winner_team_id`: the authoritative winner, derived by the lifecycle;
- revision, timestamp and reason metadata.

For a penalty-decided match, `home_score` and `away_score` remain tied at the
120-minute score. The shootout score is separate, and `winner_team_id` determines
advancement and champion scoring.

## Find the match first

Use an exact tournament and match reference. Do not rely on `order by year limit
1` in an environment that may contain more than one tournament.

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
  and m.match_ref = 'FINAL';
```

Confirm that both participants are correct before entering any result.

## Confirm a regulation result

Group draws are allowed. A knockout regulation result must not be tied.

```sql
select public.confirm_match_result(
  p_match_id => '<MATCH_UUID>'::uuid,
  p_method => 'regulation',
  p_home_90 => 2::smallint,
  p_away_90 => 1::smallint,
  p_reason => 'Verified against the official match report'
);
```

For a group draw, use the same function with equal 90-minute scores. The derived
winner will be `null`.

## Confirm an extra-time result

The 90-minute score must be tied. The 120-minute score must not be tied.

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

Both the 90-minute and 120-minute football scores must be tied. The shootout
score must not be tied.

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

The winner is derived from the shootout fields. Do not alter the tied public
football score to manufacture a winner.

## Correct a confirmed result

Use the complete corrected result, not only the changed field. A non-empty reason
is mandatory.

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
  p_reason => 'Official report showed the shootout teams reversed'
);
```

A correction advances `result_version`, changes the state to `corrected`,
appends an immutable revision and recomputes scoring in the same transaction.

## Clear an entered result

Use this for a postponement, abandoned fixture or result attached to the wrong
match. A reason is mandatory.

```sql
select public.clear_match_result(
  p_match_id => '<MATCH_UUID>'::uuid,
  p_reason => 'Fixture postponed before completion'
);
```

Clearing returns the match to `scheduled`, removes the current score and winner,
appends a revision and recomputes scoring. The revision sequence remains.

## Verify the authoritative result

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

The revision table is intentionally not client-readable. A privileged database
owner may inspect it during an authorised investigation:

```sql
select revision, action, reason, recorded_at, previous_result, new_result
from public.match_result_revisions
where match_id = '<MATCH_UUID>'::uuid
order by revision;
```

## Scoring and concurrency

Result write, revision insert and scoring recomputation run in one transaction.
`recompute_tournament_scores()` takes a tournament advisory transaction lock, so
concurrent result changes are serialised rather than interleaving delete-and-
rederive passes.

The scorer uses `winner_team_id` for the final champion, including a tied final
decided on penalties. Rank history is captured after the authoritative winner
has been scored.

A manual recompute remains available to a privileged server/database owner:

```sql
select public.recompute_tournament_scores('<TOURNAMENT_UUID>'::uuid);
```

It uses the same advisory lock and deterministic delete-and-rederive pipeline.

## Current boundaries

This lifecycle does not yet:

- propagate a winner automatically into the next knockout fixture;
- replay and validate the complete bracket tree;
- provide a browser admin interface;
- verify that either hosted Supabase project has applied these migrations;
- classify or repair legacy hosted scores automatically.

The migration deliberately fails if scores already exist, because a bare score
pair cannot establish the historical result method.
