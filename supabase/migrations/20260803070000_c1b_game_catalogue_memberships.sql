begin;

-- C1b: persistent game catalogue, per-season availability and canonical
-- membership lifecycle. The legacy bonus_* names remain internal identifiers;
-- bonus_competitions is now the canonical per-season game availability root.
-- No C2 ownership, profile or auth-deletion boundary changes are made here.

create table public.game_definitions (
  game_key text primary key,
  display_name text not null,
  requires_prediction_entry boolean not null default false,
  lock_scope text not null,
  buffer_minutes smallint not null,
  allow_rejoin boolean not null,
  created_at timestamptz not null default now(),
  constraint game_definitions_key_shape
    check (game_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint game_definitions_name_length
    check (char_length(btrim(display_name)) between 1 and 80),
  constraint game_definitions_lock_scope_allowed
    check (lock_scope in ('entry', 'round', 'match')),
  constraint game_definitions_buffer_range
    check (buffer_minutes between 0 and 1440)
);

alter table public.game_definitions enable row level security;
revoke all on table public.game_definitions from public, anon, authenticated, service_role;

insert into public.game_definitions (
  game_key,
  display_name,
  requires_prediction_entry,
  lock_scope,
  buffer_minutes,
  allow_rejoin
) values
  ('original_predictor', 'Original Predictor', true,  'entry', 0,  true),
  ('main_predictor',     'Main Predictor',     true,  'round', 0,  true),
  ('ko_predictor',       'KO Predictor',       false, 'match', 0,  true),
  ('last_man_standing',  'Last Man Standing',  false, 'round', 30, false),
  ('predictor_cup',      'Predictor Championship', false, 'round', 0, true);

alter table public.bonus_competitions
  drop constraint bonus_competitions_game_key_check;

alter table public.bonus_competitions
  add constraint bonus_competitions_game_key_fkey
    foreign key (game_key)
    references public.game_definitions(game_key)
    on update restrict
    on delete restrict;

alter table public.bonus_competitions
  add column availability_status text;

update public.bonus_competitions
set availability_status = case when published then 'active' else 'inactive' end;

alter table public.bonus_competitions
  alter column availability_status set default null,
  alter column availability_status set not null,
  add constraint bonus_competitions_availability_status_allowed
    check (availability_status in ('inactive', 'active', 'closed'));

create or replace function predictor_internal.prepare_game_availability_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.availability_status is null then
    new.availability_status := case when new.published then 'active' else 'inactive' end;
  elsif tg_op = 'UPDATE'
        and new.published is distinct from old.published
        and new.availability_status is not distinct from old.availability_status
  then
    new.availability_status := case when new.published then 'active' else 'inactive' end;
  end if;
  return new;
end;
$$;

create trigger a_prepare_game_availability_status
before insert or update of published, availability_status
on public.bonus_competitions
for each row
execute function predictor_internal.prepare_game_availability_status();

revoke all on function predictor_internal.prepare_game_availability_status()
  from public, anon, authenticated, service_role;

comment on table public.bonus_competitions is
  'Canonical per-competition-season game availability. Legacy name retained for compatibility.';
comment on column public.bonus_competitions.published is
  'Legacy Bonus Games surface visibility; generic Hub availability uses availability_status.';
comment on column public.bonus_competitions.availability_status is
  'Canonical inactive/active/closed availability state for this season game.';

create or replace function predictor_internal.assert_game_availability_shape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  select season.kind
    into v_kind
    from public.tournaments season
    where season.id = new.tournament_id;

  if v_kind is null then
    raise exception 'Game availability references a missing competition season'
      using errcode = 'foreign_key_violation';
  end if;

  if new.game_key = 'original_predictor' and v_kind <> 'tournament' then
    raise exception 'Original Predictor is available only for tournament seasons'
      using errcode = 'check_violation';
  end if;

  if new.game_key = 'main_predictor' and v_kind <> 'league_season' then
    raise exception 'Main Predictor is available only for league seasons'
      using errcode = 'check_violation';
  end if;

  if new.game_key = 'ko_predictor' and v_kind <> 'tournament' then
    raise exception 'KO Predictor is available only for tournament seasons'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.assert_game_availability_shape()
  from public, anon, authenticated, service_role;

create trigger assert_game_availability_shape
before insert or update of tournament_id, game_key
on public.bonus_competitions
for each row
execute function predictor_internal.assert_game_availability_shape();

-- Add the first domestic rehearsal seasons without inventing fixture dates.
insert into public.competitions (slug, name)
values
  ('premier-league', 'Premier League'),
  ('scottish-premiership', 'Scottish Premiership')
on conflict (slug) do update
set name = excluded.name;

insert into public.tournaments (
  name,
  year,
  competition_id,
  season_key,
  kind,
  display_timezone,
  status
)
select
  seed.name,
  2026,
  competition.id,
  '2026-27',
  'league_season',
  'Europe/London',
  'draft'
from (values
  ('premier-league', 'Premier League 2026/27'),
  ('scottish-premiership', 'Scottish Premiership 2026/27')
) as seed(slug, name)
join public.competitions competition on competition.slug = seed.slug
on conflict (competition_id, season_key) do nothing;

-- Tournament-shaped seasons always own one hidden Original Predictor
-- availability. It is active for the generic Hub and deliberately unpublished
-- so the legacy Bonus Games read remains limited to KO/LMS/Championship.
create or replace function predictor_internal.ensure_original_predictor_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
begin
  if new.kind = 'tournament' then
    insert into public.bonus_competitions (
      tournament_id,
      game_key,
      published,
      availability_status,
      registration_opens_at,
      registration_closes_at,
      draw_required
    ) values (
      new.id,
      'original_predictor',
      false,
      'active',
      case
        when new.lock_at is not null and new.lock_at <= new.created_at
          then new.lock_at - interval '1 second'
        else new.created_at
      end,
      new.lock_at,
      false
    )
    on conflict (tournament_id, game_key) do update
      set registration_closes_at = excluded.registration_closes_at,
          availability_status = 'active',
          updated_at = now()
      where public.bonus_competitions.game_key = 'original_predictor'
        and not public.bonus_competitions.published;
  end if;

  return new;
end;
$;

revoke all on function predictor_internal.ensure_original_predictor_availability()
  from public, anon, authenticated, service_role;

create trigger ensure_original_predictor_availability
after insert or update of kind, lock_at
on public.tournaments
for each row
execute function predictor_internal.ensure_original_predictor_availability();

insert into public.bonus_competitions (
  tournament_id,
  game_key,
  published,
  availability_status,
  registration_opens_at,
  registration_closes_at,
  draw_required
)
select
  season.id,
  'original_predictor',
  false,
  'active',
  case
    when season.lock_at is not null and season.lock_at <= season.created_at
      then season.lock_at - interval '1 second'
    else season.created_at
  end,
  season.lock_at,
  false
from public.tournaments season
where season.kind = 'tournament'
on conflict (tournament_id, game_key) do nothing;

-- Domestic availability is intentionally inactive until its persistent
-- prediction and scoring vertical slice is ready. Catalogue rows are still
-- stable and can be referenced by membership, routes and administration.
insert into public.bonus_competitions (
  tournament_id,
  game_key,
  published,
  availability_status,
  draw_required
)
select
  season.id,
  game.game_key,
  false,
  'inactive',
  game.game_key = 'predictor_cup'
from public.tournaments season
cross join (values
  ('main_predictor'),
  ('last_man_standing'),
  ('predictor_cup')
) as game(game_key)
where season.kind = 'league_season'
  and season.season_key = '2026-27'
  and exists (
    select 1
    from public.competitions competition
    where competition.id = season.competition_id
      and competition.slug in ('premier-league', 'scottish-premiership')
  )
on conflict (tournament_id, game_key) do nothing;

create table public.game_memberships (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  game_competition_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  active_since timestamptz,
  left_at timestamptz,
  disqualified_at timestamptz,
  rejoin_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_memberships_game_fkey
    foreign key (tournament_id, game_competition_id)
    references public.bonus_competitions(tournament_id, id)
    on delete cascade,
  constraint game_memberships_status_allowed
    check (status in ('active', 'left', 'disqualified')),
  constraint game_memberships_rejoin_nonnegative
    check (rejoin_count >= 0),
  constraint game_memberships_state_shape
    check (
      (status = 'active' and active_since is not null and left_at is null and disqualified_at is null)
      or (status = 'left' and left_at is not null and disqualified_at is null)
      or (status = 'disqualified' and disqualified_at is not null)
    ),
  constraint game_memberships_game_user_key
    unique (game_competition_id, user_id),
  constraint game_memberships_tournament_game_user_key
    unique (tournament_id, game_competition_id, user_id),
  constraint game_memberships_id_scope_key
    unique (id, tournament_id, game_competition_id, user_id)
);

alter table public.game_memberships enable row level security;
revoke all on table public.game_memberships from public, anon, authenticated, service_role;
grant select on table public.game_memberships to authenticated, service_role;

create policy "own game memberships readable"
on public.game_memberships
for select
to authenticated
using (user_id = (select auth.uid()));

create table public.game_membership_events (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.game_memberships(id) on delete cascade,
  tournament_id uuid not null,
  game_competition_id uuid not null,
  user_id uuid not null,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  constraint game_membership_events_membership_scope_fkey
    foreign key (membership_id, tournament_id, game_competition_id, user_id)
    references public.game_memberships(id, tournament_id, game_competition_id, user_id)
    on delete cascade,
  constraint game_membership_events_type_allowed
    check (event_type in ('joined', 'rejoined', 'left', 'disqualified'))
);

create index game_membership_events_membership_idx
  on public.game_membership_events (membership_id, recorded_at, id);

alter table public.game_membership_events enable row level security;
revoke all on table public.game_membership_events from public, anon, authenticated, service_role;

create or replace function predictor_internal.block_game_membership_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Foreign-key cascades and SET NULL actions run from a parent trigger at a
  -- nested depth. Preserve the existing auth-deletion semantics while refusing
  -- every direct attempt to rewrite or remove membership history.
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  raise exception 'Game membership events are immutable'
    using errcode = '42501';
end;
$$;

create trigger block_game_membership_event_mutation
before update or delete on public.game_membership_events
for each row
execute function predictor_internal.block_game_membership_event_mutation();

revoke all on function predictor_internal.block_game_membership_event_mutation()
  from public, anon, authenticated, service_role;

create or replace function predictor_internal.record_game_membership_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
begin
  if tg_op = 'INSERT' then
    v_event := 'joined';
  elsif old.status = 'left' and new.status = 'active' then
    v_event := 'rejoined';
  elsif old.status is distinct from new.status and new.status = 'left' then
    v_event := 'left';
  elsif old.status is distinct from new.status and new.status = 'disqualified' then
    v_event := 'disqualified';
  else
    return new;
  end if;

  insert into public.game_membership_events (
    membership_id,
    tournament_id,
    game_competition_id,
    user_id,
    event_type,
    detail,
    actor_id,
    recorded_at
  ) values (
    new.id,
    new.tournament_id,
    new.game_competition_id,
    new.user_id,
    v_event,
    jsonb_strip_nulls(jsonb_build_object(
      'previous_status', case when tg_op = 'UPDATE' then old.status else null end,
      'rejoin_count', new.rejoin_count,
      'reason', nullif(current_setting('predictor.membership_event_reason', true), '')
    )),
    (select auth.uid()),
    case when tg_op = 'INSERT' then new.joined_at else now() end
  );

  return new;
end;
$$;

create trigger record_game_membership_event
after insert or update of status
on public.game_memberships
for each row
execute function predictor_internal.record_game_membership_event();

revoke all on function predictor_internal.record_game_membership_event()
  from public, anon, authenticated, service_role;

-- Backfill canonical membership from both existing entry stores. The earliest
-- observed join wins if the user already participates through both stores.
insert into public.game_memberships (
  tournament_id,
  game_competition_id,
  user_id,
  status,
  joined_at,
  active_since
)
select
  entry.tournament_id,
  availability.id,
  entry.user_id,
  'active',
  entry.created_at,
  entry.created_at
from public.entries entry
join public.tournaments season on season.id = entry.tournament_id
join public.bonus_competitions availability
  on availability.tournament_id = entry.tournament_id
 and availability.game_key = case
   when season.kind = 'league_season' then 'main_predictor'
   else 'original_predictor'
 end
on conflict (game_competition_id, user_id) do nothing;

insert into public.game_memberships (
  tournament_id,
  game_competition_id,
  user_id,
  status,
  joined_at,
  active_since
)
select
  entrant.tournament_id,
  entrant.competition_id,
  entrant.user_id,
  'active',
  entrant.joined_at,
  entrant.joined_at
from public.bonus_competition_entrants entrant
on conflict (game_competition_id, user_id) do update
set joined_at = least(public.game_memberships.joined_at, excluded.joined_at),
    active_since = least(public.game_memberships.active_since, excluded.active_since),
    updated_at = now();

alter table public.entries
  add column game_competition_id uuid,
  add column game_membership_id uuid;

update public.entries entry
set game_competition_id = membership.game_competition_id,
    game_membership_id = membership.id
from public.game_memberships membership
where membership.tournament_id = entry.tournament_id
  and membership.user_id = entry.user_id
  and exists (
    select 1
    from public.bonus_competitions availability
    where availability.id = membership.game_competition_id
      and availability.game_key in ('original_predictor', 'main_predictor')
  );

alter table public.entries
  add constraint entries_tournament_game_fkey
    foreign key (tournament_id, game_competition_id)
    references public.bonus_competitions(tournament_id, id)
    on delete restrict
    not valid,
  add constraint entries_membership_fkey
    foreign key (game_membership_id, tournament_id, game_competition_id, user_id)
    references public.game_memberships(id, tournament_id, game_competition_id, user_id)
    on delete cascade
    not valid,
  add constraint entries_game_user_key
    unique (game_competition_id, user_id);

alter table public.entries
  validate constraint entries_tournament_game_fkey,
  validate constraint entries_membership_fkey;

-- These linkage columns remain nullable for trusted legacy/import fixtures
-- that deliberately run with triggers disabled. Every ordinary C1b write and
-- every preserved row is populated and constrained by the scoped foreign keys.

alter table public.bonus_competition_entrants
  add column game_membership_id uuid;

update public.bonus_competition_entrants entrant
set game_membership_id = membership.id
from public.game_memberships membership
where membership.game_competition_id = entrant.competition_id
  and membership.user_id = entrant.user_id;

alter table public.bonus_competition_entrants
  add constraint bonus_entrants_membership_fkey
    foreign key (game_membership_id, tournament_id, competition_id, user_id)
    references public.game_memberships(id, tournament_id, game_competition_id, user_id)
    on delete cascade
    not valid,
  add constraint bonus_entrants_membership_key unique (game_membership_id);

alter table public.bonus_competition_entrants
  validate constraint bonus_entrants_membership_fkey;

-- Legacy/import fixtures may bypass triggers; ordinary Bonus Games and Hub
-- writes always populate this linkage through the preparation trigger.

create or replace function predictor_internal.prepare_entry_game_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id uuid;
  v_membership_id uuid;
  v_status text;
begin
  v_game_id := new.game_competition_id;

  if v_game_id is null then
    select availability.id
      into v_game_id
      from public.bonus_competitions availability
      join public.tournaments season on season.id = availability.tournament_id
      where availability.tournament_id = new.tournament_id
        and availability.game_key = case
          when season.kind = 'league_season' then 'main_predictor'
          else 'original_predictor'
        end;
  end if;

  if not exists (
    select 1
    from public.bonus_competitions availability
    join public.game_definitions definition on definition.game_key = availability.game_key
    where availability.id = v_game_id
      and availability.tournament_id = new.tournament_id
      and availability.availability_status = 'active'
      and definition.requires_prediction_entry
  ) then
    raise exception 'Entry must belong to the season Main or Original Predictor'
      using errcode = 'check_violation';
  end if;

  select membership.id, membership.status
    into v_membership_id, v_status
    from public.game_memberships membership
    where membership.game_competition_id = v_game_id
      and membership.user_id = new.user_id
    for update;

  if v_membership_id is null then
    insert into public.game_memberships (
      tournament_id,
      game_competition_id,
      user_id,
      status,
      active_since
    ) values (
      new.tournament_id,
      v_game_id,
      new.user_id,
      'active',
      now()
    )
    returning id, status into v_membership_id, v_status;
  end if;

  if v_status <> 'active' then
    raise exception 'Join or rejoin the game before creating an entry'
      using errcode = 'insufficient_privilege';
  end if;

  new.game_competition_id := v_game_id;
  new.game_membership_id := v_membership_id;
  return new;
end;
$$;

create trigger aa_prepare_entry_game_membership
before insert or update of tournament_id, user_id, game_competition_id, game_membership_id
on public.entries
for each row
execute function predictor_internal.prepare_entry_game_membership();

revoke all on function predictor_internal.prepare_entry_game_membership()
  from public, anon, authenticated, service_role;

create or replace function predictor_internal.prepare_bonus_entrant_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament uuid;
  v_membership_id uuid;
  v_status text;
begin
  select availability.tournament_id
    into v_tournament
    from public.bonus_competitions availability
    where availability.id = new.competition_id;

  if v_tournament is null then
    raise exception 'Game availability not found'
      using errcode = 'foreign_key_violation';
  end if;

  select membership.id, membership.status
    into v_membership_id, v_status
    from public.game_memberships membership
    where membership.game_competition_id = new.competition_id
      and membership.user_id = new.user_id
    for update;

  if v_membership_id is null then
    insert into public.game_memberships (
      tournament_id,
      game_competition_id,
      user_id,
      status,
      active_since
    ) values (
      v_tournament,
      new.competition_id,
      new.user_id,
      'active',
      now()
    )
    returning id, status into v_membership_id, v_status;
  end if;

  if v_status <> 'active' then
    raise exception 'Game participation requires an active membership'
      using errcode = 'insufficient_privilege';
  end if;

  new.tournament_id := v_tournament;
  new.game_membership_id := v_membership_id;
  return new;
end;
$$;

create trigger aa_prepare_bonus_entrant_membership
before insert or update of competition_id, user_id, game_membership_id
on public.bonus_competition_entrants
for each row
execute function predictor_internal.prepare_bonus_entrant_membership();

revoke all on function predictor_internal.prepare_bonus_entrant_membership()
  from public, anon, authenticated, service_role;

-- Existing bonus-game write RPCs continue to use their original payload tables,
-- but every user-owned write is now gated by the canonical active membership.
create or replace function predictor_internal.assert_active_game_payload_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_competition uuid;
  v_tournament uuid;
  v_active boolean;
begin
  v_user := new.user_id;

  if tg_table_name = 'bonus_knockout_predictions' then
    select match.tournament_id
      into v_tournament
      from public.matches match
      where match.id = new.match_id;

    select exists (
      select 1
      from public.game_memberships membership
      join public.bonus_competitions availability
        on availability.id = membership.game_competition_id
      where membership.tournament_id = v_tournament
        and membership.user_id = v_user
        and membership.status = 'active'
        and availability.game_key in ('ko_predictor', 'predictor_cup')
    ) into v_active;
  else
    v_competition := new.competition_id;
    select exists (
      select 1
      from public.game_memberships membership
      where membership.game_competition_id = v_competition
        and membership.user_id = v_user
        and membership.status = 'active'
    ) into v_active;
  end if;

  if not coalesce(v_active, false) then
    raise exception 'Join or rejoin this game before saving game data'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger z_assert_active_knockout_membership
before insert or update
on public.bonus_knockout_predictions
for each row
execute function predictor_internal.assert_active_game_payload_membership();

create trigger z_assert_active_lms_membership
before insert or update
on public.bonus_lms_selections
for each row
execute function predictor_internal.assert_active_game_payload_membership();

create trigger z_assert_active_cup_membership
before insert or update
on public.bonus_cup_penalty_numbers
for each row
execute function predictor_internal.assert_active_game_payload_membership();

revoke all on function predictor_internal.assert_active_game_payload_membership()
  from public, anon, authenticated, service_role;

alter table public.leagues
  add column game_competition_id uuid;

update public.leagues league
set game_competition_id = availability.id
from public.bonus_competitions availability
join public.tournaments season on season.id = availability.tournament_id
where availability.tournament_id = league.tournament_id
  and availability.game_key = case
    when season.kind = 'league_season' then 'main_predictor'
    else 'original_predictor'
  end;

alter table public.leagues
  add constraint leagues_tournament_game_fkey
    foreign key (tournament_id, game_competition_id)
    references public.bonus_competitions(tournament_id, id)
    on delete restrict
    not valid;

alter table public.leagues validate constraint leagues_tournament_game_fkey;
-- Existing trusted fixtures may remain tournament-scoped when they bypass the
-- RPC boundary. New Hub league creation always persists game_competition_id.

create or replace function public.get_competition_games(
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
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.tournaments where id = p_tournament_id) then
    raise exception 'Competition season not found'
      using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'competition_member', exists (
      select 1
      from public.game_memberships membership
      where membership.tournament_id = p_tournament_id
        and membership.user_id = v_uid
        and membership.status = 'active'
    ),
    'games', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', availability.id,
          'game_key', availability.game_key,
          'display_name', definition.display_name,
          'active', availability.availability_status = 'active',
          'registration_opens_at', availability.registration_opens_at,
          'registration_closes_at', availability.registration_closes_at,
          'completed_at', availability.completed_at,
          'lock_policy', jsonb_build_object(
            'scope', definition.lock_scope,
            'buffer_minutes', definition.buffer_minutes
          ),
          'allow_rejoin', definition.allow_rejoin,
          'membership', case when membership.id is null then null else
            jsonb_build_object(
              'id', membership.id,
              'status', membership.status,
              'joined_at', membership.joined_at,
              'active_since', membership.active_since,
              'left_at', membership.left_at,
              'disqualified_at', membership.disqualified_at,
              'rejoin_count', membership.rejoin_count
            ) end
        )
        order by availability.game_key
      )
      from public.bonus_competitions availability
      join public.game_definitions definition on definition.game_key = availability.game_key
      left join public.game_memberships membership
        on membership.game_competition_id = availability.id
       and membership.user_id = v_uid
      where availability.tournament_id = p_tournament_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.join_competition_game(
  p_game_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_availability public.bonus_competitions%rowtype;
  v_definition public.game_definitions%rowtype;
  v_membership public.game_memberships%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select availability.*
    into v_availability
    from public.bonus_competitions availability
    where availability.id = p_game_competition_id
    for update;

  if not found or v_availability.availability_status <> 'active' then
    raise exception 'Game not found'
      using errcode = 'no_data_found';
  end if;

  select * into strict v_definition
    from public.game_definitions
    where game_key = v_availability.game_key;

  if v_availability.completed_at is not null then
    raise exception 'This game has finished'
      using errcode = '55000';
  end if;

  if v_availability.registration_opens_at is null
     or now() < v_availability.registration_opens_at then
    raise exception 'Registration has not opened'
      using errcode = '55000';
  end if;

  if v_availability.registration_closes_at is not null
     and now() >= v_availability.registration_closes_at then
    raise exception 'Registration has closed'
      using errcode = '55000';
  end if;

  select * into v_membership
    from public.game_memberships membership
    where membership.game_competition_id = p_game_competition_id
      and membership.user_id = v_uid
    for update;

  if found then
    if v_membership.status = 'active' then
      raise exception 'You have already entered this game'
        using errcode = 'unique_violation';
    end if;

    if v_membership.status = 'disqualified' then
      raise exception 'A disqualified game entry cannot be rejoined'
        using errcode = '55000';
    end if;

    if not v_definition.allow_rejoin then
      raise exception 'This game cannot be rejoined after leaving'
        using errcode = '55000';
    end if;

    update public.game_memberships membership
      set status = 'active',
          active_since = now(),
          left_at = null,
          disqualified_at = null,
          rejoin_count = membership.rejoin_count + 1,
          updated_at = now()
      where membership.id = v_membership.id
      returning * into v_membership;
  else
    insert into public.game_memberships (
      tournament_id,
      game_competition_id,
      user_id,
      status,
      active_since
    ) values (
      v_availability.tournament_id,
      v_availability.id,
      v_uid,
      'active',
      now()
    )
    returning * into v_membership;
  end if;

  if v_definition.requires_prediction_entry then
    insert into public.entries (
      user_id,
      tournament_id,
      game_competition_id,
      game_membership_id
    ) values (
      v_uid,
      v_availability.tournament_id,
      v_availability.id,
      v_membership.id
    )
    on conflict (user_id, tournament_id) do nothing;
  else
    insert into public.bonus_competition_entrants (
      competition_id,
      user_id,
      game_membership_id
    ) values (
      v_availability.id,
      v_uid,
      v_membership.id
    )
    on conflict (competition_id, user_id) do update
      set game_membership_id = excluded.game_membership_id,
          updated_at = now();
  end if;

  return jsonb_build_object(
    'game_competition_id', v_availability.id,
    'game_key', v_availability.game_key,
    'membership_id', v_membership.id,
    'status', v_membership.status,
    'joined_at', v_membership.joined_at,
    'active_since', v_membership.active_since,
    'rejoin_count', v_membership.rejoin_count
  );
end;
$$;

create or replace function public.leave_competition_game(
  p_game_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_availability public.bonus_competitions%rowtype;
  v_definition public.game_definitions%rowtype;
  v_membership public.game_memberships%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_availability
    from public.bonus_competitions
    where id = p_game_competition_id
    for update;

  if not found then
    raise exception 'Game not found'
      using errcode = 'no_data_found';
  end if;

  select * into strict v_definition
    from public.game_definitions
    where game_key = v_availability.game_key;

  select * into v_membership
    from public.game_memberships
    where game_competition_id = p_game_competition_id
      and user_id = v_uid
    for update;

  if not found or v_membership.status <> 'active' then
    raise exception 'You are not actively entered in this game'
      using errcode = 'no_data_found';
  end if;

  if v_availability.completed_at is not null then
    raise exception 'This game has finished'
      using errcode = '55000';
  end if;

  if not v_definition.requires_prediction_entry then
    if exists (
      select 1 from public.bonus_score_events event
      where event.competition_id = p_game_competition_id
        and event.user_id = v_uid
    ) then
      raise exception 'You cannot leave after scoring has started for you'
        using errcode = '55000';
    end if;

    if v_availability.game_key = 'predictor_cup'
       and exists (
         select 1 from public.bonus_cup_members member
         where member.competition_id = p_game_competition_id
           and member.user_id = v_uid
       ) then
      raise exception 'You cannot leave after the Championship draw'
        using errcode = '55000';
    end if;

    delete from public.bonus_competition_entrants entrant
    where entrant.competition_id = p_game_competition_id
      and entrant.user_id = v_uid;
  end if;

  update public.game_memberships membership
    set status = 'left',
        left_at = now(),
        updated_at = now()
    where membership.id = v_membership.id;

  return jsonb_build_object(
    'game_competition_id', p_game_competition_id,
    'status', 'left',
    'may_rejoin', v_definition.allow_rejoin
  );
end;
$$;

create or replace function public.admin_disqualify_competition_game_entry(
  p_game_competition_id uuid,
  p_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.game_memberships%rowtype;
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A disqualification reason is required'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_membership
    from public.game_memberships
    where game_competition_id = p_game_competition_id
      and user_id = p_user_id
    for update;

  if not found then
    raise exception 'Game membership not found'
      using errcode = 'no_data_found';
  end if;

  perform set_config('predictor.membership_event_reason', btrim(p_reason), true);

  update public.game_memberships membership
    set status = 'disqualified',
        disqualified_at = now(),
        left_at = null,
        updated_at = now()
    where membership.id = v_membership.id;

  perform set_config('predictor.membership_event_reason', '', true);

  update public.bonus_competition_entrants entrant
    set outcome = 'eliminated', updated_at = now()
    where entrant.competition_id = p_game_competition_id
      and entrant.user_id = p_user_id;

  return jsonb_build_object(
    'game_competition_id', p_game_competition_id,
    'user_id', p_user_id,
    'status', 'disqualified'
  );
end;
$$;

-- Compatibility wrappers retain the existing browser contract while routing
-- every mutation through the canonical membership lifecycle.
create or replace function public.register_bonus_competition(
  p_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $
declare
  v_uid uuid := (select auth.uid());
  v_competition public.bonus_competitions%rowtype;
  v_joined_at timestamptz;
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

  perform public.join_competition_game(p_competition_id);

  select entrant.joined_at
    into v_joined_at
    from public.bonus_competition_entrants entrant
    where entrant.competition_id = p_competition_id
      and entrant.user_id = v_uid;

  insert into public.bonus_competition_audit (competition_id, action, detail, actor_id)
  values (
    p_competition_id,
    'entrant_registered',
    jsonb_build_object('user_id', v_uid),
    v_uid
  );

  return jsonb_build_object(
    'competition_id', p_competition_id,
    'joined_at', v_joined_at,
    'outcome', 'active'
  );
end;
$;

create or replace function public.withdraw_bonus_competition(
  p_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $
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

  perform public.leave_competition_game(p_competition_id);

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
$;

create or replace function public.create_game_league(
  p_game_competition_id uuid,
  p_name text
)
returns table(id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_tournament_id uuid;
  v_id uuid;
  v_code text;
  v_try integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  if length(v_name) < 1 or length(v_name) > 40 then
    raise exception 'League name must be 1 to 40 characters'
      using errcode = 'check_violation';
  end if;

  select availability.tournament_id
    into v_tournament_id
    from public.bonus_competitions availability
    join public.game_definitions definition on definition.game_key = availability.game_key
    join public.game_memberships membership
      on membership.game_competition_id = availability.id
     and membership.user_id = v_uid
     and membership.status = 'active'
    where availability.id = p_game_competition_id
      and definition.requires_prediction_entry;

  if v_tournament_id is null then
    raise exception 'Join the Main or Original Predictor before creating a league'
      using errcode = 'insufficient_privilege';
  end if;

  loop
    v_try := v_try + 1;
    v_code := public.gen_invite_code();
    begin
      insert into public.leagues (
        tournament_id,
        game_competition_id,
        owner_id,
        name,
        invite_code
      ) values (
        v_tournament_id,
        p_game_competition_id,
        v_uid,
        v_name,
        v_code
      ) returning leagues.id into v_id;
      exit;
    exception when unique_violation then
      if v_try >= 10 then
        raise exception 'Could not allocate an invite code, please retry';
      end if;
    end;
  end loop;

  insert into public.league_members (league_id, user_id, role)
  values (v_id, v_uid, 'owner');

  return query select v_id, v_name, v_code;
end;
$$;

create or replace function public.create_league(
  p_tournament_id uuid,
  p_name text
)
returns table(id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id uuid;
begin
  select availability.id
    into v_game_id
    from public.bonus_competitions availability
    join public.game_definitions definition on definition.game_key = availability.game_key
    where availability.tournament_id = p_tournament_id
      and definition.requires_prediction_entry
    order by case availability.game_key
      when 'main_predictor' then 1
      when 'original_predictor' then 2
      else 3
    end
    limit 1;

  if v_game_id is null then
    raise exception 'The season has no Main or Original Predictor'
      using errcode = 'no_data_found';
  end if;

  return query
    select * from public.create_game_league(v_game_id, p_name);
end;
$$;

create or replace function public.join_league(
  p_code text
)
returns table(id uuid, name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_game_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  select league.id, league.game_competition_id
    into v_id, v_game_id
    from public.leagues league
    where league.invite_code = upper(btrim(p_code));

  if v_id is null then
    raise exception 'That invite code does not match a league'
      using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1 from public.game_memberships membership
    where membership.game_competition_id = v_game_id
      and membership.user_id = v_uid
      and membership.status = 'active'
  ) then
    raise exception 'Join this league game before joining its private league'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_id, v_uid, 'member')
  on conflict (league_id, user_id) do nothing;

  return query
    select league.id, league.name
    from public.leagues league
    where league.id = v_id;
end;
$$;

create or replace function public.get_my_game_leagues(
  p_game_competition_id uuid
)
returns table(
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
    (select count(*)::integer from public.league_members m where m.league_id = league.id),
    league.owner_id = (select auth.uid()),
    (select profile.display_name from public.profiles profile where profile.id = league.owner_id),
    (select max(m.joined_at) from public.league_members m where m.league_id = league.id)
  from public.leagues league
  join public.league_members own
    on own.league_id = league.id
   and own.user_id = (select auth.uid())
  where league.game_competition_id = p_game_competition_id
  order by league.created_at, league.id
  limit 20;
$$;

-- Existing tournament-wide league read remains compatible and is now a union
-- of game-specific leagues inside that season.
create or replace function public.get_my_leagues(
  p_tournament_id uuid
)
returns table(
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
    (select count(*)::integer from public.league_members m where m.league_id = league.id),
    league.owner_id = (select auth.uid()),
    (select profile.display_name from public.profiles profile where profile.id = league.owner_id),
    (select max(m.joined_at) from public.league_members m where m.league_id = league.id)
  from public.leagues league
  join public.league_members own
    on own.league_id = league.id
   and own.user_id = (select auth.uid())
  where league.tournament_id = p_tournament_id
  order by league.created_at, league.id
  limit 20;
$$;

-- Original/Main prediction writes must honour canonical membership state. The
-- functions remain SECURITY INVOKER and retain their empty search path.
create or replace function public.enforce_entry_lock_scores()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tournament uuid;
  v_membership_status text;
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

  select entry.tournament_id, membership.status, tournament.lock_at
    into v_tournament, v_membership_status, v_lock
    from public.entries entry
    join public.game_memberships membership on membership.id = entry.game_membership_id
    join public.tournaments tournament on tournament.id = entry.tournament_id
    where entry.id = new.entry_id;

  if v_tournament is null then
    raise exception 'Prediction references a missing entry'
      using errcode = 'foreign_key_violation';
  end if;

  if v_membership_status <> 'active' then
    raise exception 'Join or rejoin this game before editing predictions'
      using errcode = 'insufficient_privilege';
  end if;

  if v_lock is null then
    raise exception 'Predictions are unavailable — the tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if clock_timestamp() >= v_lock then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  select match.kickoff_at into v_kickoff
  from public.matches match where match.id = new.match_id;

  if v_kickoff is not null and clock_timestamp() >= v_kickoff then
    raise exception 'This prediction is locked — the match has kicked off'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_entry_lock_generic()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entry uuid;
  v_match uuid;
  v_tournament uuid;
  v_membership_status text;
  v_lock timestamptz;
  v_kickoff timestamptz;
  v_server_position_refresh boolean :=
    tg_table_schema = 'public'
    and tg_table_name = 'predicted_group_positions'
    and current_user = 'postgres'
    and coalesce(current_setting('predictor.auto_submission_refresh', true), '') = 'on';
begin
  v_entry := case when tg_op = 'DELETE' then old.entry_id else new.entry_id end;

  select entry.tournament_id, membership.status, tournament.lock_at
    into v_tournament, v_membership_status, v_lock
    from public.entries entry
    join public.game_memberships membership on membership.id = entry.game_membership_id
    join public.tournaments tournament on tournament.id = entry.tournament_id
    where entry.id = v_entry;

  if v_tournament is null then
    raise exception 'Prediction references a missing entry'
      using errcode = 'foreign_key_violation';
  end if;

  if v_membership_status <> 'active' and not v_server_position_refresh then
    raise exception 'Join or rejoin this game before editing predictions'
      using errcode = 'insufficient_privilege';
  end if;

  if v_lock is null and not v_server_position_refresh then
    raise exception 'Predictions are unavailable — the tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if v_lock is not null and clock_timestamp() >= v_lock
     and not v_server_position_refresh then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  if tg_table_name = 'match_predictions' then
    v_match := case when tg_op = 'DELETE' then old.match_id else new.match_id end;
    select match.kickoff_at into v_kickoff
    from public.matches match where match.id = v_match;

    if v_kickoff is not null and clock_timestamp() >= v_kickoff then
      raise exception 'This prediction is locked — the match has kicked off'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.enforce_joker_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_membership_status text;
  v_kickoff timestamptz;
  joker_changed boolean;
begin
  joker_changed := (tg_op = 'INSERT' and new.joker)
                or (tg_op = 'UPDATE' and new.joker is distinct from old.joker);

  if not joker_changed then return new; end if;

  select membership.status
    into v_membership_status
    from public.entries entry
    join public.game_memberships membership on membership.id = entry.game_membership_id
    where entry.id = new.entry_id;

  if v_membership_status <> 'active' then
    raise exception 'Join or rejoin this game before changing a Joker'
      using errcode = 'insufficient_privilege';
  end if;

  select match.kickoff_at into v_kickoff
  from public.matches match where match.id = new.match_id;

  if v_kickoff is null then
    raise exception 'Joker on match % is unavailable until kickoff is scheduled', new.match_id
      using errcode = 'check_violation';
  end if;

  if clock_timestamp() >= v_kickoff then
    raise exception 'Joker on match % is locked at kickoff and cannot be changed', new.match_id
      using errcode = 'check_violation';
  end if;

  if new.joker and (
    select count(*) from public.match_predictions
    where entry_id = new.entry_id and joker and match_id <> new.match_id
  ) >= 5 then
    raise exception 'Entry % already has the maximum of 5 jokers', new.entry_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function public.submit_entry(p_entry_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_membership_status text;
  v_lock timestamptz;
  v_when timestamptz;
begin
  select entry.user_id, membership.status, tournament.lock_at
    into v_user, v_membership_status, v_lock
    from public.entries entry
    join public.game_memberships membership on membership.id = entry.game_membership_id
    join public.tournaments tournament on tournament.id = entry.tournament_id
    where entry.id = p_entry_id
    for update of entry;

  if v_user is null or v_user <> (select auth.uid()) then
    raise exception 'Not your entry'
      using errcode = 'insufficient_privilege';
  end if;

  if v_membership_status <> 'active' then
    raise exception 'Join or rejoin this game before submitting'
      using errcode = 'insufficient_privilege';
  end if;

  if v_lock is null then
    raise exception 'Tournament lock is not configured'
      using errcode = 'check_violation';
  end if;

  if now() >= v_lock then
    raise exception 'Entry submission is closed — the tournament has started'
      using errcode = 'check_violation';
  end if;

  perform predictor_internal.validate_entry_submission_snapshot(p_entry_id, true);

  update public.entries
  set submitted_at = coalesce(submitted_at, now())
  where id = p_entry_id
  returning submitted_at into v_when;

  return v_when;
end;
$$;

create or replace function public.process_due_entry_submissions(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_attempted integer := 0;
  v_submitted integer := 0;
  v_invalid integer := 0;
  v_submitted_at timestamptz;
  v_failure_code text;
  v_failure_message text;
  v_previous_capability text;
begin
  if p_now is null then
    raise exception 'Processing time is required'
      using errcode = '22023';
  end if;

  for v_entry in
    select entry.id, entry.tournament_id, tournament.lock_at
    from public.entries entry
    join public.game_memberships membership
      on membership.id = entry.game_membership_id
     and membership.status = 'active'
    join public.tournaments tournament on tournament.id = entry.tournament_id
    where tournament.lock_at is not null
      and tournament.lock_at <= p_now
      and entry.submitted_at is null
      and not exists (
        select 1 from public.entry_automatic_submission_outcomes outcome
        where outcome.entry_id = entry.id and outcome.lock_at = tournament.lock_at
      )
    order by tournament.lock_at, entry.id
    for update of entry skip locked
  loop
    v_attempted := v_attempted + 1;
    v_previous_capability := coalesce(current_setting('predictor.auto_submission_refresh', true), '');

    begin
      perform set_config('predictor.auto_submission_refresh', 'on', true);
      perform predictor_internal.validate_entry_submission_snapshot(v_entry.id, true);

      update public.entries entry
      set submitted_at = coalesce(entry.submitted_at, p_now)
      where entry.id = v_entry.id
      returning entry.submitted_at into v_submitted_at;

      perform set_config('predictor.auto_submission_refresh', v_previous_capability, true);

      insert into public.entry_automatic_submission_outcomes (
        entry_id, tournament_id, lock_at, outcome, attempted_at, submitted_at
      ) values (
        v_entry.id, v_entry.tournament_id, v_entry.lock_at,
        'submitted', p_now, v_submitted_at
      );
      v_submitted := v_submitted + 1;
    exception when check_violation or foreign_key_violation or data_exception then
      get stacked diagnostics
        v_failure_code = returned_sqlstate,
        v_failure_message = message_text;
      perform set_config('predictor.auto_submission_refresh', v_previous_capability, true);
      insert into public.entry_automatic_submission_outcomes (
        entry_id, tournament_id, lock_at, outcome, attempted_at,
        failure_code, failure_message
      ) values (
        v_entry.id, v_entry.tournament_id, v_entry.lock_at,
        'invalid', p_now, v_failure_code, left(v_failure_message, 500)
      );
      v_invalid := v_invalid + 1;
    end;
  end loop;

  return jsonb_build_object(
    'processedAt', p_now,
    'attempted', v_attempted,
    'submitted', v_submitted,
    'invalid', v_invalid
  );
end;
$$;

-- Add the new contract RPCs to the exact browser/service allowlists.
revoke all on function public.get_competition_games(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.join_competition_game(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.leave_competition_game(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_disqualify_competition_game_entry(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.create_game_league(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_my_game_leagues(uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.register_bonus_competition(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.withdraw_bonus_competition(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.create_league(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.join_league(text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_my_leagues(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.get_competition_games(uuid)
  to authenticated, service_role;
grant execute on function public.join_competition_game(uuid)
  to authenticated, service_role;
grant execute on function public.leave_competition_game(uuid)
  to authenticated, service_role;
grant execute on function public.create_game_league(uuid, text)
  to authenticated, service_role;
grant execute on function public.get_my_game_leagues(uuid)
  to authenticated, service_role;
grant execute on function public.admin_disqualify_competition_game_entry(uuid, uuid, text)
  to service_role;

grant execute on function public.register_bonus_competition(uuid)
  to authenticated, service_role;
grant execute on function public.withdraw_bonus_competition(uuid)
  to authenticated, service_role;
grant execute on function public.create_league(uuid, text)
  to authenticated, service_role;
grant execute on function public.join_league(text)
  to authenticated, service_role;
grant execute on function public.get_my_leagues(uuid)
  to authenticated, service_role;

commit;
