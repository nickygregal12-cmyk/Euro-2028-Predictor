begin;

-- Contract 46 preserves Home's existing most-recent-activity tie-break without
-- requiring any standings page to download the complete league membership.
drop function if exists public.get_my_leagues(uuid);

create function public.get_my_leagues(p_tournament_id uuid)
returns table (
  id uuid,
  name text,
  invite_code text,
  member_count integer,
  is_owner boolean,
  owner_name text,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    league.id,
    league.name,
    league.invite_code,
    (
      select count(*)::integer
      from public.league_members member_count
      where member_count.league_id = league.id
    ),
    (league.owner_id = (select auth.uid())) as is_owner,
    (
      select owner_profile.display_name
      from public.profiles owner_profile
      where owner_profile.id = league.owner_id
    ),
    (
      select max(activity_membership.joined_at)
      from public.league_members activity_membership
      where activity_membership.league_id = league.id
    ) as last_activity_at
  from public.leagues league
  join public.league_members own_membership
    on own_membership.league_id = league.id
   and own_membership.user_id = (select auth.uid())
  where league.tournament_id = p_tournament_id
  order by league.created_at, league.id
  limit 20;
$$;

revoke all on function public.get_my_leagues(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_leagues(uuid)
  to authenticated, service_role;

commit;
