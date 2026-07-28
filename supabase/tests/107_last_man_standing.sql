begin;

select plan(23);

create or replace function pg_temp.capture_sqlstate(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures. Two rounds: Matchday 1 (two group fixtures) and a final knockout
-- round (one staged R16 tie). Five entrants and one outsider:
--   alpha: picks the MD1 winner, then the R16 winner      → champion path
--   beta:  picks the MD1 loser                            → eliminated
--   gamma: never picks                                    → eliminated
--   delta: picks a team that draws                        → eliminated (draw kills)
--   echo:  never picks                                    → eliminated
--   xray:  not an entrant                                 → cannot pick
-- ---------------------------------------------------------------------------

select set_config(
  'test.lms_tournament_id',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'),
  true
);

select set_config(
  'test.lms_m1',
  (select m.id::text from public.matches m
    where m.tournament_id = current_setting('test.lms_tournament_id')::uuid
      and m.round = 'group' and m.matchday = 1
    order by m.match_ref limit 1),
  true
);

select set_config(
  'test.lms_m2',
  (select m.id::text from public.matches m
    where m.tournament_id = current_setting('test.lms_tournament_id')::uuid
      and m.round = 'group' and m.matchday = 1
    order by m.match_ref offset 1 limit 1),
  true
);

select set_config(
  'test.lms_r16',
  (select m.id::text from public.matches m
    where m.tournament_id = current_setting('test.lms_tournament_id')::uuid
      and m.round = 'r16'
    order by m.match_ref limit 1),
  true
);

select set_config('test.lms_m1_home',
  (select m.home_team_id::text from public.matches m where m.id = current_setting('test.lms_m1')::uuid), true);
select set_config('test.lms_m1_away',
  (select m.away_team_id::text from public.matches m where m.id = current_setting('test.lms_m1')::uuid), true);
select set_config('test.lms_m2_home',
  (select m.home_team_id::text from public.matches m where m.id = current_setting('test.lms_m2')::uuid), true);

-- A team from a different group: not in either MD1 fixture of this test.
select set_config(
  'test.lms_outsider_team',
  (
    select t.id::text from public.teams t
    where t.tournament_id = current_setting('test.lms_tournament_id')::uuid
      and t.id not in (
        select m.home_team_id from public.matches m where m.id = current_setting('test.lms_m1')::uuid
        union all
        select m.away_team_id from public.matches m where m.id = current_setting('test.lms_m1')::uuid
        union all
        select m.home_team_id from public.matches m where m.id = current_setting('test.lms_m2')::uuid
        union all
        select m.away_team_id from public.matches m where m.id = current_setting('test.lms_m2')::uuid
      )
    order by t.name limit 1
  ),
  true
);

set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  md5('lms-user-' || fixture.name)::uuid,
  format('lms-%s@example.test', fixture.name),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from (values ('alpha'), ('beta'), ('gamma'), ('delta'), ('echo'), ('xray')) as fixture(name);

-- Stage the final knockout tie: MD1 winner-to-be at home, the drawn team away.
update public.matches
set home_team_id = current_setting('test.lms_m1_home')::uuid,
    away_team_id = current_setting('test.lms_m2_home')::uuid,
    kickoff_at = now() - interval '30 minutes'
where id = current_setting('test.lms_r16')::uuid;

set local session_replication_role = origin;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at
) values (
  md5('lms-comp')::uuid,
  current_setting('test.lms_tournament_id')::uuid,
  'last_man_standing', true, now() - interval '3 hours'
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select md5('lms-comp')::uuid, md5('lms-user-' || fixture.name)::uuid, now() - interval '2 hours'
from (values ('alpha'), ('beta'), ('gamma'), ('delta'), ('echo')) as fixture(name);

insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
values
  (md5('lms-w1')::uuid, md5('lms-comp')::uuid, 1, 'Matchday 1',
    now() - interval '2 hours', now() + interval '1 hour'),
  (md5('lms-w2')::uuid, md5('lms-comp')::uuid, 2, 'Round of 16',
    now() - interval '2 hours', now() + interval '1 hour');

insert into public.bonus_window_fixtures (window_id, match_id) values
  (md5('lms-w1')::uuid, current_setting('test.lms_m1')::uuid),
  (md5('lms-w1')::uuid, current_setting('test.lms_m2')::uuid),
  (md5('lms-w2')::uuid, current_setting('test.lms_r16')::uuid);

-- ---------------------------------------------------------------------------
-- Structure and closed execution
-- ---------------------------------------------------------------------------

select has_function('public', 'save_lms_selection', array['uuid', 'uuid', 'integer'],
  'the LMS pick RPC exists');
select has_function('public', 'get_my_lms', array['uuid'],
  'the bounded LMS read exists');
select has_function('predictor_internal', 'recompute_lms_for_tournament', array['uuid'],
  'the LMS survival re-derivation exists');

select is(
  (
    select count(*)::integer
    from information_schema.role_routine_grants
    where routine_schema = 'public'
      and routine_name in ('save_lms_selection', 'get_my_lms')
      and grantee in ('PUBLIC', 'anon')
  ),
  0,
  'anonymous callers hold no LMS execution'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.save_lms_selection(%L::uuid, %L::uuid, null) $sql$,
      md5('lms-w1'), current_setting('test.lms_m1_home')
    )
  ),
  '42501',
  'picking requires an authenticated user'
);

-- ---------------------------------------------------------------------------
-- Picking
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', md5('lms-user-xray'), true);
set local role authenticated;

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.save_lms_selection(%L::uuid, %L::uuid, null) $sql$,
      md5('lms-w1'), current_setting('test.lms_m1_home')
    )
  ),
  '42501',
  'a non-entrant cannot pick'
);

reset role;
select set_config('request.jwt.claim.sub', md5('lms-user-alpha'), true);
set local role authenticated;

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.save_lms_selection(%L::uuid, %L::uuid, null) $sql$,
      md5('lms-w1'), current_setting('test.lms_outsider_team')
    )
  ),
  '23514',
  'a team outside the round''s fixtures is refused'
);

select is(
  (
    select public.save_lms_selection(
      md5('lms-w1')::uuid, current_setting('test.lms_m1_away')::uuid, null
    ) ->> 'version'
  ),
  '0',
  'a valid pick saves at version 0'
);

select is(
  (
    select public.save_lms_selection(
      md5('lms-w1')::uuid, current_setting('test.lms_m1_home')::uuid, 0
    ) ->> 'version'
  ),
  '1',
  'the pick can change until the round deadline'
);

select is(
  (
    select jsonb_build_object(
      'entrants', payload -> 'entrant_count',
      'remaining', payload -> 'remaining_count',
      'w1_team', payload -> 'windows' -> 0 -> 'my_selection' ->> 'team_id'
    )
    from public.get_my_lms(current_setting('test.lms_tournament_id')::uuid) payload
  ),
  jsonb_build_object(
    'entrants', 5,
    'remaining', 5,
    'w1_team', current_setting('test.lms_m1_home')
  ),
  'the bounded read returns entrant counts and the caller''s own pick'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.save_lms_selection(%L::uuid, %L::uuid, null) $sql$,
      md5('lms-w2'), current_setting('test.lms_m1_home')
    )
  ),
  '23505',
  'each team can be used only once per competition'
);

select is(
  (
    select public.save_lms_selection(
      md5('lms-w2')::uuid, current_setting('test.lms_m2_home')::uuid, null
    ) ->> 'version'
  ),
  '0',
  'a fresh team is accepted for the next round'
);

reset role;

-- Rivals' picks staged directly (the shape trigger still validates them).
insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id) values
  (md5('lms-comp')::uuid, md5('lms-user-beta')::uuid, md5('lms-w1')::uuid,
    current_setting('test.lms_m1_away')::uuid),
  (md5('lms-comp')::uuid, md5('lms-user-delta')::uuid, md5('lms-w1')::uuid,
    current_setting('test.lms_m2_home')::uuid);

-- Matchday 1 reaches its deadline.
update public.bonus_competition_windows
set locks_at = now() - interval '30 minutes'
where id = md5('lms-w1')::uuid;

select set_config('request.jwt.claim.sub', md5('lms-user-alpha'), true);
set local role authenticated;

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.save_lms_selection(%L::uuid, %L::uuid, 1) $sql$,
      md5('lms-w1'), current_setting('test.lms_m1_away')
    )
  ),
  '23514',
  'a locked round refuses pick changes'
);

reset role;

-- ---------------------------------------------------------------------------
-- Resolution through the single result operation
-- ---------------------------------------------------------------------------

select public.confirm_match_result(
  current_setting('test.lms_m1')::uuid, 'regulation', 2::smallint, 0::smallint
);

select is(
  (
    select entrant.outcome from public.bonus_competition_entrants entrant
    where entrant.competition_id = md5('lms-comp')::uuid
      and entrant.user_id = md5('lms-user-alpha')::uuid
  ),
  'active',
  'a partially confirmed round decides nothing'
);

select public.confirm_match_result(
  current_setting('test.lms_m2')::uuid, 'regulation', 1::smallint, 1::smallint
);

select is(
  (
    select entrant.outcome from public.bonus_competition_entrants entrant
    where entrant.competition_id = md5('lms-comp')::uuid
      and entrant.user_id = md5('lms-user-alpha')::uuid
  ),
  'survived',
  'a winning pick survives the settled round'
);

select is(
  (
    select entrant.outcome from public.bonus_competition_entrants entrant
    where entrant.competition_id = md5('lms-comp')::uuid
      and entrant.user_id = md5('lms-user-beta')::uuid
  ),
  'eliminated',
  'a losing pick is eliminated'
);

select is(
  (
    select entrant.outcome from public.bonus_competition_entrants entrant
    where entrant.competition_id = md5('lms-comp')::uuid
      and entrant.user_id = md5('lms-user-gamma')::uuid
  ),
  'eliminated',
  'missing the deadline eliminates'
);

select is(
  (
    select entrant.outcome from public.bonus_competition_entrants entrant
    where entrant.competition_id = md5('lms-comp')::uuid
      and entrant.user_id = md5('lms-user-delta')::uuid
  ),
  'eliminated',
  'a draw eliminates in the group stage'
);

select set_config('request.jwt.claim.sub', md5('lms-user-alpha'), true);
set local role authenticated;

select is(
  (
    select payload -> 'remaining_count'
    from public.get_my_lms(current_setting('test.lms_tournament_id')::uuid) payload
  ),
  '1'::jsonb,
  'the read reports the surviving field'
);

reset role;

-- The final round reaches its deadline, then its tie is confirmed: the away
-- side wins in regulation, so alpha''s pick advances.
update public.bonus_competition_windows
set locks_at = now() - interval '1 minute'
where id = md5('lms-w2')::uuid;

select public.confirm_match_result(
  current_setting('test.lms_r16')::uuid, 'regulation', 0::smallint, 1::smallint
);

select is(
  (
    select entrant.outcome from public.bonus_competition_entrants entrant
    where entrant.competition_id = md5('lms-comp')::uuid
      and entrant.user_id = md5('lms-user-alpha')::uuid
  ),
  'champion',
  'surviving the final settled round crowns the champion'
);

-- ---------------------------------------------------------------------------
-- Correction re-derives everything, including the wipeout-void rule
-- ---------------------------------------------------------------------------

select public.correct_match_result(
  current_setting('test.lms_m1')::uuid, 'regulation', 0::smallint, 2::smallint,
  null, null, null, null, 'Scoreline was entered the wrong way round'
);

select is(
  (
    select jsonb_build_object(
      'alpha', (select e.outcome from public.bonus_competition_entrants e
        where e.competition_id = md5('lms-comp')::uuid and e.user_id = md5('lms-user-alpha')::uuid),
      'beta', (select e.outcome from public.bonus_competition_entrants e
        where e.competition_id = md5('lms-comp')::uuid and e.user_id = md5('lms-user-beta')::uuid)
    )
  ),
  '{"alpha": "eliminated", "beta": "champion"}'::jsonb,
  'a correction re-derives survival: beta survives MD1, is carried through the final by the wipeout-void rule, and takes the crown'
);

select ok(
  (
    select count(*) > 0 from public.bonus_competition_audit audit
    where audit.competition_id = md5('lms-comp')::uuid
      and audit.action = 'lms_resolved'
  ),
  'survival resolutions append audit entries'
);

select set_config('request.jwt.claim.sub', md5('lms-user-alpha'), true);
set local role authenticated;

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.get_my_lms(%L::uuid) $sql$,
      md5('lms-no-such-tournament')
    )
  ),
  'P0002',
  'an unknown tournament reads as not found'
);

reset role;

select * from finish();
rollback;
