-- Euro 2028 Predictor — Predictor Cup foundation
--
-- Contract 54 (ADR-0010, stage B7a of B7a–B7c). The structural half of the
-- Predictor Cup (docs/predictor-cup-rules.md): dedicated groups, members and
-- head-to-head fixtures, plus the audited close-and-draw operation that turns
-- a frozen field into groups and three matchdays of Cup fixtures. Scoring,
-- tables and knockouts follow in B7b/B7c.
--
-- Rules implemented here (§2, §3, §13.2 of the rules):
--   - the draw runs only after registration has closed, with at least six
--     entrants, exactly once;
--   - dynamic allocation: the smallest number of three-player groups
--     (remainder 1 → three, 2 → two, 3 → one), all others four-player;
--   - four-player groups play a full round robin over three matchdays;
--     three-player groups play two fixtures and one bye each (a bye is the
--     absence of a fixture, never a stored win);
--   - the three Cup matchdays are the competition's windows with sequences
--     1–3 — stored data, admin-adjustable (§7 of the architecture contract);
--   - TRANSPARENT, REPRODUCIBLE randomness: the caller supplies a publicly
--     announced seed; ordering is md5(seed || user_id), so anyone can
--     recompute the draw from the published seed and the frozen entrant
--     list. The seed and allocation are written to the immutable audit.
--   - neutral draw numbers (1..N in seeded order) are stored per member and
--     later serve the §5.2/§6.3 final tie-break.
--
-- The draw is a service-role-only operation for now (owner-run); the admin
-- surface arrives with the later Cup stages.

begin;

create table public.bonus_cup_groups (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null
    references public.bonus_competitions(id) on delete cascade,
  ordinal integer not null check (ordinal > 0),
  size smallint not null check (size in (3, 4)),
  created_at timestamptz not null default now(),
  unique (competition_id, ordinal)
);

create table public.bonus_cup_members (
  competition_id uuid not null,
  user_id uuid not null,
  group_id uuid not null references public.bonus_cup_groups(id) on delete cascade,
  draw_number integer not null check (draw_number > 0),
  created_at timestamptz not null default now(),
  primary key (competition_id, user_id),
  unique (competition_id, draw_number),
  -- RESTRICT: once drawn, an entrant row cannot silently vanish from under
  -- the Cup structure; withdrawal is refused below instead.
  foreign key (competition_id, user_id)
    references public.bonus_competition_entrants(competition_id, user_id)
    on delete restrict
);

create index bonus_cup_members_group_idx on public.bonus_cup_members (group_id);

create table public.bonus_cup_fixtures (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null
    references public.bonus_competitions(id) on delete cascade,
  stage text not null check (stage in ('group', 'playoff', 'knockout')),
  group_id uuid references public.bonus_cup_groups(id) on delete cascade,
  -- The scoring window (Cup matchday / knockout round). RESTRICT: a scheduled
  -- window cannot disappear from under drawn fixtures.
  window_id uuid not null
    references public.bonus_competition_windows(id) on delete restrict,
  matchday smallint check (matchday between 1 and 3),
  home_user_id uuid not null,
  away_user_id uuid not null,
  created_at timestamptz not null default now(),
  check (home_user_id <> away_user_id),
  constraint bonus_cup_fixtures_group_shape check (
    (stage = 'group' and group_id is not null and matchday is not null)
    or (stage <> 'group' and group_id is null and matchday is null)
  ),
  foreign key (competition_id, home_user_id)
    references public.bonus_competition_entrants(competition_id, user_id)
    on delete restrict,
  foreign key (competition_id, away_user_id)
    references public.bonus_competition_entrants(competition_id, user_id)
    on delete restrict
);

create index bonus_cup_fixtures_group_idx on public.bonus_cup_fixtures (group_id);
create index bonus_cup_fixtures_window_idx on public.bonus_cup_fixtures (window_id);

-- One Cup fixture per user per group matchday, either side of the tie.
create unique index bonus_cup_fixtures_home_once
  on public.bonus_cup_fixtures (competition_id, matchday, home_user_id)
  where stage = 'group';
create unique index bonus_cup_fixtures_away_once
  on public.bonus_cup_fixtures (competition_id, matchday, away_user_id)
  where stage = 'group';

alter table public.bonus_cup_groups enable row level security;
alter table public.bonus_cup_members enable row level security;
alter table public.bonus_cup_fixtures enable row level security;

revoke all on table public.bonus_cup_groups
  from public, anon, authenticated, service_role;
revoke all on table public.bonus_cup_members
  from public, anon, authenticated, service_role;
revoke all on table public.bonus_cup_fixtures
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The audited close-and-draw operation.
-- ---------------------------------------------------------------------------

create or replace function public.admin_draw_predictor_cup(
  p_competition_id uuid,
  p_seed text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_competition public.bonus_competitions%rowtype;
  v_entrant_count integer;
  v_threes integer;
  v_fours integer;
  v_group_count integer;
  v_window_ids uuid[];
  v_group_ids uuid[] := '{}';
  v_group_id uuid;
  v_members uuid[];
  g integer;
  v_size integer;
  v_taken integer := 0;
  v_fixture_count integer := 0;
begin
  if nullif(btrim(coalesce(p_seed, '')), '') is null
    or char_length(btrim(p_seed)) < 8 then
    raise exception 'A published draw seed of at least 8 characters is required'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_competition
    from public.bonus_competitions competition
    where competition.id = p_competition_id
    for update;

  if not found or v_competition.game_key <> 'predictor_cup' then
    raise exception 'Predictor Cup competition not found'
      using errcode = 'no_data_found';
  end if;

  if v_competition.registration_closes_at is null
    or now() < v_competition.registration_closes_at then
    raise exception 'The Cup field is still open — close registration first'
      using errcode = '55000';
  end if;

  if v_competition.draw_completed_at is not null
    or exists (select 1 from public.bonus_cup_groups grp
               where grp.competition_id = p_competition_id) then
    raise exception 'The Cup draw has already been made'
      using errcode = '55000';
  end if;

  select coalesce(array_agg(win.id order by win.sequence), '{}')
    into v_window_ids
    from public.bonus_competition_windows win
    where win.competition_id = p_competition_id
      and win.sequence between 1 and 3;

  if cardinality(v_window_ids) <> 3 then
    raise exception 'The three Cup matchday windows (sequences 1-3) must exist before the draw'
      using errcode = '55000';
  end if;

  -- The frozen field in seeded order: md5(seed || user_id) makes the draw
  -- reproducible from published inputs alone.
  select coalesce(array_agg(entrant.user_id
      order by md5(btrim(p_seed) || entrant.user_id::text), entrant.user_id), '{}')
    into v_members
    from public.bonus_competition_entrants entrant
    where entrant.competition_id = p_competition_id;

  v_entrant_count := cardinality(v_members);

  if v_entrant_count < 6 then
    raise exception 'The Cup needs at least six confirmed entrants (found %)',
      v_entrant_count
      using errcode = '55000';
  end if;

  v_threes := (4 - (v_entrant_count % 4)) % 4;
  v_fours := (v_entrant_count - 3 * v_threes) / 4;
  v_group_count := v_fours + v_threes;

  -- Neutral draw numbers follow the seeded order.
  for g in 1..v_group_count loop
    v_size := case when g <= v_fours then 4 else 3 end;

    insert into public.bonus_cup_groups (competition_id, ordinal, size)
    values (p_competition_id, g, v_size)
    returning id into strict v_group_id;
    v_group_ids := array_append(v_group_ids, v_group_id);

    insert into public.bonus_cup_members (competition_id, user_id, group_id, draw_number)
    select p_competition_id, v_members[v_taken + n], v_group_id, v_taken + n
    from generate_series(1, v_size) as n;

    -- Round robin over the three matchdays. Members a,b,c,d in seeded order:
    -- four-player: MD1 a-b c-d · MD2 a-c b-d · MD3 a-d b-c;
    -- three-player: MD1 a-b (c bye) · MD2 a-c (b bye) · MD3 b-c (a bye).
    if v_size = 4 then
      insert into public.bonus_cup_fixtures
        (competition_id, stage, group_id, window_id, matchday, home_user_id, away_user_id)
      values
        (p_competition_id, 'group', v_group_id, v_window_ids[1], 1, v_members[v_taken + 1], v_members[v_taken + 2]),
        (p_competition_id, 'group', v_group_id, v_window_ids[1], 1, v_members[v_taken + 3], v_members[v_taken + 4]),
        (p_competition_id, 'group', v_group_id, v_window_ids[2], 2, v_members[v_taken + 1], v_members[v_taken + 3]),
        (p_competition_id, 'group', v_group_id, v_window_ids[2], 2, v_members[v_taken + 2], v_members[v_taken + 4]),
        (p_competition_id, 'group', v_group_id, v_window_ids[3], 3, v_members[v_taken + 1], v_members[v_taken + 4]),
        (p_competition_id, 'group', v_group_id, v_window_ids[3], 3, v_members[v_taken + 2], v_members[v_taken + 3]);
      v_fixture_count := v_fixture_count + 6;
    else
      insert into public.bonus_cup_fixtures
        (competition_id, stage, group_id, window_id, matchday, home_user_id, away_user_id)
      values
        (p_competition_id, 'group', v_group_id, v_window_ids[1], 1, v_members[v_taken + 1], v_members[v_taken + 2]),
        (p_competition_id, 'group', v_group_id, v_window_ids[2], 2, v_members[v_taken + 1], v_members[v_taken + 3]),
        (p_competition_id, 'group', v_group_id, v_window_ids[3], 3, v_members[v_taken + 2], v_members[v_taken + 3]);
      v_fixture_count := v_fixture_count + 3;
    end if;

    v_taken := v_taken + v_size;
  end loop;

  update public.bonus_competitions competition
    set draw_completed_at = now(),
        updated_at = now()
    where competition.id = p_competition_id;

  insert into public.bonus_competition_audit (competition_id, action, detail)
  values (
    p_competition_id,
    'cup_drawn',
    jsonb_build_object(
      'seed', btrim(p_seed),
      'entrants', v_entrant_count,
      'groups', v_group_count,
      'three_player_groups', v_threes,
      'four_player_groups', v_fours,
      'fixtures', v_fixture_count
    )
  );

  return jsonb_build_object(
    'competition_id', p_competition_id,
    'entrants', v_entrant_count,
    'groups', v_group_count,
    'three_player_groups', v_threes,
    'four_player_groups', v_fours,
    'fixtures', v_fixture_count
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Bounded my-cup read: draw state, my group and my fixtures.
-- ---------------------------------------------------------------------------

create or replace function public.get_my_cup(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_competition public.bonus_competitions%rowtype;
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_competition
    from public.bonus_competitions competition
    where competition.tournament_id = p_tournament_id
      and competition.game_key = 'predictor_cup'
      and competition.published;

  if not found then
    raise exception 'The Predictor Cup is not available for this tournament'
      using errcode = 'no_data_found';
  end if;

  select member.group_id into v_group_id
    from public.bonus_cup_members member
    where member.competition_id = v_competition.id
      and member.user_id = v_uid;

  return jsonb_build_object(
    'server_now', now(),
    'competition_id', v_competition.id,
    'registration_closes_at', v_competition.registration_closes_at,
    'draw_completed_at', v_competition.draw_completed_at,
    'entrant', (
      select jsonb_build_object(
        'joined_at', entrant.joined_at,
        'outcome', entrant.outcome
      )
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition.id
        and entrant.user_id = v_uid
    ),
    'entrant_count', (
      select count(*)::integer
      from public.bonus_competition_entrants entrant
      where entrant.competition_id = v_competition.id
    ),
    'group_count', (
      select count(*)::integer
      from public.bonus_cup_groups grp
      where grp.competition_id = v_competition.id
    ),
    'my_group', case when v_group_id is null then null else (
      select jsonb_build_object(
        'ordinal', grp.ordinal,
        'size', grp.size,
        'members', (
          select jsonb_agg(
            jsonb_build_object(
              'user_id', member.user_id,
              'display_name', coalesce(profile.display_name, 'Player'),
              'draw_number', member.draw_number
            )
            order by member.draw_number
          )
          from public.bonus_cup_members member
          left join public.profiles profile on profile.id = member.user_id
          where member.group_id = grp.id
        )
      )
      from public.bonus_cup_groups grp
      where grp.id = v_group_id
    ) end,
    'my_fixtures', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'fixture_id', fixture.id,
            'stage', fixture.stage,
            'matchday', fixture.matchday,
            'window_label', win.label,
            'window_opens_at', win.opens_at,
            'window_locks_at', win.locks_at,
            'opponent', jsonb_build_object(
              'user_id', opponent.user_id,
              'display_name', coalesce(opponent_profile.display_name, 'Player')
            )
          )
          order by fixture.matchday nulls last, fixture.created_at
        )
        from public.bonus_cup_fixtures fixture
        join public.bonus_competition_windows win on win.id = fixture.window_id
        cross join lateral (
          select case when fixture.home_user_id = v_uid
            then fixture.away_user_id else fixture.home_user_id end as user_id
        ) opponent
        left join public.profiles opponent_profile
          on opponent_profile.id = opponent.user_id
        where fixture.competition_id = v_competition.id
          and v_uid in (fixture.home_user_id, fixture.away_user_id)
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- Withdrawal after the draw would tear a hole in the drawn structure: the
-- walkover rules (§9.3) handle absent players instead. Extends the contract-50
-- withdrawal with a friendly refusal ahead of the RESTRICT constraints.
create or replace function public.withdraw_bonus_competition(
  p_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_competition public.bonus_competitions%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select *
    into v_competition
    from public.bonus_competitions competition
    where competition.id = p_competition_id
    for update;

  if not found or not v_competition.published then
    raise exception 'Competition not found'
      using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1
    from public.bonus_competition_entrants entrant
    where entrant.competition_id = p_competition_id
      and entrant.user_id = v_uid
  ) then
    raise exception 'You have not entered this competition'
      using errcode = 'no_data_found';
  end if;

  if v_competition.completed_at is not null and now() >= v_competition.completed_at then
    raise exception 'This competition has finished'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.bonus_score_events event
    where event.competition_id = p_competition_id
      and event.user_id = v_uid
  ) then
    raise exception 'You cannot withdraw after scoring has started for you'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.bonus_cup_members member
    where member.competition_id = p_competition_id
      and member.user_id = v_uid
  ) then
    raise exception 'You cannot withdraw after the Cup draw — missed rounds become walkovers'
      using errcode = '55000';
  end if;

  delete from public.bonus_competition_entrants entrant
  where entrant.competition_id = p_competition_id
    and entrant.user_id = v_uid;

  insert into public.bonus_competition_audit (competition_id, action, detail, actor_id)
  values (
    p_competition_id,
    'entrant_withdrawn',
    jsonb_build_object('user_id', v_uid),
    v_uid
  );

  return jsonb_build_object(
    'competition_id', p_competition_id,
    'withdrawn', true
  );
end;
$$;

revoke all on function public.admin_draw_predictor_cup(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_my_cup(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.withdraw_bonus_competition(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_draw_predictor_cup(uuid, text)
  to service_role;
grant execute on function public.get_my_cup(uuid)
  to authenticated, service_role;
grant execute on function public.withdraw_bonus_competition(uuid)
  to authenticated, service_role;

commit;
