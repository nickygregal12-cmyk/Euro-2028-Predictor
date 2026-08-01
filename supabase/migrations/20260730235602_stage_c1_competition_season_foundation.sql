-- Stage C1 competition-season foundation.
--
-- C1 only: this migration deliberately preserves the complete auth-owned model,
-- ownership policies and account-deletion before-state governed by issue #272.

create or replace function predictor_internal.competition_slug(
  p_name text,
  p_year smallint
)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        lower(
          case
            when btrim(p_name) = 'UEFA Euro 2028' then 'uefa-euro'
            else regexp_replace(btrim(p_name), '\s+[0-9]{4}(?:-[0-9]{2})?$', '')
          end
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      )),
      ''
    ),
    'competition-' || p_year::text
  );
$$;

create or replace function predictor_internal.competition_name(
  p_name text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when btrim(p_name) = 'UEFA Euro 2028' then 'UEFA European Championship'
    else coalesce(
      nullif(regexp_replace(btrim(p_name), '\s+[0-9]{4}(?:-[0-9]{2})?$', ''), ''),
      btrim(p_name)
    )
  end;
$$;

create or replace function predictor_internal.is_valid_timezone(
  p_timezone text
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_timezone is not null
    and exists (
      select 1
      from pg_catalog.pg_timezone_names
      where name = p_timezone
    );
$$;

revoke all on function predictor_internal.competition_slug(text, smallint) from public;
revoke all on function predictor_internal.competition_name(text) from public;
revoke all on function predictor_internal.is_valid_timezone(text) from public;

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sport text not null default 'football',
  created_at timestamptz not null default now(),
  constraint competitions_slug_shape
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint competitions_name_length
    check (char_length(btrim(name)) between 1 and 120),
  constraint competitions_sport_allowed
    check (sport = 'football')
);

alter table public.competitions enable row level security;
revoke all on table public.competitions from public, anon, authenticated;

alter table public.tournaments
  add column competition_id uuid,
  add column season_key text,
  add column kind text,
  add column display_timezone text,
  add column status text;

insert into public.competitions (slug, name)
select distinct
  predictor_internal.competition_slug(t.name, t.year),
  predictor_internal.competition_name(t.name)
from public.tournaments t
on conflict (slug) do nothing;

update public.tournaments t
set competition_id = c.id,
    season_key = t.year::text,
    kind = 'tournament',
    display_timezone = case
      when t.name = 'UEFA Euro 2028' then 'Europe/London'
      else 'UTC'
    end,
    status = case
      when t.ends_on is not null and t.ends_on < current_date then 'complete'
      when t.starts_on is not null and t.starts_on > current_date then 'scheduled'
      when t.starts_on is not null
       and t.ends_on is not null
       and current_date between t.starts_on and t.ends_on then 'active'
      else 'draft'
    end
from public.competitions c
where c.slug = predictor_internal.competition_slug(t.name, t.year);

alter table public.tournaments
  add constraint tournaments_competition_id_fkey
    foreign key (competition_id)
    references public.competitions(id)
    on delete restrict
    not valid,
  add constraint tournaments_season_key_length
    check (char_length(btrim(season_key)) between 1 and 40)
    not valid,
  add constraint tournaments_kind_allowed
    check (kind in ('tournament', 'league_season'))
    not valid,
  add constraint tournaments_timezone_valid
    check (predictor_internal.is_valid_timezone(display_timezone))
    not valid,
  add constraint tournaments_status_allowed
    check (status in ('draft', 'scheduled', 'active', 'complete', 'archived'))
    not valid,
  add constraint tournaments_date_order
    check (starts_on is null or ends_on is null or ends_on >= starts_on)
    not valid,
  add constraint tournaments_competition_id_season_key_key
    unique (competition_id, season_key),
  add constraint tournaments_id_competition_id_key
    unique (id, competition_id);

alter table public.tournaments
  validate constraint tournaments_competition_id_fkey,
  validate constraint tournaments_season_key_length,
  validate constraint tournaments_kind_allowed,
  validate constraint tournaments_timezone_valid,
  validate constraint tournaments_status_allowed,
  validate constraint tournaments_date_order;

alter table public.tournaments
  alter column competition_id set not null,
  alter column season_key set not null,
  alter column kind set not null,
  alter column display_timezone set not null,
  alter column status set not null;

create or replace function predictor_internal.prepare_tournament_season()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_competition_name text;
begin
  if new.competition_id is null then
    v_slug := predictor_internal.competition_slug(new.name, new.year);
    v_competition_name := predictor_internal.competition_name(new.name);

    insert into public.competitions (slug, name)
    values (v_slug, v_competition_name)
    on conflict (slug) do nothing;

    select c.id
      into new.competition_id
      from public.competitions c
      where c.slug = v_slug;
  end if;

  new.season_key := coalesce(nullif(btrim(new.season_key), ''), new.year::text);
  new.kind := coalesce(new.kind, 'tournament');
  new.display_timezone := coalesce(
    nullif(btrim(new.display_timezone), ''),
    case when new.name = 'UEFA Euro 2028' then 'Europe/London' else 'UTC' end
  );
  new.status := coalesce(
    new.status,
    case
      when new.ends_on is not null and new.ends_on < current_date then 'complete'
      when new.starts_on is not null and new.starts_on > current_date then 'scheduled'
      when new.starts_on is not null
       and new.ends_on is not null
       and current_date between new.starts_on and new.ends_on then 'active'
      else 'draft'
    end
  );

  -- Preserve the historical tournament-wide entry lock for old callers.
  if new.kind = 'tournament'
     and new.lock_at is null
     and new.starts_on is not null
  then
    new.lock_at := (new.starts_on::text || ' 00:00:00+00')::timestamptz;
  end if;

  if not predictor_internal.is_valid_timezone(new.display_timezone) then
    raise exception 'Competition timezone % is not a valid IANA timezone', new.display_timezone
      using errcode = '22023';
  end if;

  if tg_op = 'UPDATE'
     and new.kind is distinct from old.kind
     and exists (
       select 1 from public.matches m where m.tournament_id = old.id
     )
  then
    raise exception 'A season kind cannot change after fixtures exist'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.prepare_tournament_season() from public;

create trigger a_prepare_tournament_season
before insert or update of
  name,
  year,
  starts_on,
  ends_on,
  lock_at,
  competition_id,
  season_key,
  kind,
  display_timezone,
  status
on public.tournaments
for each row
execute function predictor_internal.prepare_tournament_season();

create or replace function predictor_internal.prevent_competition_identity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'Competition slug is immutable'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function predictor_internal.prevent_competition_identity_change() from public;

create trigger prevent_competition_identity_change
before update of slug
on public.competitions
for each row
execute function predictor_internal.prevent_competition_identity_change();

create table public.competition_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  round_key text not null,
  ordinal integer not null,
  kind text not null,
  label text not null,
  created_at timestamptz not null default now(),
  constraint competition_rounds_tournament_id_fkey
    foreign key (tournament_id)
    references public.tournaments(id)
    on delete cascade,
  constraint competition_rounds_round_key_length
    check (char_length(btrim(round_key)) between 1 and 40),
  constraint competition_rounds_ordinal_positive
    check (ordinal > 0),
  constraint competition_rounds_kind_allowed
    check (kind in ('group_matchday', 'knockout_round', 'league_matchweek')),
  constraint competition_rounds_label_length
    check (char_length(btrim(label)) between 1 and 80),
  constraint competition_rounds_tournament_id_round_key_key
    unique (tournament_id, round_key),
  constraint competition_rounds_tournament_id_ordinal_key
    unique (tournament_id, ordinal),
  constraint competition_rounds_tournament_id_id_key
    unique (tournament_id, id)
);

alter table public.competition_rounds enable row level security;
revoke all on table public.competition_rounds from public, anon, authenticated;

insert into public.competition_rounds (
  tournament_id,
  round_key,
  ordinal,
  kind,
  label
)
select distinct
  m.tournament_id,
  'MD' || m.matchday::text,
  m.matchday::integer,
  'group_matchday',
  'Group matchday ' || m.matchday::text
from public.matches m
where m.round = 'group'
  and m.matchday is not null
on conflict (tournament_id, round_key) do nothing;

insert into public.competition_rounds (
  tournament_id,
  round_key,
  ordinal,
  kind,
  label
)
select distinct
  m.tournament_id,
  upper(m.round),
  case m.round
    when 'r16' then 4
    when 'qf' then 5
    when 'sf' then 6
    when 'final' then 7
  end,
  'knockout_round',
  case m.round
    when 'r16' then 'Round of 16'
    when 'qf' then 'Quarter-finals'
    when 'sf' then 'Semi-finals'
    when 'final' then 'Final'
  end
from public.matches m
where m.round in ('r16', 'qf', 'sf', 'final')
on conflict (tournament_id, round_key) do nothing;

alter table public.matches
  add column round_id uuid,
  add column fixture_status text not null default 'scheduled';

update public.matches m
set round_id = r.id
from public.competition_rounds r
where r.tournament_id = m.tournament_id
  and r.round_key = case
    when m.round = 'group' then 'MD' || m.matchday::text
    else upper(m.round)
  end;

alter table public.matches
  add constraint matches_fixture_status_allowed
    check (fixture_status in ('scheduled', 'postponed', 'abandoned', 'void', 'cancelled'))
    not valid,
  add constraint matches_tournament_id_round_id_fkey
    foreign key (tournament_id, round_id)
    references public.competition_rounds(tournament_id, id)
    on delete restrict
    not valid,
  add constraint matches_tournament_id_id_key
    unique (tournament_id, id);

alter table public.matches
  validate constraint matches_fixture_status_allowed,
  validate constraint matches_tournament_id_round_id_fkey;

alter table public.matches
  alter column round_id set not null;

alter table public.matches drop constraint matches_round_check;
alter table public.matches
  add constraint matches_round_check
    check (round in ('group', 'r16', 'qf', 'sf', 'final', 'league'));

alter table public.matches drop constraint matches_matchday_check;
alter table public.matches
  add constraint matches_matchday_check
    check (matchday is null or matchday > 0);

alter table public.matches drop constraint matches_group_shape;
alter table public.matches
  add constraint matches_group_shape
    check (
      (round = 'group' and group_id is not null and matchday is not null)
      or (round = 'league' and group_id is null)
      or (round not in ('group', 'league') and group_id is null and matchday is null)
    );

alter table public.matches drop constraint matches_result_round_and_winner_shape;
alter table public.matches
  add constraint matches_result_round_and_winner_shape
  check (
    result_state = 'scheduled'
    or (
      round in ('group', 'league')
      and result_method = 'regulation'
      and home_score = home_score_90
      and away_score = away_score_90
      and home_score_120 is null
      and away_score_120 is null
      and home_penalties is null
      and away_penalties is null
      and (
        (home_score = away_score and winner_team_id is null)
        or (home_score > away_score and winner_team_id = home_team_id)
        or (away_score > home_score and winner_team_id = away_team_id)
      )
    )
    or (
      round in ('r16', 'qf', 'sf', 'final')
      and home_team_id is not null
      and away_team_id is not null
      and home_team_id <> away_team_id
      and winner_team_id in (home_team_id, away_team_id)
      and (
        (
          result_method = 'regulation'
          and home_score = home_score_90
          and away_score = away_score_90
          and home_score_90 <> away_score_90
          and home_score_120 is null
          and away_score_120 is null
          and home_penalties is null
          and away_penalties is null
          and (
            (home_score_90 > away_score_90 and winner_team_id = home_team_id)
            or (away_score_90 > home_score_90 and winner_team_id = away_team_id)
          )
        )
        or (
          result_method = 'extra_time'
          and home_score_90 = away_score_90
          and home_score_120 is not null
          and away_score_120 is not null
          and home_score_120 <> away_score_120
          and home_score = home_score_120
          and away_score = away_score_120
          and home_penalties is null
          and away_penalties is null
          and (
            (home_score_120 > away_score_120 and winner_team_id = home_team_id)
            or (away_score_120 > home_score_120 and winner_team_id = away_team_id)
          )
        )
        or (
          result_method = 'penalties'
          and home_score_90 = away_score_90
          and home_score_120 is not null
          and away_score_120 is not null
          and home_score_120 = away_score_120
          and home_score = home_score_120
          and away_score = away_score_120
          and home_penalties is not null
          and away_penalties is not null
          and home_penalties <> away_penalties
          and (
            (home_penalties > away_penalties and winner_team_id = home_team_id)
            or (away_penalties > home_penalties and winner_team_id = away_team_id)
          )
        )
      )
    )
  );

create or replace function predictor_internal.prepare_match_season_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_kind text;
  v_round_key text;
  v_round_kind text;
  v_round_label text;
  v_ordinal integer;
  v_round_tournament uuid;
begin
  select t.kind
    into v_season_kind
    from public.tournaments t
    where t.id = new.tournament_id;

  if v_season_kind is null then
    raise exception 'Match references a missing tournament'
      using errcode = 'foreign_key_violation';
  end if;

  if new.round_id is null then
    if new.round = 'group' then
      if new.matchday is null then
        raise exception 'A group match requires a matchday'
          using errcode = 'check_violation';
      end if;
      v_round_key := 'MD' || new.matchday::text;
      v_round_kind := 'group_matchday';
      v_round_label := 'Group matchday ' || new.matchday::text;
      v_ordinal := new.matchday;
    elsif new.round = 'league' then
      if new.matchday is null then
        raise exception 'A league fixture requires a matchweek number'
          using errcode = 'check_violation';
      end if;
      v_round_key := 'MW' || lpad(new.matchday::text, 2, '0');
      v_round_kind := 'league_matchweek';
      v_round_label := 'Matchweek ' || new.matchday::text;
      v_ordinal := new.matchday;
    else
      v_round_key := upper(new.round);
      v_round_kind := 'knockout_round';
      v_round_label := case new.round
        when 'r16' then 'Round of 16'
        when 'qf' then 'Quarter-finals'
        when 'sf' then 'Semi-finals'
        when 'final' then 'Final'
        else upper(new.round)
      end;
      v_ordinal := case new.round
        when 'r16' then 4
        when 'qf' then 5
        when 'sf' then 6
        when 'final' then 7
        else 100
      end;
    end if;

    insert into public.competition_rounds (
      tournament_id,
      round_key,
      ordinal,
      kind,
      label
    )
    values (
      new.tournament_id,
      v_round_key,
      v_ordinal,
      v_round_kind,
      v_round_label
    )
    on conflict (tournament_id, round_key) do nothing;

    select r.id
      into new.round_id
      from public.competition_rounds r
      where r.tournament_id = new.tournament_id
        and r.round_key = v_round_key;
  end if;

  select r.tournament_id, r.kind
    into v_round_tournament, v_round_kind
    from public.competition_rounds r
    where r.id = new.round_id;

  if v_round_tournament is null then
    raise exception 'Match references a missing competition round'
      using errcode = 'foreign_key_violation';
  end if;

  if v_round_tournament <> new.tournament_id then
    raise exception 'Match round must belong to the match tournament'
      using errcode = 'check_violation';
  end if;

  if v_season_kind = 'tournament' then
    if new.round = 'league'
       or (new.round = 'group' and v_round_kind <> 'group_matchday')
       or (new.round in ('r16', 'qf', 'sf', 'final') and v_round_kind <> 'knockout_round')
    then
      raise exception 'Tournament fixture round is incompatible with the season kind'
        using errcode = 'check_violation';
    end if;
  elsif v_season_kind = 'league_season' then
    if new.round <> 'league' or v_round_kind <> 'league_matchweek' then
      raise exception 'League-season fixtures must use a league matchweek'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.prepare_match_season_scope() from public;

create trigger a_prepare_match_season_scope
before insert or update of
  tournament_id,
  round,
  round_id,
  matchday
on public.matches
for each row
execute function predictor_internal.prepare_match_season_scope();

drop trigger validate_match_reference_scope on public.matches;

create or replace function predictor_internal.validate_match_reference_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference_tournament uuid;
begin
  select tournament_id
    into v_reference_tournament
    from public.competition_rounds
    where id = new.round_id;
  if v_reference_tournament is null then
    raise exception 'Match references a missing competition round'
      using errcode = 'foreign_key_violation';
  end if;
  if v_reference_tournament <> new.tournament_id then
    raise exception 'Match round must belong to the match tournament'
      using errcode = 'check_violation';
  end if;

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

revoke all on function predictor_internal.validate_match_reference_scope() from public;

create trigger validate_match_reference_scope
before insert or update of
  tournament_id,
  round_id,
  group_id,
  home_team_id,
  away_team_id,
  winner_team_id
on public.matches
for each row
execute function predictor_internal.validate_match_reference_scope();

create table public.competition_lock_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  scope_type text not null,
  scope_key text not null,
  locked_at timestamptz not null,
  fixture_basis_hash text not null,
  created_at timestamptz not null default now(),
  constraint competition_lock_events_tournament_id_fkey
    foreign key (tournament_id)
    references public.tournaments(id)
    on delete cascade,
  constraint competition_lock_events_scope_type_allowed
    check (scope_type in ('entry', 'round', 'match')),
  constraint competition_lock_events_scope_key_length
    check (char_length(btrim(scope_key)) between 1 and 100),
  constraint competition_lock_events_hash_shape
    check (fixture_basis_hash ~ '^[0-9a-f]{64}$'),
  constraint competition_lock_events_tournament_scope_key
    unique (tournament_id, scope_type, scope_key)
);

alter table public.competition_lock_events enable row level security;
revoke all on table public.competition_lock_events from public, anon, authenticated;

create or replace function predictor_internal.prevent_lock_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Competition lock events are append-only'
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function predictor_internal.prevent_lock_event_mutation() from public;

create trigger prevent_lock_event_mutation
before update or delete
on public.competition_lock_events
for each row
execute function predictor_internal.prevent_lock_event_mutation();

create or replace function predictor_internal.record_tournament_lock_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_effective_lock timestamptz;
begin
  v_effective_lock := case
    when tg_op = 'UPDATE'
     and old.lock_at is not null
     and old.lock_at <= clock_timestamp() then old.lock_at
    when new.lock_at is not null
     and new.lock_at <= clock_timestamp() then new.lock_at
    else null
  end;

  if v_effective_lock is not null then
    insert into public.competition_lock_events (
      tournament_id,
      scope_type,
      scope_key,
      locked_at,
      fixture_basis_hash
    )
    values (
      new.id,
      'entry',
      'entry',
      v_effective_lock,
      pg_catalog.encode(extensions.digest('entry:' || new.id::text || ':' || v_effective_lock::text, 'sha256'), 'hex')
    )
    on conflict (tournament_id, scope_type, scope_key) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.record_tournament_lock_transition() from public;

create trigger record_tournament_lock_transition
after insert or update of lock_at
on public.tournaments
for each row
execute function predictor_internal.record_tournament_lock_transition();

create or replace function predictor_internal.record_match_lock_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_effective_lock timestamptz;
begin
  v_effective_lock := case
    when tg_op = 'UPDATE'
     and old.kickoff_at is not null
     and old.kickoff_at <= clock_timestamp() then old.kickoff_at
    when new.kickoff_at is not null
     and new.kickoff_at <= clock_timestamp() then new.kickoff_at
    else null
  end;

  if v_effective_lock is not null then
    insert into public.competition_lock_events (
      tournament_id,
      scope_type,
      scope_key,
      locked_at,
      fixture_basis_hash
    )
    values (
      new.tournament_id,
      'match',
      new.id::text,
      v_effective_lock,
      pg_catalog.encode(extensions.digest('match:' || new.id::text || ':' || v_effective_lock::text, 'sha256'), 'hex')
    )
    on conflict (tournament_id, scope_type, scope_key) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.record_match_lock_transition() from public;

create trigger record_match_lock_transition
after insert or update of kickoff_at
on public.matches
for each row
execute function predictor_internal.record_match_lock_transition();

insert into public.competition_lock_events (
  tournament_id,
  scope_type,
  scope_key,
  locked_at,
  fixture_basis_hash
)
select
  t.id,
  'entry',
  'entry',
  t.lock_at,
  pg_catalog.encode(extensions.digest('entry:' || t.id::text || ':' || t.lock_at::text, 'sha256'), 'hex')
from public.tournaments t
where t.lock_at is not null
  and t.lock_at <= clock_timestamp()
on conflict (tournament_id, scope_type, scope_key) do nothing;

insert into public.competition_lock_events (
  tournament_id,
  scope_type,
  scope_key,
  locked_at,
  fixture_basis_hash
)
select
  m.tournament_id,
  'match',
  m.id::text,
  m.kickoff_at,
  pg_catalog.encode(extensions.digest('match:' || m.id::text || ':' || m.kickoff_at::text, 'sha256'), 'hex')
from public.matches m
where m.kickoff_at is not null
  and m.kickoff_at <= clock_timestamp()
on conflict (tournament_id, scope_type, scope_key) do nothing;

-- FIRST of two definitions of this function in this migration, and both are
-- required. The season-scope backfill further down issues `update` statements
-- against `match_predictions`, `predicted_group_positions`,
-- `predicted_progression` and `predicted_tie_resolutions` to populate
-- `tournament_id`. Those tables carry the lock triggers, so a definition has to
-- be in force while the backfill runs; this is it. The second definition then
-- installs the final rule, which tolerates a not-yet-known kickoff.
--
-- The two differ only in that null-kickoff handling. They must never differ in
-- security or role semantics: both are `security invoker` and both test
-- `current_user = 'postgres'`. An earlier draft let the second drift to
-- `security definer` + `session_user`, which silently disabled the trusted
-- automatic-submission refresh. `stageC1LockFunctionConsistency.test.ts` fails
-- if they disagree again.
create or replace function public.enforce_entry_lock_generic()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entry uuid;
  v_match uuid;
  v_tournament uuid;
  v_lock timestamptz;
  v_kickoff timestamptz;
  v_server_position_refresh boolean :=
    tg_table_schema = 'public'
    and tg_table_name = 'predicted_group_positions'
    and current_user = 'postgres'
    and coalesce(
      current_setting('predictor.auto_submission_refresh', true),
      ''
    ) = 'on';
begin
  if tg_op = 'DELETE' then
    v_entry := old.entry_id;
  else
    v_entry := new.entry_id;
  end if;

  select e.tournament_id, t.lock_at
    into v_tournament, v_lock
    from public.entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.id = v_entry;

  if v_tournament is null then
    raise exception 'Prediction references a missing entry'
      using errcode = 'foreign_key_violation';
  end if;

  if v_lock is null and not v_server_position_refresh then
    raise exception 'Predictions are unavailable — the tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if v_lock is not null and clock_timestamp() >= v_lock
     and not v_server_position_refresh
  then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  if tg_table_name = 'match_predictions' then
    if tg_op = 'DELETE' then
      v_match := old.match_id;
    else
      v_match := new.match_id;
    end if;

    select m.kickoff_at
      into v_kickoff
      from public.matches m
      where m.id = v_match;

    if v_kickoff is null then
      raise exception 'This prediction is unavailable — the match has no scheduled kickoff'
        using errcode = 'check_violation';
    end if;

    if clock_timestamp() >= v_kickoff then
      raise exception 'This prediction is locked — the match has kicked off'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_entry_lock_scores()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tournament uuid;
  v_lock timestamptz;
  v_kickoff timestamptz;
  v_score_changed boolean;
begin
  v_score_changed := tg_op = 'INSERT'
    or new.home_score is distinct from old.home_score
    or new.away_score is distinct from old.away_score;

  if not v_score_changed then
    return new;
  end if;

  select e.tournament_id, t.lock_at
    into v_tournament, v_lock
    from public.entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.id = new.entry_id;

  if v_tournament is null then
    raise exception 'Prediction references a missing entry'
      using errcode = 'foreign_key_violation';
  end if;

  if v_lock is null then
    raise exception 'Predictions are unavailable — the tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if v_lock is not null and clock_timestamp() >= v_lock then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  select m.kickoff_at
    into v_kickoff
    from public.matches m
    where m.id = new.match_id;

  if v_kickoff is null then
    raise exception 'This prediction is unavailable — the match has no scheduled kickoff'
      using errcode = 'check_violation';
  end if;

  if clock_timestamp() >= v_kickoff then
    raise exception 'This prediction is locked — the match has kicked off'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_joker_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tournament uuid;
  v_kickoff timestamptz;
  joker_changed boolean;
begin
  joker_changed := (tg_op = 'INSERT' and new.joker)
                or (tg_op = 'UPDATE' and new.joker is distinct from old.joker);

  if not joker_changed then
    return new;
  end if;

  select m.tournament_id, m.kickoff_at
    into v_tournament, v_kickoff
    from public.matches m
    where m.id = new.match_id;

  if v_kickoff is null then
    raise exception 'Joker on match % is unavailable until kickoff is scheduled', new.match_id
      using errcode = 'check_violation';
  end if;

  if clock_timestamp() >= v_kickoff then
    raise exception 'Joker on match % is locked at kickoff and cannot be changed', new.match_id
      using errcode = 'check_violation';
  end if;

  if new.joker and (
    select count(*)
    from public.match_predictions
    where entry_id = new.entry_id
      and joker = true
      and match_id <> new.match_id
  ) >= 5 then
    raise exception 'Entry % already has the maximum of 5 jokers', new.entry_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create table public.competition_awards (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  award_key text not null,
  label text not null,
  winner_player_id uuid,
  winner_team_id uuid,
  detail jsonb not null default '{}'::jsonb,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint competition_awards_tournament_id_fkey
    foreign key (tournament_id)
    references public.tournaments(id)
    on delete cascade,
  constraint competition_awards_winner_player_id_fkey
    foreign key (winner_player_id)
    references public.players(id)
    on delete set null,
  constraint competition_awards_winner_team_id_fkey
    foreign key (winner_team_id)
    references public.teams(id)
    on delete set null,
  constraint competition_awards_key_length
    check (char_length(btrim(award_key)) between 1 and 60),
  constraint competition_awards_label_length
    check (char_length(btrim(label)) between 1 and 100),
  constraint competition_awards_tournament_id_award_key_key
    unique (tournament_id, award_key)
);

alter table public.competition_awards enable row level security;
revoke all on table public.competition_awards from public, anon, authenticated;

create or replace function predictor_internal.validate_competition_award_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference_tournament uuid;
begin
  if new.winner_player_id is not null then
    select tournament_id into v_reference_tournament
    from public.players where id = new.winner_player_id;
    if v_reference_tournament is null then
      raise exception 'Competition award references a missing player'
        using errcode = 'foreign_key_violation';
    end if;
    if v_reference_tournament <> new.tournament_id then
      raise exception 'Competition award player must belong to the award season'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.winner_team_id is not null then
    select tournament_id into v_reference_tournament
    from public.teams where id = new.winner_team_id;
    if v_reference_tournament is null then
      raise exception 'Competition award references a missing team'
        using errcode = 'foreign_key_violation';
    end if;
    if v_reference_tournament <> new.tournament_id then
      raise exception 'Competition award team must belong to the award season'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.validate_competition_award_scope() from public;

create trigger validate_competition_award_scope
before insert or update of tournament_id, winner_player_id, winner_team_id
on public.competition_awards
for each row
execute function predictor_internal.validate_competition_award_scope();

-- Composite parent keys used by additive same-season foreign keys.
alter table public.teams
  add constraint teams_tournament_id_id_key unique (tournament_id, id);
alter table public.groups
  add constraint groups_tournament_id_id_key unique (tournament_id, id);
alter table public.entries
  add constraint entries_tournament_id_id_key unique (tournament_id, id);
alter table public.players
  add constraint players_tournament_id_id_key unique (tournament_id, id);
alter table public.bonus_competitions
  add constraint bonus_competitions_tournament_id_id_key unique (tournament_id, id);

-- Direct child rows retain their established ownership paths and gain explicit
-- season scope. Old RPC/insert shapes remain valid through the preparation trigger.
alter table public.group_teams add column tournament_id uuid;
alter table public.match_predictions add column tournament_id uuid;
alter table public.predicted_group_positions add column tournament_id uuid;
alter table public.predicted_progression add column tournament_id uuid;
alter table public.predicted_tie_resolutions add column tournament_id uuid;
alter table public.bonus_predictions add column tournament_id uuid;
alter table public.score_events add column tournament_id uuid;
alter table public.bonus_competition_entrants add column tournament_id uuid;
alter table public.bonus_competition_windows add column tournament_id uuid;
alter table public.bonus_window_fixtures add column tournament_id uuid;
alter table public.bonus_knockout_predictions
  add column tournament_id uuid,
  add column competition_id uuid;
alter table public.bonus_lms_selections add column tournament_id uuid;
alter table public.bonus_score_events add column tournament_id uuid;
alter table public.bonus_competition_audit add column tournament_id uuid;
alter table public.bonus_cup_groups add column tournament_id uuid;
alter table public.bonus_cup_members add column tournament_id uuid;
alter table public.bonus_cup_fixtures add column tournament_id uuid;
alter table public.bonus_cup_penalty_numbers add column tournament_id uuid;

update public.group_teams x
set tournament_id = g.tournament_id
from public.groups g
where g.id = x.group_id;

update public.match_predictions x
set tournament_id = e.tournament_id
from public.entries e
where e.id = x.entry_id;

update public.predicted_group_positions x
set tournament_id = e.tournament_id
from public.entries e
where e.id = x.entry_id;

update public.predicted_progression x
set tournament_id = e.tournament_id
from public.entries e
where e.id = x.entry_id;

update public.predicted_tie_resolutions x
set tournament_id = e.tournament_id
from public.entries e
where e.id = x.entry_id;

update public.bonus_predictions x
set tournament_id = e.tournament_id
from public.entries e
where e.id = x.entry_id;

update public.score_events x
set tournament_id = e.tournament_id
from public.entries e
where e.id = x.entry_id;

update public.bonus_competition_entrants x
set tournament_id = c.tournament_id
from public.bonus_competitions c
where c.id = x.competition_id;

update public.bonus_competition_windows x
set tournament_id = c.tournament_id
from public.bonus_competitions c
where c.id = x.competition_id;

update public.bonus_window_fixtures x
set tournament_id = w.tournament_id
from public.bonus_competition_windows w
where w.id = x.window_id;

insert into public.bonus_competitions (tournament_id, game_key)
select distinct m.tournament_id, 'ko_predictor'
from public.bonus_knockout_predictions p
join public.matches m on m.id = p.match_id
on conflict (tournament_id, game_key) do nothing;

update public.bonus_knockout_predictions x
set tournament_id = m.tournament_id,
    competition_id = c.id
from public.matches m
join public.bonus_competitions c
  on c.tournament_id = m.tournament_id
 and c.game_key = 'ko_predictor'
where m.id = x.match_id;

update public.bonus_lms_selections x
set tournament_id = c.tournament_id
from public.bonus_competitions c
where c.id = x.competition_id;

update public.bonus_score_events x
set tournament_id = c.tournament_id
from public.bonus_competitions c
where c.id = x.competition_id;

-- `bonus_competition_audit` is the one backfill target guarded by a row-level
-- BEFORE UPDATE OR DELETE immutability trigger. A row-level trigger never fires
-- when a statement matches zero rows, so every disposable rebuild — which reaches
-- this point with an empty audit table — passed while a populated database raised
-- 42501 and rolled the whole migration back.
--
-- Adding derived competition-season scope is schema evolution, not a correction to
-- the historical action, detail, actor or timestamp, so the immutability guarantee
-- is suspended for exactly this one statement rather than weakened. `alter table
-- ... disable trigger` is transactional DDL holding ACCESS EXCLUSIVE: no concurrent
-- session observes the trigger disabled, and a rollback anywhere later in this
-- migration restores it along with the rest of the Stage C1 schema.
do $stage_c1_audit_scope_preflight$
declare
  v_enabled "char";
  v_missing_parent bigint;
  v_unscoped_parent bigint;
begin
  select t.tgenabled into v_enabled
  from pg_catalog.pg_trigger t
  where t.tgrelid = 'public.bonus_competition_audit'::regclass
    and t.tgname = 'block_bonus_audit_mutation'
    and not t.tgisinternal;

  if v_enabled is null then
    raise exception
      'Stage C1 audit scope backfill requires trigger block_bonus_audit_mutation on public.bonus_competition_audit';
  end if;

  if v_enabled <> 'O' then
    raise exception
      'Stage C1 audit scope backfill requires block_bonus_audit_mutation to be enabled before the backfill; found tgenabled %',
      v_enabled;
  end if;

  select
    count(*) filter (where c.id is null),
    count(*) filter (where c.id is not null and c.tournament_id is null)
  into v_missing_parent, v_unscoped_parent
  from public.bonus_competition_audit x
  left join public.bonus_competitions c on c.id = x.competition_id;

  if v_missing_parent > 0 then
    raise exception
      '% audit row(s) reference a missing bonus competition; competition-season scope cannot be derived',
      v_missing_parent;
  end if;

  if v_unscoped_parent > 0 then
    raise exception
      '% audit row(s) have a parent bonus competition without a tournament_id',
      v_unscoped_parent;
  end if;
end
$stage_c1_audit_scope_preflight$;

alter table public.bonus_competition_audit
  disable trigger block_bonus_audit_mutation;

update public.bonus_competition_audit x
set tournament_id = c.tournament_id
from public.bonus_competitions c
where c.id = x.competition_id
  and x.tournament_id is null;

alter table public.bonus_competition_audit
  enable trigger block_bonus_audit_mutation;

do $stage_c1_audit_scope_postflight$
declare
  v_enabled "char";
  v_unscoped bigint;
begin
  select count(*) into v_unscoped
  from public.bonus_competition_audit
  where tournament_id is null;

  if v_unscoped > 0 then
    raise exception
      '% audit row(s) still have no tournament_id after the Stage C1 scope backfill',
      v_unscoped;
  end if;

  select t.tgenabled into v_enabled
  from pg_catalog.pg_trigger t
  where t.tgrelid = 'public.bonus_competition_audit'::regclass
    and t.tgname = 'block_bonus_audit_mutation'
    and not t.tgisinternal;

  if v_enabled is distinct from 'O' then
    raise exception
      'Stage C1 audit scope backfill left block_bonus_audit_mutation not enabled; tgenabled is %',
      coalesce(v_enabled::text, 'missing');
  end if;
end
$stage_c1_audit_scope_postflight$;

update public.bonus_cup_groups x
set tournament_id = c.tournament_id
from public.bonus_competitions c
where c.id = x.competition_id;

update public.bonus_cup_members x
set tournament_id = c.tournament_id
from public.bonus_competitions c
where c.id = x.competition_id;

update public.bonus_cup_fixtures x
set tournament_id = c.tournament_id
from public.bonus_competitions c
where c.id = x.competition_id;

update public.bonus_cup_penalty_numbers x
set tournament_id = c.tournament_id
from public.bonus_competitions c
where c.id = x.competition_id;

create or replace function predictor_internal.prepare_competition_season_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament uuid;
begin
  case tg_table_name
    when 'group_teams' then
      select tournament_id into v_tournament
      from public.groups where id = new.group_id;
    when 'match_predictions' then
      select tournament_id into v_tournament
      from public.entries where id = new.entry_id;
    when 'predicted_group_positions' then
      select tournament_id into v_tournament
      from public.entries where id = new.entry_id;
    when 'predicted_progression' then
      select tournament_id into v_tournament
      from public.entries where id = new.entry_id;
    when 'predicted_tie_resolutions' then
      select tournament_id into v_tournament
      from public.entries where id = new.entry_id;
    when 'bonus_predictions' then
      select tournament_id into v_tournament
      from public.entries where id = new.entry_id;
    when 'score_events' then
      select tournament_id into v_tournament
      from public.entries where id = new.entry_id;
    when 'bonus_competition_entrants' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_competition_windows' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_window_fixtures' then
      select tournament_id into v_tournament
      from public.bonus_competition_windows where id = new.window_id;
    when 'bonus_knockout_predictions' then
      select tournament_id into v_tournament
      from public.matches where id = new.match_id;
      if new.competition_id is null and v_tournament is not null then
        select id into new.competition_id
        from public.bonus_competitions
        where tournament_id = v_tournament
          and game_key = 'ko_predictor';
      end if;
    when 'bonus_lms_selections' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_score_events' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_competition_audit' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_cup_groups' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_cup_members' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_cup_fixtures' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    when 'bonus_cup_penalty_numbers' then
      select tournament_id into v_tournament
      from public.bonus_competitions where id = new.competition_id;
    else
      raise exception 'Unsupported competition-season scope table %', tg_table_name;
  end case;

  if v_tournament is null then
    raise exception 'Competition-season scope parent is missing'
      using errcode = 'foreign_key_violation';
  end if;

  if new.tournament_id is not null
     and new.tournament_id <> v_tournament
  then
    raise exception 'Stored competition-season scope does not match its parent'
      using errcode = 'check_violation';
  end if;

  new.tournament_id := v_tournament;
  return new;
end;
$$;

revoke all on function predictor_internal.prepare_competition_season_scope() from public;

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, group_id
on public.group_teams
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, entry_id, match_id
on public.match_predictions
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, entry_id, group_id, team_id
on public.predicted_group_positions
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, entry_id, team_id
on public.predicted_progression
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, entry_id
on public.predicted_tie_resolutions
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, entry_id, golden_boot_player_id
on public.bonus_predictions
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, entry_id, match_id, team_id
on public.score_events
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, competition_id
on public.bonus_competition_entrants
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, competition_id
on public.bonus_competition_windows
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, window_id, match_id
on public.bonus_window_fixtures
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, match_id, competition_id, advancing_team_id
on public.bonus_knockout_predictions
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, competition_id, window_id, team_id
on public.bonus_lms_selections
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, competition_id, window_id, match_id
on public.bonus_score_events
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, competition_id
on public.bonus_competition_audit
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, competition_id
on public.bonus_cup_groups
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, competition_id, group_id, user_id
on public.bonus_cup_members
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, competition_id, group_id, window_id, home_user_id, away_user_id
on public.bonus_cup_fixtures
for each row execute function predictor_internal.prepare_competition_season_scope();

create trigger a_prepare_competition_season_scope
before insert or update of tournament_id, competition_id, window_id, user_id
on public.bonus_cup_penalty_numbers
for each row execute function predictor_internal.prepare_competition_season_scope();

alter table public.bonus_competition_windows
  add constraint bonus_competition_windows_tournament_id_id_key
    unique (tournament_id, id),
  add constraint bonus_competition_windows_tournament_competition_id_key
    unique (tournament_id, competition_id, id);
alter table public.bonus_competition_entrants
  add constraint bonus_competition_entrants_tournament_competition_user_key
    unique (tournament_id, competition_id, user_id);
alter table public.bonus_cup_groups
  add constraint bonus_cup_groups_tournament_competition_id_key
    unique (tournament_id, competition_id, id);

alter table public.group_teams
  add constraint group_teams_tournament_group_fkey
    foreign key (tournament_id, group_id)
    references public.groups(tournament_id, id)
    on delete cascade not valid,
  add constraint group_teams_tournament_team_fkey
    foreign key (tournament_id, team_id)
    references public.teams(tournament_id, id)
    on delete cascade not valid;

alter table public.players
  add constraint players_tournament_team_fkey
    foreign key (tournament_id, team_id)
    references public.teams(tournament_id, id)
    not valid;

alter table public.matches
  add constraint matches_tournament_group_fkey
    foreign key (tournament_id, group_id)
    references public.groups(tournament_id, id)
    not valid,
  add constraint matches_tournament_home_team_fkey
    foreign key (tournament_id, home_team_id)
    references public.teams(tournament_id, id)
    not valid,
  add constraint matches_tournament_away_team_fkey
    foreign key (tournament_id, away_team_id)
    references public.teams(tournament_id, id)
    not valid,
  add constraint matches_tournament_winner_team_fkey
    foreign key (tournament_id, winner_team_id)
    references public.teams(tournament_id, id)
    not valid;

alter table public.match_predictions
  add constraint match_predictions_tournament_entry_fkey
    foreign key (tournament_id, entry_id)
    references public.entries(tournament_id, id)
    on delete cascade not valid,
  add constraint match_predictions_tournament_match_fkey
    foreign key (tournament_id, match_id)
    references public.matches(tournament_id, id)
    on delete cascade not valid;

alter table public.predicted_group_positions
  add constraint predicted_group_positions_tournament_entry_fkey
    foreign key (tournament_id, entry_id)
    references public.entries(tournament_id, id)
    on delete cascade not valid,
  add constraint predicted_group_positions_tournament_group_fkey
    foreign key (tournament_id, group_id)
    references public.groups(tournament_id, id)
    on delete cascade not valid,
  add constraint predicted_group_positions_tournament_team_fkey
    foreign key (tournament_id, team_id)
    references public.teams(tournament_id, id)
    on delete cascade not valid;

alter table public.predicted_progression
  add constraint predicted_progression_tournament_entry_fkey
    foreign key (tournament_id, entry_id)
    references public.entries(tournament_id, id)
    on delete cascade not valid,
  add constraint predicted_progression_tournament_team_fkey
    foreign key (tournament_id, team_id)
    references public.teams(tournament_id, id)
    on delete cascade not valid;

alter table public.predicted_tie_resolutions
  add constraint predicted_tie_resolutions_tournament_entry_fkey
    foreign key (tournament_id, entry_id)
    references public.entries(tournament_id, id)
    on delete cascade not valid;

alter table public.bonus_predictions
  add constraint bonus_predictions_tournament_entry_fkey
    foreign key (tournament_id, entry_id)
    references public.entries(tournament_id, id)
    on delete cascade not valid,
  add constraint bonus_predictions_tournament_player_fkey
    foreign key (tournament_id, golden_boot_player_id)
    references public.players(tournament_id, id)
    not valid;

alter table public.score_events
  add constraint score_events_tournament_entry_fkey
    foreign key (tournament_id, entry_id)
    references public.entries(tournament_id, id)
    on delete cascade not valid,
  add constraint score_events_tournament_match_fkey
    foreign key (tournament_id, match_id)
    references public.matches(tournament_id, id)
    on delete cascade not valid,
  add constraint score_events_tournament_team_fkey
    foreign key (tournament_id, team_id)
    references public.teams(tournament_id, id)
    not valid;

alter table public.match_result_revisions
  add constraint match_result_revisions_tournament_match_fkey
    foreign key (tournament_id, match_id)
    references public.matches(tournament_id, id)
    on delete cascade not valid;

alter table public.entry_automatic_submission_outcomes
  add constraint entry_auto_outcomes_tournament_entry_fkey
    foreign key (tournament_id, entry_id)
    references public.entries(tournament_id, id)
    on delete cascade not valid;

alter table public.bonus_competition_entrants
  add constraint bonus_entrants_tournament_competition_fkey
    foreign key (tournament_id, competition_id)
    references public.bonus_competitions(tournament_id, id)
    on delete cascade not valid;

alter table public.bonus_competition_windows
  add constraint bonus_windows_tournament_competition_fkey
    foreign key (tournament_id, competition_id)
    references public.bonus_competitions(tournament_id, id)
    on delete cascade not valid;

alter table public.bonus_window_fixtures
  add constraint bonus_window_fixtures_tournament_window_fkey
    foreign key (tournament_id, window_id)
    references public.bonus_competition_windows(tournament_id, id)
    on delete cascade not valid,
  add constraint bonus_window_fixtures_tournament_match_fkey
    foreign key (tournament_id, match_id)
    references public.matches(tournament_id, id)
    not valid;

alter table public.bonus_knockout_predictions
  add constraint bonus_ko_predictions_tournament_competition_fkey
    foreign key (tournament_id, competition_id)
    references public.bonus_competitions(tournament_id, id)
    on delete cascade not valid,
  add constraint bonus_ko_predictions_tournament_match_fkey
    foreign key (tournament_id, match_id)
    references public.matches(tournament_id, id)
    on delete cascade not valid,
  add constraint bonus_ko_predictions_tournament_advancing_team_fkey
    foreign key (tournament_id, advancing_team_id)
    references public.teams(tournament_id, id)
    not valid;

alter table public.bonus_lms_selections
  add constraint bonus_lms_tournament_competition_fkey
    foreign key (tournament_id, competition_id)
    references public.bonus_competitions(tournament_id, id)
    on delete cascade not valid,
  add constraint bonus_lms_tournament_window_fkey
    foreign key (tournament_id, competition_id, window_id)
    references public.bonus_competition_windows(tournament_id, competition_id, id)
    on delete cascade not valid,
  add constraint bonus_lms_tournament_team_fkey
    foreign key (tournament_id, team_id)
    references public.teams(tournament_id, id)
    not valid;

alter table public.bonus_score_events
  add constraint bonus_scores_tournament_competition_fkey
    foreign key (tournament_id, competition_id)
    references public.bonus_competitions(tournament_id, id)
    on delete cascade not valid,
  add constraint bonus_scores_tournament_window_fkey
    foreign key (tournament_id, competition_id, window_id)
    references public.bonus_competition_windows(tournament_id, competition_id, id)
    on delete cascade not valid,
  add constraint bonus_scores_tournament_match_fkey
    foreign key (tournament_id, match_id)
    references public.matches(tournament_id, id)
    on delete cascade not valid;

alter table public.bonus_competition_audit
  add constraint bonus_audit_tournament_competition_fkey
    foreign key (tournament_id, competition_id)
    references public.bonus_competitions(tournament_id, id)
    on delete cascade not valid;

alter table public.bonus_cup_groups
  add constraint bonus_cup_groups_tournament_competition_fkey
    foreign key (tournament_id, competition_id)
    references public.bonus_competitions(tournament_id, id)
    on delete cascade not valid;

alter table public.bonus_cup_members
  add constraint bonus_cup_members_tournament_competition_fkey
    foreign key (tournament_id, competition_id)
    references public.bonus_competitions(tournament_id, id)
    on delete cascade not valid,
  add constraint bonus_cup_members_tournament_group_fkey
    foreign key (tournament_id, competition_id, group_id)
    references public.bonus_cup_groups(tournament_id, competition_id, id)
    on delete cascade not valid;

alter table public.bonus_cup_fixtures
  add constraint bonus_cup_fixtures_tournament_competition_fkey
    foreign key (tournament_id, competition_id)
    references public.bonus_competitions(tournament_id, id)
    on delete cascade not valid,
  add constraint bonus_cup_fixtures_tournament_group_fkey
    foreign key (tournament_id, competition_id, group_id)
    references public.bonus_cup_groups(tournament_id, competition_id, id)
    not valid,
  add constraint bonus_cup_fixtures_tournament_window_fkey
    foreign key (tournament_id, competition_id, window_id)
    references public.bonus_competition_windows(tournament_id, competition_id, id)
    not valid;

alter table public.bonus_cup_penalty_numbers
  add constraint bonus_cup_penalties_tournament_competition_fkey
    foreign key (tournament_id, competition_id)
    references public.bonus_competitions(tournament_id, id)
    on delete cascade not valid,
  add constraint bonus_cup_penalties_tournament_window_fkey
    foreign key (tournament_id, competition_id, window_id)
    references public.bonus_competition_windows(tournament_id, competition_id, id)
    on delete cascade not valid;

alter table public.group_teams validate constraint group_teams_tournament_group_fkey;
alter table public.group_teams validate constraint group_teams_tournament_team_fkey;
alter table public.players validate constraint players_tournament_team_fkey;
alter table public.matches validate constraint matches_tournament_group_fkey;
alter table public.matches validate constraint matches_tournament_home_team_fkey;
alter table public.matches validate constraint matches_tournament_away_team_fkey;
alter table public.matches validate constraint matches_tournament_winner_team_fkey;
alter table public.match_predictions validate constraint match_predictions_tournament_entry_fkey;
alter table public.match_predictions validate constraint match_predictions_tournament_match_fkey;
alter table public.predicted_group_positions validate constraint predicted_group_positions_tournament_entry_fkey;
alter table public.predicted_group_positions validate constraint predicted_group_positions_tournament_group_fkey;
alter table public.predicted_group_positions validate constraint predicted_group_positions_tournament_team_fkey;
alter table public.predicted_progression validate constraint predicted_progression_tournament_entry_fkey;
alter table public.predicted_progression validate constraint predicted_progression_tournament_team_fkey;
alter table public.predicted_tie_resolutions validate constraint predicted_tie_resolutions_tournament_entry_fkey;
alter table public.bonus_predictions validate constraint bonus_predictions_tournament_entry_fkey;
alter table public.bonus_predictions validate constraint bonus_predictions_tournament_player_fkey;
alter table public.score_events validate constraint score_events_tournament_entry_fkey;
alter table public.score_events validate constraint score_events_tournament_match_fkey;
alter table public.score_events validate constraint score_events_tournament_team_fkey;
alter table public.match_result_revisions validate constraint match_result_revisions_tournament_match_fkey;
alter table public.entry_automatic_submission_outcomes validate constraint entry_auto_outcomes_tournament_entry_fkey;
alter table public.bonus_competition_entrants validate constraint bonus_entrants_tournament_competition_fkey;
alter table public.bonus_competition_windows validate constraint bonus_windows_tournament_competition_fkey;
alter table public.bonus_window_fixtures validate constraint bonus_window_fixtures_tournament_window_fkey;
alter table public.bonus_window_fixtures validate constraint bonus_window_fixtures_tournament_match_fkey;
alter table public.bonus_knockout_predictions validate constraint bonus_ko_predictions_tournament_competition_fkey;
alter table public.bonus_knockout_predictions validate constraint bonus_ko_predictions_tournament_match_fkey;
alter table public.bonus_knockout_predictions validate constraint bonus_ko_predictions_tournament_advancing_team_fkey;
alter table public.bonus_lms_selections validate constraint bonus_lms_tournament_competition_fkey;
alter table public.bonus_lms_selections validate constraint bonus_lms_tournament_window_fkey;
alter table public.bonus_lms_selections validate constraint bonus_lms_tournament_team_fkey;
alter table public.bonus_score_events validate constraint bonus_scores_tournament_competition_fkey;
alter table public.bonus_score_events validate constraint bonus_scores_tournament_window_fkey;
alter table public.bonus_score_events validate constraint bonus_scores_tournament_match_fkey;
alter table public.bonus_competition_audit validate constraint bonus_audit_tournament_competition_fkey;
alter table public.bonus_cup_groups validate constraint bonus_cup_groups_tournament_competition_fkey;
alter table public.bonus_cup_members validate constraint bonus_cup_members_tournament_competition_fkey;
alter table public.bonus_cup_members validate constraint bonus_cup_members_tournament_group_fkey;
alter table public.bonus_cup_fixtures validate constraint bonus_cup_fixtures_tournament_competition_fkey;
alter table public.bonus_cup_fixtures validate constraint bonus_cup_fixtures_tournament_group_fkey;
alter table public.bonus_cup_fixtures validate constraint bonus_cup_fixtures_tournament_window_fkey;
alter table public.bonus_cup_penalty_numbers validate constraint bonus_cup_penalties_tournament_competition_fkey;
alter table public.bonus_cup_penalty_numbers validate constraint bonus_cup_penalties_tournament_window_fkey;

alter table public.group_teams alter column tournament_id set not null;
alter table public.match_predictions alter column tournament_id set not null;
alter table public.predicted_group_positions alter column tournament_id set not null;
alter table public.predicted_progression alter column tournament_id set not null;
alter table public.predicted_tie_resolutions alter column tournament_id set not null;
alter table public.bonus_predictions alter column tournament_id set not null;
alter table public.score_events alter column tournament_id set not null;
alter table public.bonus_competition_entrants alter column tournament_id set not null;
alter table public.bonus_competition_windows alter column tournament_id set not null;
alter table public.bonus_window_fixtures alter column tournament_id set not null;
alter table public.bonus_knockout_predictions
  alter column tournament_id set not null,
  alter column competition_id set not null;
alter table public.bonus_lms_selections alter column tournament_id set not null;
alter table public.bonus_score_events alter column tournament_id set not null;
alter table public.bonus_competition_audit alter column tournament_id set not null;
alter table public.bonus_cup_groups alter column tournament_id set not null;
alter table public.bonus_cup_members alter column tournament_id set not null;
alter table public.bonus_cup_fixtures alter column tournament_id set not null;
alter table public.bonus_cup_penalty_numbers alter column tournament_id set not null;

-- Existing direct browser ownership policies remain byte-for-byte effective.
-- New public relations are intentionally internal until bounded read paths are reviewed.


-- Stage C1 compatibility hardening discovered by the first disposable rebuild.
--
-- The foundation migration creates the new authorities. This companion keeps
-- those authorities private while preserving the established Euro tournament
-- prediction flow and making observed lock transitions monotonic.

-- The timezone helper participates in a tournaments CHECK constraint. Roles
-- that already have an authorised tournaments write path must be able to invoke
-- that harmless validator; predictor_internal remains outside the exposed API.
grant execute on function predictor_internal.is_valid_timezone(text)
  to anon, authenticated, service_role;

-- The trusted-refresh predicate below is `current_user`, and this function is
-- deliberately NOT `security definer`. Both matter, and an earlier draft of
-- this redefinition got both wrong:
--
--   * `session_user` is the login role. PostgREST connects as `authenticator`
--     and then `set role`s, so `session_user` is `authenticator` for every
--     browser AND every service-role request. It is never `postgres`, which
--     made the exemption permanently dead and caused automatic submission to
--     reject its own group-position refresh at the deadline.
--   * `security definer` here would make `current_user` always `postgres`
--     inside the trigger. `set_config` is executable by `authenticated`, so
--     that combination would let any signed-in user set the flag and write
--     positions after the lock. As `security invoker`, `current_user` is the
--     real caller, so the flag only helps inside the security-definer
--     processor chain that already runs as postgres.
--
-- The reads below (entries, tournaments, matches) are all granted to
-- `authenticated`, so no elevation is required. This matches contract 64.
create or replace function public.enforce_entry_lock_generic()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entry uuid;
  v_match uuid;
  v_tournament uuid;
  v_lock timestamptz;
  v_kickoff timestamptz;
  v_server_position_refresh boolean :=
    tg_table_schema = 'public'
    and tg_table_name = 'predicted_group_positions'
    and current_user = 'postgres'
    and coalesce(
      current_setting('predictor.auto_submission_refresh', true),
      ''
    ) = 'on';
begin
  if tg_op = 'DELETE' then
    v_entry := old.entry_id;
  else
    v_entry := new.entry_id;
  end if;

  select e.tournament_id, t.lock_at
    into v_tournament, v_lock
    from public.entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.id = v_entry;

  if v_tournament is null then
    raise exception 'Prediction references a missing entry'
      using errcode = 'foreign_key_violation';
  end if;

  if v_lock is null and not v_server_position_refresh then
    raise exception 'Predictions are unavailable — the tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if v_lock is not null and clock_timestamp() >= v_lock
     and not v_server_position_refresh
  then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  if tg_table_name = 'match_predictions' then
    if tg_op = 'DELETE' then
      v_match := old.match_id;
    else
      v_match := new.match_id;
    end if;

    select m.kickoff_at
      into v_kickoff
      from public.matches m
      where m.id = v_match;

    -- Euro 2028's original game remains tournament-wide before official
    -- kickoffs are known. Once a kickoff is known the per-fixture boundary is
    -- inclusive, and it is the server-side integrity floor beneath the round
    -- lock (ADR 0011).
    --
    -- It compares against the fixture's *current* kickoff, so it does not
    -- contradict the ADR 0020 reassignment model. Round locks stay monotonic
    -- and never reopen; an incomplete rescheduled fixture may later be
    -- reassigned to the round its new kickoff falls within, and is then
    -- governed by that destination round's lock. Stage C1 supplies the round,
    -- fixture-assignment and append-only lock-evidence primitives for that.
    -- The ingestion and administrative reassignment workflow is delivered
    -- separately.
    if v_kickoff is not null and clock_timestamp() >= v_kickoff then
      raise exception 'This prediction is locked — the match has kicked off'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_entry_lock_scores()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tournament uuid;
  v_lock timestamptz;
  v_kickoff timestamptz;
  v_score_changed boolean;
begin
  v_score_changed := tg_op = 'INSERT'
    or new.home_score is distinct from old.home_score
    or new.away_score is distinct from old.away_score;

  if not v_score_changed then
    return new;
  end if;

  select e.tournament_id, t.lock_at
    into v_tournament, v_lock
    from public.entries e
    join public.tournaments t on t.id = e.tournament_id
    where e.id = new.entry_id;

  if v_tournament is null then
    raise exception 'Prediction references a missing entry'
      using errcode = 'foreign_key_violation';
  end if;

  if v_lock is null then
    raise exception 'Predictions are unavailable — the tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if v_lock is not null and clock_timestamp() >= v_lock then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  select m.kickoff_at
    into v_kickoff
    from public.matches m
    where m.id = new.match_id;

  if v_kickoff is not null and clock_timestamp() >= v_kickoff then
    raise exception 'This prediction is locked — the match has kicked off'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_joker_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tournament uuid;
  v_kickoff timestamptz;
  joker_changed boolean;
begin
  joker_changed := (tg_op = 'INSERT' and new.joker)
                or (tg_op = 'UPDATE' and new.joker is distinct from old.joker);

  if not joker_changed then
    return new;
  end if;

  select m.tournament_id, m.kickoff_at
    into v_tournament, v_kickoff
    from public.matches m
    where m.id = new.match_id;

  if v_kickoff is null then
    raise exception 'Joker on match % is unavailable until kickoff is scheduled', new.match_id
      using errcode = 'check_violation';
  end if;

  if clock_timestamp() >= v_kickoff then
    raise exception 'Joker on match % is locked at kickoff and cannot be changed', new.match_id
      using errcode = 'check_violation';
  end if;

  if new.joker and (
    select count(*)
    from public.match_predictions
    where entry_id = new.entry_id
      and joker = true
      and match_id <> new.match_id
  ) >= 5 then
    raise exception 'Entry % already has the maximum of 5 jokers', new.entry_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_entry_lock_generic()
  from public, anon, authenticated;
revoke all on function public.enforce_entry_lock_scores()
  from public, anon, authenticated;
revoke all on function public.enforce_joker_rules()
  from public, anon, authenticated;

-- Season and round scope are integrity guarantees, not ordinary application
-- side effects. They remain active during controlled replica-mode imports and
-- rollback-only test fixtures that deliberately suppress unrelated user triggers.
alter table public.matches
  enable always trigger a_prepare_match_season_scope;
alter table public.group_teams
  enable always trigger a_prepare_competition_season_scope;
alter table public.match_predictions
  enable always trigger a_prepare_competition_season_scope;
alter table public.predicted_group_positions
  enable always trigger a_prepare_competition_season_scope;
alter table public.predicted_progression
  enable always trigger a_prepare_competition_season_scope;
alter table public.predicted_tie_resolutions
  enable always trigger a_prepare_competition_season_scope;
alter table public.bonus_predictions
  enable always trigger a_prepare_competition_season_scope;
alter table public.score_events
  enable always trigger a_prepare_competition_season_scope;
alter table public.bonus_competition_entrants
  enable always trigger a_prepare_competition_season_scope;
alter table public.bonus_competition_windows
  enable always trigger a_prepare_competition_season_scope;
alter table public.bonus_window_fixtures
  enable always trigger a_prepare_competition_season_scope;
alter table public.bonus_knockout_predictions
  enable always trigger a_prepare_competition_season_scope;
alter table public.bonus_lms_selections
  enable always trigger a_prepare_competition_season_scope;
alter table public.bonus_score_events
  enable always trigger a_prepare_competition_season_scope;
alter table public.bonus_competition_audit
  enable always trigger a_prepare_competition_season_scope;
alter table public.bonus_cup_groups
  enable always trigger a_prepare_competition_season_scope;
alter table public.bonus_cup_members
  enable always trigger a_prepare_competition_season_scope;
alter table public.bonus_cup_fixtures
  enable always trigger a_prepare_competition_season_scope;
alter table public.bonus_cup_penalty_numbers
  enable always trigger a_prepare_competition_season_scope;
