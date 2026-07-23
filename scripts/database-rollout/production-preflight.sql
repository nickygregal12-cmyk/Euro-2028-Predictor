-- Euro 2028 Predictor — migrations 21–33 production preflight
--
-- READ-ONLY. Run immediately before a proposed production rollout.
-- Expected current production state: exactly one submitted entry.
-- Any false/nonnull anomaly or changed rollout-guard fingerprint is a stop condition.
--
-- The fingerprints intentionally bind this preflight to the exact production payload
-- that was replayed successfully on hosted development on 23 July 2026. If the entry
-- changes, repeat the hosted clone/replay rehearsal and update this script through a
-- reviewed repository change. Do not edit expected values during a rollout window.

with submitted as (
  select e.id, e.tournament_id, e.submitted_at, t.lock_at
  from public.entries e
  join public.tournaments t on t.id = e.tournament_id
  where e.submitted_at is not null
), target as (
  select * from submitted order by submitted_at limit 1
), group_shapes as (
  select
    g.letter,
    (select count(*) from public.group_teams gt where gt.group_id = g.id) as team_count,
    (select count(*) from public.matches m where m.group_id = g.id and m.round = 'group') as match_count,
    (
      select count(*)
      from public.matches m
      where m.group_id = g.id
        and m.round = 'group'
        and m.home_team_id is not null
        and m.away_team_id is not null
        and m.home_team_id <> m.away_team_id
        and exists (
          select 1 from public.group_teams gt
          where gt.group_id = g.id and gt.team_id = m.home_team_id
        )
        and exists (
          select 1 from public.group_teams gt
          where gt.group_id = g.id and gt.team_id = m.away_team_id
        )
    ) as valid_match_count,
    (
      select count(*)
      from target t
      join public.match_predictions mp on mp.entry_id = t.id
      join public.matches m on m.id = mp.match_id
      where m.group_id = g.id and m.round = 'group'
    ) as prediction_count
  from public.groups g
  join target t on t.tournament_id = g.tournament_id
), tie_checks as (
  select
    ptr.scope,
    cardinality(ptr.ordered_team_ids) as member_count,
    (select count(distinct x) from unnest(ptr.ordered_team_ids) x) as unique_count,
    (
      select count(*)
      from unnest(ptr.ordered_team_ids) x
      join public.teams tm on tm.id = x
      join target t on t.tournament_id = tm.tournament_id
    ) as scoped_team_count,
    (
      select count(distinct gt.group_id)
      from unnest(ptr.ordered_team_ids) x
      join public.group_teams gt on gt.team_id = x
    ) as group_count,
    (
      select string_agg(x::text, '|' order by x::text)
      from unnest(ptr.ordered_team_ids) x
    ) = ptr.tie_key as key_valid,
    array_to_string(array(
      select coalesce(g.letter, '?') || ':' || tm.name
      from unnest(ptr.ordered_team_ids) with ordinality u(team_id, ord)
      join public.teams tm on tm.id = u.team_id
      left join public.group_teams gt on gt.team_id = tm.id
      left join public.groups g on g.id = gt.group_id
      order by u.ord
    ), ',') as ordered_names
  from target t
  join public.predicted_tie_resolutions ptr on ptr.entry_id = t.id
), prediction_rows as (
  select m.match_ref, mp.home_score, mp.away_score, mp.joker
  from target t
  join public.match_predictions mp on mp.entry_id = t.id
  join public.matches m on m.id = mp.match_id
), progression_rows as (
  select tm.name, pp.stage
  from target t
  join public.predicted_progression pp on pp.entry_id = t.id
  join public.teams tm on tm.id = pp.team_id
), fingerprints as (
  select
    (
      select md5(coalesce(string_agg(
        match_ref || ':' || home_score || ':' || away_score || ':' || joker,
        '|' order by match_ref
      ), ''))
      from prediction_rows
    ) as predictions,
    (
      select md5(coalesce(string_agg(
        scope || ':' || ordered_names,
        '|' order by scope, ordered_names
      ), ''))
      from tie_checks
    ) as ties,
    (
      select md5(coalesce(string_agg(
        name || ':' || stage,
        '|' order by name
      ), ''))
      from progression_rows
    ) as progression
), source_refs as (
  select m.match_ref, m.round, m.home_source as source
  from public.matches m
  join target t on t.tournament_id = m.tournament_id
  where m.round in ('qf', 'sf', 'final')
  union all
  select m.match_ref, m.round, m.away_source
  from public.matches m
  join target t on t.tournament_id = m.tournament_id
  where m.round in ('qf', 'sf', 'final')
), source_checks as (
  select
    sr.*,
    src.round as source_round,
    case sr.round
      when 'qf' then 'r16'
      when 'sf' then 'qf'
      when 'final' then 'sf'
    end as expected_round
  from source_refs sr
  cross join target t
  left join public.matches src
    on src.tournament_id = t.tournament_id
   and src.match_ref = substring(sr.source from 3)
), anomalies as (
  select
    (
      select count(*)
      from public.match_predictions mp
      join public.entries e on e.id = mp.entry_id
      join public.matches m on m.id = mp.match_id
      where e.tournament_id <> m.tournament_id or m.round <> 'group'
    ) as match_scope,
    (
      select count(*)
      from public.predicted_progression pp
      join public.entries e on e.id = pp.entry_id
      join public.teams tm on tm.id = pp.team_id
      where e.tournament_id <> tm.tournament_id
    ) as progression_scope,
    (
      select count(*)
      from public.predicted_group_positions pgp
      join public.entries e on e.id = pgp.entry_id
      join public.groups g on g.id = pgp.group_id
      join public.teams tm on tm.id = pgp.team_id
      where e.tournament_id <> g.tournament_id
         or e.tournament_id <> tm.tournament_id
         or not exists (
           select 1 from public.group_teams gt
           where gt.group_id = pgp.group_id and gt.team_id = pgp.team_id
         )
    ) as group_position_scope
), checks as (
  select
    (select count(*) from submitted) = 1 as exactly_one_submitted_entry,
    (
      select submitted_at = '2026-07-21 21:51:49.639442+00'::timestamptz
      from target
    ) as submitted_timestamp_unchanged,
    (select lock_at is not null and submitted_at < lock_at from target) as submitted_before_lock,
    (select count(*) = 6 from group_shapes) as six_groups,
    (
      select count(*) = 0
      from group_shapes
      where team_count <> 4
         or match_count <> 6
         or valid_match_count <> 6
         or prediction_count <> 6
    ) as groups_complete,
    (select count(*) = 36 from prediction_rows) as thirty_six_predictions,
    (
      select count(*) = 2
         and count(*) filter (where scope = 'group') = 1
         and count(*) filter (where scope = 'third') = 1
      from tie_checks
    ) as expected_tie_rows_present,
    (
      select count(*) = 0
      from tie_checks
      where member_count < 2
         or unique_count <> member_count
         or scoped_team_count <> member_count
         or not key_valid
         or (scope = 'group' and group_count <> 1)
         or (scope = 'third' and group_count <> member_count)
    ) as tie_rows_valid,
    (
      select predictions = '8d76619fe4b44fdac17de1cc2afe5aaa'
         and ties = 'a4dcf183f5c48e3ba11ff75c59622598'
         and progression = '0d7bc491daa9b24013204d061a2d38f1'
      from fingerprints
    ) as rehearsed_payload_unchanged,
    (
      select count(*) = 8
         and count(*) filter (where pp.stage = 'qf') = 4
         and count(*) filter (where pp.stage = 'sf') = 2
         and count(*) filter (where pp.stage = 'final') = 1
         and count(*) filter (where pp.stage = 'champion') = 1
      from target t
      join public.predicted_progression pp on pp.entry_id = t.id
    ) as progression_shape_valid,
    (
      select count(*) = 0
      from target t
      join public.predicted_group_positions pgp on pgp.entry_id = t.id
    ) as legacy_group_positions_unchanged,
    (
      select count(*) = 0
      from public.matches m
      join target t on t.tournament_id = m.tournament_id
      where m.home_score is not null or m.away_score is not null
    ) as no_legacy_scores,
    (
      select count(*) = 0 from public.score_events
    ) as no_existing_score_events,
    (
      select count(*) = 0 from public.rank_history
    ) as no_existing_rank_history,
    (
      select
        count(*) filter (where m.round = 'r16') = 8
        and count(*) filter (where m.round = 'qf') = 4
        and count(*) filter (where m.round = 'sf') = 2
        and count(*) filter (where m.round = 'final') = 1
      from public.matches m
      join target t on t.tournament_id = m.tournament_id
    ) as knockout_counts_valid,
    (
      select count(*) = 14
         and count(distinct source) = 14
         and count(*) filter (
           where source is null
              or source !~ '^W-.+'
              or source_round is distinct from expected_round
         ) = 0
      from source_checks
    ) as knockout_sources_valid,
    (select match_scope = 0 and progression_scope = 0 and group_position_scope = 0 from anomalies) as scopes_valid
)
select jsonb_build_object(
  'checks', to_jsonb(checks),
  'overall_structural_pass',
    exactly_one_submitted_entry
    and submitted_timestamp_unchanged
    and submitted_before_lock
    and six_groups
    and groups_complete
    and thirty_six_predictions
    and expected_tie_rows_present
    and tie_rows_valid
    and rehearsed_payload_unchanged
    and progression_shape_valid
    and legacy_group_positions_unchanged
    and no_legacy_scores
    and no_existing_score_events
    and no_existing_rank_history
    and knockout_counts_valid
    and knockout_sources_valid
    and scopes_valid,
  'rollout_guard_fingerprints', (select to_jsonb(fingerprints) from fingerprints),
  'expected_rollout_guard_fingerprints', jsonb_build_object(
    'predictions', '8d76619fe4b44fdac17de1cc2afe5aaa',
    'ties', 'a4dcf183f5c48e3ba11ff75c59622598',
    'progression', '0d7bc491daa9b24013204d061a2d38f1'
  ),
  'group_details', (select jsonb_agg(to_jsonb(group_shapes) order by letter) from group_shapes),
  'tie_details', (select jsonb_agg(to_jsonb(tie_checks) order by scope, ordered_names) from tie_checks),
  'scope_anomalies', (select to_jsonb(anomalies) from anomalies),
  'existing_group_position_rows',
    (select count(*) from target t join public.predicted_group_positions pgp on pgp.entry_id = t.id)
) as production_preflight
from checks;