-- Euro 2028 Predictor — DATA-003 authoritative reference integrity
--
-- User-owned prediction rows already have dedicated same-tournament validation.
-- This migration closes the remaining authoritative/reference gaps without
-- denormalising child tables with copied tournament_id columns.

begin;

-- Refuse to install the guards over inconsistent existing data. This keeps the
-- migration additive and fail-closed rather than silently grandfathering rows
-- that violate the intended tournament boundary.
do $$
begin
  if exists (
    select 1
    from public.group_teams gt
    join public.groups g on g.id = gt.group_id
    join public.teams t on t.id = gt.team_id
    where g.tournament_id <> t.tournament_id
  ) then
    raise exception 'group_teams contains cross-tournament references'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.matches m
    left join public.groups g on g.id = m.group_id
    left join public.teams home on home.id = m.home_team_id
    left join public.teams away on away.id = m.away_team_id
    left join public.teams winner on winner.id = m.winner_team_id
    where (m.group_id is not null and g.tournament_id is distinct from m.tournament_id)
       or (m.home_team_id is not null and home.tournament_id is distinct from m.tournament_id)
       or (m.away_team_id is not null and away.tournament_id is distinct from m.tournament_id)
       or (m.winner_team_id is not null and winner.tournament_id is distinct from m.tournament_id)
  ) then
    raise exception 'matches contains cross-tournament references'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.players p
    join public.teams t on t.id = p.team_id
    where p.tournament_id <> t.tournament_id
  ) then
    raise exception 'players contains cross-tournament team references'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.match_result_revisions r
    join public.matches m on m.id = r.match_id
    where r.tournament_id <> m.tournament_id
  ) then
    raise exception 'match_result_revisions contains cross-tournament references'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.tournaments tr
    join public.players p on p.id = tr.golden_boot_player_id
    where tr.golden_boot_player_id is not null
      and p.tournament_id <> tr.id
  ) then
    raise exception 'tournaments contains a cross-tournament Golden Boot player'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.score_events se
    join public.entries e on e.id = se.entry_id
    left join public.matches m on m.id = se.match_id
    left join public.teams t on t.id = se.team_id
    where (se.match_id is not null and m.tournament_id is distinct from e.tournament_id)
       or (se.team_id is not null and t.tournament_id is distinct from e.tournament_id)
  ) then
    raise exception 'score_events contains cross-tournament references'
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function predictor_internal.validate_group_team_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_tournament uuid;
  v_team_tournament uuid;
begin
  select tournament_id into v_group_tournament
  from public.groups where id = new.group_id;

  select tournament_id into v_team_tournament
  from public.teams where id = new.team_id;

  if v_group_tournament is null or v_team_tournament is null then
    raise exception 'Group-team assignment references a missing group or team'
      using errcode = 'foreign_key_violation';
  end if;

  if v_group_tournament <> v_team_tournament then
    raise exception 'Group and team must belong to the same tournament'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function predictor_internal.validate_match_reference_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference_tournament uuid;
begin
  if new.group_id is not null then
    select tournament_id into v_reference_tournament
    from public.groups where id = new.group_id;
    if v_reference_tournament is null then
      raise exception 'Match references a missing group'
        using errcode = 'foreign_key_violation';
    end if;
    if v_reference_tournament <> new.tournament_id then
      raise exception 'Match group must belong to the match tournament'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.home_team_id is not null then
    select tournament_id into v_reference_tournament
    from public.teams where id = new.home_team_id;
    if v_reference_tournament is null then
      raise exception 'Match references a missing home team'
        using errcode = 'foreign_key_violation';
    end if;
    if v_reference_tournament <> new.tournament_id then
      raise exception 'Home team must belong to the match tournament'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.away_team_id is not null then
    select tournament_id into v_reference_tournament
    from public.teams where id = new.away_team_id;
    if v_reference_tournament is null then
      raise exception 'Match references a missing away team'
        using errcode = 'foreign_key_violation';
    end if;
    if v_reference_tournament <> new.tournament_id then
      raise exception 'Away team must belong to the match tournament'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.winner_team_id is not null then
    select tournament_id into v_reference_tournament
    from public.teams where id = new.winner_team_id;
    if v_reference_tournament is null then
      raise exception 'Match references a missing winner team'
        using errcode = 'foreign_key_violation';
    end if;
    if v_reference_tournament <> new.tournament_id then
      raise exception 'Winner team must belong to the match tournament'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create or replace function predictor_internal.validate_player_team_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_tournament uuid;
begin
  select tournament_id into v_team_tournament
  from public.teams where id = new.team_id;

  if v_team_tournament is null then
    raise exception 'Player references a missing team'
      using errcode = 'foreign_key_violation';
  end if;

  if v_team_tournament <> new.tournament_id then
    raise exception 'Player team must belong to the player tournament'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function predictor_internal.validate_result_revision_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match_tournament uuid;
begin
  select tournament_id into v_match_tournament
  from public.matches where id = new.match_id;

  if v_match_tournament is null then
    raise exception 'Result revision references a missing match'
      using errcode = 'foreign_key_violation';
  end if;

  if v_match_tournament <> new.tournament_id then
    raise exception 'Result revision tournament must match its match tournament'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function predictor_internal.validate_tournament_award_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_tournament uuid;
begin
  if new.golden_boot_player_id is null then
    return new;
  end if;

  select tournament_id into v_player_tournament
  from public.players where id = new.golden_boot_player_id;

  if v_player_tournament is null then
    raise exception 'Tournament award references a missing player'
      using errcode = 'foreign_key_violation';
  end if;

  if v_player_tournament <> new.id then
    raise exception 'Golden Boot player must belong to the tournament'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function predictor_internal.validate_score_event_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry_tournament uuid;
  v_reference_tournament uuid;
begin
  select tournament_id into v_entry_tournament
  from public.entries where id = new.entry_id;

  if v_entry_tournament is null then
    raise exception 'Score event references a missing entry'
      using errcode = 'foreign_key_violation';
  end if;

  if new.match_id is not null then
    select tournament_id into v_reference_tournament
    from public.matches where id = new.match_id;
    if v_reference_tournament is null then
      raise exception 'Score event references a missing match'
        using errcode = 'foreign_key_violation';
    end if;
    if v_reference_tournament <> v_entry_tournament then
      raise exception 'Score event match must belong to the entry tournament'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.team_id is not null then
    select tournament_id into v_reference_tournament
    from public.teams where id = new.team_id;
    if v_reference_tournament is null then
      raise exception 'Score event references a missing team'
        using errcode = 'foreign_key_violation';
    end if;
    if v_reference_tournament <> v_entry_tournament then
      raise exception 'Score event team must belong to the entry tournament'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.validate_group_team_scope()
  from public, anon, authenticated;
revoke all on function predictor_internal.validate_match_reference_scope()
  from public, anon, authenticated;
revoke all on function predictor_internal.validate_player_team_scope()
  from public, anon, authenticated;
revoke all on function predictor_internal.validate_result_revision_scope()
  from public, anon, authenticated;
revoke all on function predictor_internal.validate_tournament_award_scope()
  from public, anon, authenticated;
revoke all on function predictor_internal.validate_score_event_scope()
  from public, anon, authenticated;

drop trigger if exists validate_group_team_scope on public.group_teams;
create trigger validate_group_team_scope
  before insert or update of group_id, team_id
  on public.group_teams
  for each row execute function predictor_internal.validate_group_team_scope();

drop trigger if exists validate_match_reference_scope on public.matches;
create trigger validate_match_reference_scope
  before insert or update of tournament_id, group_id, home_team_id, away_team_id, winner_team_id
  on public.matches
  for each row execute function predictor_internal.validate_match_reference_scope();

drop trigger if exists validate_player_team_scope on public.players;
create trigger validate_player_team_scope
  before insert or update of tournament_id, team_id
  on public.players
  for each row execute function predictor_internal.validate_player_team_scope();

drop trigger if exists validate_result_revision_scope on public.match_result_revisions;
create trigger validate_result_revision_scope
  before insert or update of tournament_id, match_id
  on public.match_result_revisions
  for each row execute function predictor_internal.validate_result_revision_scope();

drop trigger if exists validate_tournament_award_scope on public.tournaments;
create trigger validate_tournament_award_scope
  before insert or update of golden_boot_player_id
  on public.tournaments
  for each row execute function predictor_internal.validate_tournament_award_scope();

drop trigger if exists validate_score_event_scope on public.score_events;
create trigger validate_score_event_scope
  before insert or update of entry_id, match_id, team_id
  on public.score_events
  for each row execute function predictor_internal.validate_score_event_scope();

commit;
