-- Contract 102 — persist the Predictor Championship split as a real phase.
--
-- ADR 0025 decided the shape before any store was widened:
--
--   * `stage = 'split'`, never a group stage under another label;
--   * groups identify `initial` or `split` phase and a split group points to
--     the one initial group it came from;
--   * one entrant may hold an initial membership and a later split membership,
--     while the original row remains permanent;
--   * split fixtures carry a group and the competition-wide matchday number;
--   * points carry forward by DERIVING standings across both sets of fixtures,
--     never by storing a copied starting total.
--
-- This contract is the persistence slice only. It makes every required state
-- representable and keeps the existing tournament Cup behaviour exact. It does
-- NOT create split groups, generate split fixtures or calculate the combined
-- table; those are drivers/read authorities that can now be built without
-- inventing a second storage shape.

begin;

-- ---------------------------------------------------------------------------
-- Groups: phase identity and parentage.
-- ---------------------------------------------------------------------------

alter table public.bonus_cup_groups
  add column phase_kind text not null default 'initial',
  add column parent_group_id uuid;

alter table public.bonus_cup_groups
  add constraint bonus_cup_groups_phase_kind_allowed
    check (phase_kind in ('initial', 'split')),
  add constraint bonus_cup_groups_parent_shape
    check (
      (phase_kind = 'initial' and parent_group_id is null)
      or (phase_kind = 'split' and parent_group_id is not null)
    ),
  add constraint bonus_cup_groups_parent_not_self
    check (parent_group_id is null or parent_group_id <> id),
  add constraint bonus_cup_groups_parent_fkey
    foreign key (parent_group_id)
    references public.bonus_cup_groups(id)
    on delete restrict,
  -- Supports the phase-matching composite FK from memberships below. `id`
  -- remains the table's global primary key; this is an integrity key, not a
  -- second identity.
  add constraint bonus_cup_groups_competition_id_id_phase_kind_key
    unique (competition_id, id, phase_kind);

comment on column public.bonus_cup_groups.phase_kind is
  'Cup phase represented by this group: initial league phase or later split phase.';
comment on column public.bonus_cup_groups.parent_group_id is
  'For a split group, the initial-phase group whose table was divided. Null for initial groups.';

create or replace function predictor_internal.assert_bonus_cup_group_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_competition uuid;
  v_parent_phase text;
begin
  -- A parent that already has split children cannot later be moved to another
  -- competition or relabelled as a split group; either change would invalidate
  -- every child without touching the child rows and therefore evade a child
  -- trigger.
  if tg_op = 'UPDATE'
    and (new.competition_id is distinct from old.competition_id
      or new.phase_kind is distinct from old.phase_kind)
    and exists (
      select 1
      from public.bonus_cup_groups child
      where child.parent_group_id = old.id
    ) then
    raise exception 'A Cup group with split children cannot change competition or phase'
      using errcode = '23514';
  end if;

  if new.phase_kind = 'split' then
    select parent.competition_id, parent.phase_kind
      into v_parent_competition, v_parent_phase
      from public.bonus_cup_groups parent
      where parent.id = new.parent_group_id;

    if not found then
      raise exception 'A split Cup group requires an existing parent group'
        using errcode = '23503';
    end if;
    if v_parent_competition is distinct from new.competition_id then
      raise exception 'A split Cup group and its parent must belong to the same competition'
        using errcode = '23514';
    end if;
    if v_parent_phase <> 'initial' then
      raise exception 'A split Cup group must point directly to an initial-phase group'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.assert_bonus_cup_group_parent()
  from public, anon, authenticated, service_role;

create trigger assert_bonus_cup_group_parent
before insert or update of competition_id, phase_kind, parent_group_id
on public.bonus_cup_groups
for each row execute function predictor_internal.assert_bonus_cup_group_parent();

-- ---------------------------------------------------------------------------
-- Membership: preserve the initial row and add one row per later phase.
-- ---------------------------------------------------------------------------

alter table public.bonus_cup_members
  add column phase_kind text not null default 'initial';

-- `group_position between 1 and 4` was another tournament-format limit on the
-- shared store. A season group can contain twenty entrants, so the platform
-- domain follows the same cap contract 79 put on `bonus_cup_groups.size`.
alter table public.bonus_cup_members
  drop constraint if exists bonus_cup_members_group_position_check;

alter table public.bonus_cup_members
  add constraint bonus_cup_members_group_position_allowed
    check (group_position is null or group_position between 1 and 20),
  add constraint bonus_cup_members_phase_kind_allowed
    check (phase_kind in ('initial', 'split')),
  -- Qualification and knockout seeding describe the initial group gate. Split
  -- membership is a grouping fact only and must not become a second opinion on
  -- those stored tournament decisions.
  add constraint bonus_cup_members_split_metadata_empty
    check (
      phase_kind = 'initial'
      or (group_position is null and qualified_as is null and seed is null)
    );

alter table public.bonus_cup_members
  drop constraint bonus_cup_members_group_id_fkey,
  drop constraint bonus_cup_members_pkey,
  drop constraint bonus_cup_members_competition_id_draw_number_key;

alter table public.bonus_cup_members
  add constraint bonus_cup_members_pkey
    primary key (competition_id, user_id, phase_kind),
  add constraint bonus_cup_members_draw_number_phase_key
    unique (competition_id, phase_kind, draw_number),
  add constraint bonus_cup_members_group_phase_fkey
    foreign key (competition_id, group_id, phase_kind)
    references public.bonus_cup_groups (competition_id, id, phase_kind)
    on delete cascade;

-- Make the existing tournament qualification key explicit about which phase
-- owns it. The split metadata constraint above keeps split seeds null, but the
-- predicate documents the authority at the index itself.
drop index public.bonus_cup_members_seed_once;
create unique index bonus_cup_members_seed_once
  on public.bonus_cup_members (competition_id, seed)
  where phase_kind = 'initial' and seed is not null;

comment on column public.bonus_cup_members.phase_kind is
  'Phase-specific Cup membership. Initial membership is permanent; a later split membership is an additional row.';

-- ---------------------------------------------------------------------------
-- Fixtures: `split` is group-shaped, not knockout-shaped.
-- ---------------------------------------------------------------------------

alter table public.bonus_cup_fixtures
  drop constraint bonus_cup_fixtures_stage_check,
  drop constraint bonus_cup_fixtures_group_shape,
  drop constraint bonus_cup_fixtures_stage_bracket_shape,
  drop constraint bonus_cup_fixtures_group_never_settles;

alter table public.bonus_cup_fixtures
  add constraint bonus_cup_fixtures_stage_allowed
    check (stage in ('group', 'split', 'playoff', 'knockout')),
  add constraint bonus_cup_fixtures_group_shape
    check (
      (stage in ('group', 'split') and group_id is not null and matchday is not null)
      or (stage in ('playoff', 'knockout') and group_id is null and matchday is null)
    ),
  add constraint bonus_cup_fixtures_stage_bracket_shape
    check (
      (stage in ('group', 'split') and round_size is null and bracket_slot is null)
      or (stage = 'playoff' and round_size is null and bracket_slot is not null)
      or (stage = 'knockout' and round_size is not null and bracket_slot is not null)
    ),
  add constraint bonus_cup_fixtures_group_never_settles
    check (
      stage not in ('group', 'split')
      or (winner_user_id is null and decided_by is null and settled_at is null)
    );

-- One Cup fixture per user per competition matchday in either league-like
-- phase. The original indexes only covered `group`, which would allow a user to
-- be scheduled twice in one split round.
drop index public.bonus_cup_fixtures_home_once;
drop index public.bonus_cup_fixtures_away_once;

create unique index bonus_cup_fixtures_home_once
  on public.bonus_cup_fixtures (competition_id, matchday, home_user_id)
  where stage in ('group', 'split');
create unique index bonus_cup_fixtures_away_once
  on public.bonus_cup_fixtures (competition_id, matchday, away_user_id)
  where stage in ('group', 'split');

create or replace function predictor_internal.assert_bonus_cup_fixture_group_phase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_competition uuid;
  v_group_phase text;
begin
  if new.stage in ('group', 'split') then
    select grp.competition_id, grp.phase_kind
      into v_group_competition, v_group_phase
      from public.bonus_cup_groups grp
      where grp.id = new.group_id;

    if not found then
      raise exception 'A group-shaped Cup fixture requires an existing group'
        using errcode = '23503';
    end if;
    if v_group_competition is distinct from new.competition_id then
      raise exception 'A Cup fixture and its group must belong to the same competition'
        using errcode = '23514';
    end if;
    if new.stage = 'group' and v_group_phase <> 'initial' then
      raise exception 'A group-stage Cup fixture must reference an initial-phase group'
        using errcode = '23514';
    end if;
    if new.stage = 'split' and v_group_phase <> 'split' then
      raise exception 'A split-stage Cup fixture must reference a split-phase group'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.assert_bonus_cup_fixture_group_phase()
  from public, anon, authenticated, service_role;

create trigger assert_bonus_cup_fixture_group_phase
before insert or update of competition_id, stage, group_id
on public.bonus_cup_fixtures
for each row execute function predictor_internal.assert_bonus_cup_fixture_group_phase();

-- ---------------------------------------------------------------------------
-- Existing authorities must keep using the permanent INITIAL roster.
--
-- A second membership row is intentionally visible to future split-table reads,
-- but it must not double every member's prediction points, make `get_my_cup`
-- select an arbitrary group, or let a split fixture enter the knockout settler
-- merely because old code used `stage <> 'group'` as shorthand for knockout.
-- ---------------------------------------------------------------------------

do $patch$
declare
  v_definition text;
  v_original text;
begin
  -- Both points sources cross-join the member roster against real fixtures.
  -- Initial membership is the canonical once-per-entrant roster; split rows are
  -- phase placement and must not duplicate those scores.
  select pg_get_functiondef(
    'predictor_internal.cup_tournament_fixture_points(uuid,uuid)'::regprocedure
  ) into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '    where member.competition_id = p_competition_id',
    '    where member.competition_id = p_competition_id' || chr(10) ||
    '      and member.phase_kind = ''initial'''
  );
  if v_definition = v_original then
    raise exception 'Expected tournament Cup member-roster predicate was not found';
  end if;
  execute v_definition;

  select pg_get_functiondef(
    'predictor_internal.cup_season_fixture_points(uuid,uuid)'::regprocedure
  ) into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '    where member.competition_id = p_competition_id',
    '    where member.competition_id = p_competition_id' || chr(10) ||
    '      and member.phase_kind = ''initial'''
  );
  if v_definition = v_original then
    raise exception 'Expected season Cup member-roster predicate was not found';
  end if;
  execute v_definition;

  -- Tournament qualification remains an initial-phase operation. A future
  -- split table derives across initial and split fixtures through a separate
  -- phase-aware read rather than overloading this gate.
  select pg_get_functiondef(
    'predictor_internal.cup_final_group_tables(uuid)'::regprocedure
  ) into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '    where member.competition_id = p_competition_id',
    '    where member.competition_id = p_competition_id' || chr(10) ||
    '      and member.phase_kind = ''initial'''
  );
  if v_definition = v_original then
    raise exception 'Expected final-group-table membership predicate was not found';
  end if;
  execute v_definition;

  select pg_get_functiondef(
    'predictor_internal.cup_seed_group(uuid,integer)'::regprocedure
  ) into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '  where member.competition_id = p_competition_id and member.seed = p_seed',
    '  where member.competition_id = p_competition_id' || chr(10) ||
    '    and member.phase_kind = ''initial''' || chr(10) ||
    '    and member.seed = p_seed'
  );
  if v_definition = v_original then
    raise exception 'Expected Cup seed-group predicate was not found';
  end if;
  execute v_definition;

  -- The latest Cup read has two once-per-user member lookups: current group and
  -- qualification metadata. Both keep their pre-contract meaning by selecting
  -- the initial row explicitly.
  select pg_get_functiondef('public.get_my_cup(uuid)'::regprocedure)
    into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    '      and member.user_id = v_uid;',
    '      and member.user_id = v_uid' || chr(10) ||
    '      and member.phase_kind = ''initial'';'
  );
  if v_definition = v_original then
    raise exception 'Expected get_my_cup member predicates were not found';
  end if;
  execute v_definition;

  -- Qualification must not see split membership as a second entrant, and a
  -- stored split fixture is not evidence that knockout qualification already
  -- ran. Keep every existing tournament branch explicit.
  select pg_get_functiondef(
    'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure
  ) into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    'fixture.stage <> ''group''',
    'fixture.stage in (''playoff'', ''knockout'')'
  );
  v_definition := replace(
    v_definition,
    'where member.competition_id = p_competition_id',
    'where member.competition_id = p_competition_id' || chr(10) ||
    '      and member.phase_kind = ''initial'''
  );
  v_definition := replace(
    v_definition,
    'and member.competition_id = p_competition_id',
    'and member.competition_id = p_competition_id' || chr(10) ||
    '      and member.phase_kind = ''initial'''
  );
  v_definition := replace(
    v_definition,
    'on qualifier.competition_id = p_competition_id',
    'on qualifier.competition_id = p_competition_id' || chr(10) ||
    '        and qualifier.phase_kind = ''initial'''
  );
  v_definition := replace(
    v_definition,
    'where home_member.competition_id = p_competition_id',
    'where home_member.competition_id = p_competition_id' || chr(10) ||
    '        and home_member.phase_kind = ''initial'''
  );
  v_definition := replace(
    v_definition,
    'and away_member.competition_id = p_competition_id',
    'and away_member.competition_id = p_competition_id' || chr(10) ||
    '        and away_member.phase_kind = ''initial'''
  );
  if v_definition = v_original
    or position('stage <> ''group''' in v_definition) > 0 then
    raise exception 'Predictor Cup group finalisation was not made split-safe';
  end if;
  execute v_definition;

  -- Only playoff and knockout fixtures use Penalty Numbers and the stored
  -- winner/settlement path. `split` is deliberately excluded.
  select pg_get_functiondef(
    'public.admin_settle_predictor_cup_round(uuid,uuid)'::regprocedure
  ) into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    'fixture.stage <> ''group''',
    'fixture.stage in (''playoff'', ''knockout'')'
  );
  v_definition := replace(
    v_definition,
    'where member.competition_id = p_competition_id',
    'where member.competition_id = p_competition_id' || chr(10) ||
    '      and member.phase_kind = ''initial'''
  );
  if v_definition = v_original
    or position('stage <> ''group''' in v_definition) > 0 then
    raise exception 'Predictor Cup round settlement was not made split-safe';
  end if;
  execute v_definition;

  select pg_get_functiondef(
    'public.submit_cup_penalty_number(uuid,uuid,smallint,integer)'::regprocedure
  ) into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    'fixture.stage <> ''group''',
    'fixture.stage in (''playoff'', ''knockout'')'
  );
  if v_definition = v_original
    or position('stage <> ''group''' in v_definition) > 0 then
    raise exception 'Penalty Number submission was not made split-safe';
  end if;
  execute v_definition;
end;
$patch$;

-- ---------------------------------------------------------------------------
-- Assert the end state. A silent wrong-name DROP would otherwise let the
-- migration report success while retaining the shape ADR 0025 rejected.
-- ---------------------------------------------------------------------------

do $verify$
begin
  if not exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.bonus_cup_groups'::regclass
      and a.attname = 'phase_kind' and not a.attisdropped
  ) or not exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.bonus_cup_groups'::regclass
      and a.attname = 'parent_group_id' and not a.attisdropped
  ) then
    raise exception 'Cup group phase persistence is incomplete';
  end if;

  if pg_get_constraintdef((
    select oid from pg_catalog.pg_constraint
    where conrelid = 'public.bonus_cup_members'::regclass
      and conname = 'bonus_cup_members_pkey'
  )) not like '%competition_id, user_id, phase_kind%' then
    raise exception 'Cup membership primary key is not phase-aware';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.bonus_cup_fixtures'::regclass
      and conname = 'bonus_cup_fixtures_stage_allowed'
      and pg_get_constraintdef(oid) like '%split%'
  ) then
    raise exception 'The distinct split fixture stage is missing';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid in (
      'public.bonus_cup_groups'::regclass,
      'public.bonus_cup_members'::regclass,
      'public.bonus_cup_fixtures'::regclass
    )
      and not a.attisdropped
      and a.attname in ('carried_points', 'starting_points', 'points_carried')
  ) then
    raise exception 'Split points must be derived from fixtures, never copied into storage';
  end if;

  if exists (
    select 1
    from public.bonus_cup_groups grp
    where grp.phase_kind <> 'initial'
  ) or exists (
    select 1
    from public.bonus_cup_members member
    where member.phase_kind <> 'initial'
  ) then
    raise exception 'Existing Cup rows were not preserved as initial-phase history';
  end if;
end;
$verify$;

commit;
