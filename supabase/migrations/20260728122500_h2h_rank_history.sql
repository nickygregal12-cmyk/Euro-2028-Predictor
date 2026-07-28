-- Euro 2028 Predictor — bounded H2H rank history
--
-- Contract 48. Routes rank-history comparison through a post-lock co-member
-- RPC, removes browser direct-table access, and hardens checkpoint capture.

begin;

create or replace function public.capture_rank_history(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select * from (values
      ('MD1'::text,  1::smallint, 'group'::text, 1::smallint),
      ('MD2',        2,           'group',       2),
      ('MD3',        3,           'group',       3),
      ('R16',        4,           'r16',         null::smallint),
      ('QF',         5,           'qf',          null),
      ('SF',         6,           'sf',          null),
      ('FINAL',      7,           'final',       null)
    ) as t(key, ord, round, md)
  loop
    if (
      select count(*) > 0
         and count(*) = count(*) filter (where match.home_score is not null)
      from public.matches match
      where match.tournament_id = p_tournament_id
        and match.round = r.round
        and (r.md is null or match.matchday = r.md)
    ) then
      insert into public.rank_history
        (user_id, tournament_id, matchday_key, matchday_ord, rank, total_points)
      select
        ranked.user_id,
        p_tournament_id,
        r.key,
        r.ord,
        ranked.rank,
        ranked.total_points
      from (
        select
          entry.user_id,
          coalesce(total.total_points, 0)::integer as total_points,
          rank() over (
            order by coalesce(total.total_points, 0) desc
          )::integer as rank
        from public.entries entry
        left join public.entry_totals total on total.entry_id = entry.id
        where entry.tournament_id = p_tournament_id
          and entry.submitted_at is not null
      ) ranked
      on conflict (user_id, tournament_id, matchday_key) do nothing;
    end if;
  end loop;
end;
$$;

revoke all on function public.capture_rank_history(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.capture_rank_history(uuid)
  to service_role;

-- Rank history is no longer a browser table. RLS remains as defence in depth;
-- application reads use the bounded RPC below.
revoke all on table public.rank_history from anon, authenticated;

create or replace function public.get_h2h_rank_history(
  p_rival_id uuid,
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
  v_lock_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select tournament.lock_at
    into v_lock_at
    from public.tournaments tournament
    where tournament.id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found'
      using errcode = 'no_data_found';
  end if;

  if v_lock_at is null or now() < v_lock_at then
    raise exception 'Head-to-head rank history is hidden until entries lock'
      using errcode = 'insufficient_privilege';
  end if;

  if p_rival_id <> v_uid and not exists (
    select 1
    from public.league_members caller_membership
    join public.leagues league
      on league.id = caller_membership.league_id
     and league.tournament_id = p_tournament_id
    join public.league_members rival_membership
      on rival_membership.league_id = caller_membership.league_id
     and rival_membership.user_id = p_rival_id
    where caller_membership.user_id = v_uid
  ) then
    raise exception 'You can only compare rank history with players in your leagues'
      using errcode = 'insufficient_privilege';
  end if;

  return jsonb_build_object(
    'you', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key', bounded.matchday_key,
            'order', bounded.matchday_ord,
            'rank', bounded.rank,
            'total_points', bounded.total_points,
            'captured_at', bounded.captured_at
          )
          order by bounded.matchday_ord
        )
        from (
          select
            history.matchday_key,
            history.matchday_ord,
            history.rank,
            history.total_points,
            history.captured_at
          from public.rank_history history
          where history.user_id = v_uid
            and history.tournament_id = p_tournament_id
          order by history.matchday_ord
          limit 7
        ) bounded
      ),
      '[]'::jsonb
    ),
    'rival', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key', bounded.matchday_key,
            'order', bounded.matchday_ord,
            'rank', bounded.rank,
            'total_points', bounded.total_points,
            'captured_at', bounded.captured_at
          )
          order by bounded.matchday_ord
        )
        from (
          select
            history.matchday_key,
            history.matchday_ord,
            history.rank,
            history.total_points,
            history.captured_at
          from public.rank_history history
          where history.user_id = p_rival_id
            and history.tournament_id = p_tournament_id
          order by history.matchday_ord
          limit 7
        ) bounded
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.get_h2h_rank_history(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_h2h_rank_history(uuid, uuid)
  to authenticated, service_role;

commit;
