begin;

select plan(21);

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
-- Fixtures: a Cup with seven entrants → one four-player and one three-player
-- group, nine head-to-head fixtures over three matchday windows.
-- ---------------------------------------------------------------------------

select set_config(
  'test.cup_tournament_id',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'),
  true
);

set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  md5('cup-user-' || n)::uuid,
  format('cup-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 7) as n;

set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('cup-user-' || n)::uuid, format('Cup Player %s', n), now()
from generate_series(1, 7) as n;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at,
  registration_closes_at, draw_required
) values (
  md5('cup-comp')::uuid,
  current_setting('test.cup_tournament_id')::uuid,
  'predictor_cup', true,
  now() - interval '3 hours',
  now() + interval '1 hour',
  true
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select md5('cup-comp')::uuid, md5('cup-user-' || n)::uuid, now() - interval '2 hours'
from generate_series(1, 5) as n;

-- ---------------------------------------------------------------------------
-- Structure and access
-- ---------------------------------------------------------------------------

select has_function('public', 'admin_draw_predictor_cup', array['uuid', 'text'],
  'the audited Cup draw operation exists');
select has_function('public', 'get_my_cup', array['uuid'],
  'the bounded my-cup read exists');

select is(
  (
    select count(*)::integer
    from information_schema.role_routine_grants
    where routine_schema = 'public'
      and routine_name = 'admin_draw_predictor_cup'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0,
  'the draw is not executable by any browser role'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.get_my_cup(%L::uuid) $sql$,
      current_setting('test.cup_tournament_id')
    )
  ),
  '42501',
  'the my-cup read requires an authenticated user'
);

-- ---------------------------------------------------------------------------
-- Draw preconditions, in order
-- ---------------------------------------------------------------------------

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.admin_draw_predictor_cup(%L::uuid, 'tiny') $sql$,
      md5('cup-comp')
    )
  ),
  '22023',
  'a published seed of at least eight characters is required'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.admin_draw_predictor_cup(%L::uuid, 'EURO2028-DRAW-SEED-1') $sql$,
      md5('cup-comp')
    )
  ),
  '55000',
  'the draw refuses while the field is still open'
);

update public.bonus_competitions
set registration_closes_at = now() - interval '5 minutes'
where id = md5('cup-comp')::uuid;

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.admin_draw_predictor_cup(%L::uuid, 'EURO2028-DRAW-SEED-1') $sql$,
      md5('cup-comp')
    )
  ),
  '55000',
  'the draw refuses a field below six entrants'
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select md5('cup-comp')::uuid, md5('cup-user-' || n)::uuid, now() - interval '2 hours'
from generate_series(6, 7) as n;

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.admin_draw_predictor_cup(%L::uuid, 'EURO2028-DRAW-SEED-1') $sql$,
      md5('cup-comp')
    )
  ),
  '55000',
  'the draw refuses until the three matchday windows exist'
);

insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
values
  (md5('cup-w1')::uuid, md5('cup-comp')::uuid, 1, 'Cup Matchday 1', now() + interval '1 hour', now() + interval '1 day'),
  (md5('cup-w2')::uuid, md5('cup-comp')::uuid, 2, 'Cup Matchday 2', now() + interval '2 days', now() + interval '3 days'),
  (md5('cup-w3')::uuid, md5('cup-comp')::uuid, 3, 'Cup Matchday 3', now() + interval '4 days', now() + interval '5 days');

-- ---------------------------------------------------------------------------
-- The draw itself
-- ---------------------------------------------------------------------------

select is(
  (
    select public.admin_draw_predictor_cup(md5('cup-comp')::uuid, 'EURO2028-DRAW-SEED-1')
      - 'competition_id'
  ),
  jsonb_build_object(
    'entrants', 7,
    'groups', 2,
    'three_player_groups', 1,
    'four_player_groups', 1,
    'fixtures', 9
  ),
  'seven entrants draw into one four-player and one three-player group'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.admin_draw_predictor_cup(%L::uuid, 'EURO2028-DRAW-SEED-2') $sql$,
      md5('cup-comp')
    )
  ),
  '55000',
  'the draw runs exactly once'
);

select is(
  (
    select jsonb_agg(grp.size order by grp.ordinal)
    from public.bonus_cup_groups grp
    where grp.competition_id = md5('cup-comp')::uuid
  ),
  '[4, 3]'::jsonb,
  'four-player groups come first, three-player groups last'
);

select is(
  (
    select jsonb_build_object(
      'members', count(*)::integer,
      'distinct_numbers', count(distinct member.draw_number)::integer,
      'number_sum', sum(member.draw_number)::integer
    )
    from public.bonus_cup_members member
    where member.competition_id = md5('cup-comp')::uuid
  ),
  '{"members": 7, "distinct_numbers": 7, "number_sum": 28}'::jsonb,
  'every entrant holds a unique neutral draw number 1..7'
);

select is(
  (
    select jsonb_agg(counts.fixture_count order by counts.matchday)
    from (
      select fixture.matchday, count(*)::integer as fixture_count
      from public.bonus_cup_fixtures fixture
      where fixture.competition_id = md5('cup-comp')::uuid
      group by fixture.matchday
    ) counts
  ),
  '[3, 3, 3]'::jsonb,
  'three fixtures per matchday across the two groups'
);

select is(
  (
    select count(*)::integer
    from public.bonus_cup_fixtures fixture
    join public.bonus_competition_windows win on win.id = fixture.window_id
    where fixture.competition_id = md5('cup-comp')::uuid
      and win.sequence <> fixture.matchday
  ),
  0,
  'every Cup fixture scores in its own matchday window'
);

select is(
  (
    select member.draw_number
    from public.bonus_cup_members member
    where member.competition_id = md5('cup-comp')::uuid
      and member.user_id = (
        select entrant.user_id
        from public.bonus_competition_entrants entrant
        where entrant.competition_id = md5('cup-comp')::uuid
        order by md5('EURO2028-DRAW-SEED-1' || entrant.user_id::text), entrant.user_id
        limit 1
      )
  ),
  1,
  'the draw is reproducible from the published seed and entrant list'
);

select is(
  (
    select count(*)::integer
    from public.bonus_cup_members member
    join public.bonus_cup_groups grp on grp.id = member.group_id
    left join (
      select side.user_id, count(*)::integer as fixture_count
      from (
        select fixture.home_user_id as user_id from public.bonus_cup_fixtures fixture
        where fixture.competition_id = md5('cup-comp')::uuid
        union all
        select fixture.away_user_id from public.bonus_cup_fixtures fixture
        where fixture.competition_id = md5('cup-comp')::uuid
      ) side
      group by side.user_id
    ) played on played.user_id = member.user_id
    where member.competition_id = md5('cup-comp')::uuid
      and coalesce(played.fixture_count, 0)
        <> case when grp.size = 4 then 3 else 2 end
  ),
  0,
  'four-player members play three ties; three-player members play two with a bye'
);

-- ---------------------------------------------------------------------------
-- The my-cup read and post-draw boundaries
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', md5('cup-user-1'), true);
set local role authenticated;

select ok(
  (
    select (payload -> 'my_group' ->> 'size')::integer in (3, 4)
      and jsonb_array_length(payload -> 'my_group' -> 'members')
        = (payload -> 'my_group' ->> 'size')::integer
      and jsonb_array_length(payload -> 'my_fixtures')
        = case when (payload -> 'my_group' ->> 'size')::integer = 4 then 3 else 2 end
      and payload ->> 'draw_completed_at' is not null
      and (payload -> 'group_count')::integer = 2
    from public.get_my_cup(current_setting('test.cup_tournament_id')::uuid) payload
  ),
  'the my-cup read returns the drawn group, its members and the caller''s ties'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ select public.withdraw_bonus_competition(%L::uuid) $sql$,
      md5('cup-comp')
    )
  ),
  '55000',
  'withdrawal is refused once the draw has been made'
);

reset role;

select is(
  (
    select audit.detail ->> 'seed'
    from public.bonus_competition_audit audit
    where audit.competition_id = md5('cup-comp')::uuid
      and audit.action = 'cup_drawn'
  ),
  'EURO2028-DRAW-SEED-1',
  'the draw writes its published seed to the immutable audit'
);

select isnt(
  (
    select competition.draw_completed_at
    from public.bonus_competitions competition
    where competition.id = md5('cup-comp')::uuid
  ),
  null,
  'the competition records its draw completion instant'
);

select is(
  pg_temp.capture_sqlstate(
    format(
      $sql$ delete from public.bonus_competition_entrants
        where competition_id = %L::uuid and user_id = %L::uuid $sql$,
      md5('cup-comp'), md5('cup-user-3')
    )
  ),
  '23503',
  'a drawn entrant row cannot vanish from under the Cup structure'
);

select * from finish();
rollback;
