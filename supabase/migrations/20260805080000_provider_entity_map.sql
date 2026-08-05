-- Contract 112: the provider identity map.
--
-- ---------------------------------------------------------------------------
-- WHERE THE CHAIN STOPS TODAY
-- ---------------------------------------------------------------------------
--
-- Contract 96 built custody: a provider response is archived verbatim, strictly
-- decoded, and its normalized payload stored as append-only evidence. Measured
-- rather than assumed, the chain then ENDS. Nothing in the repository relates a
-- provider's competition, season, round or team identifier to `tournaments`,
-- `competition_rounds` or `teams`, and nothing writes `season_fixtures` at all.
--
-- So a decoded fixture is a row of numbers belonging to nobody. It names team
-- `1234` playing team `5678` in round `40`, and there is no fact anywhere that
-- says which of our clubs those are. Every later step — placing a fixture,
-- revising a kickoff, moving a postponed match — is blocked on the same missing
-- fact, which is why the map comes first and alone.
--
-- The Stage C1 foundation already anticipated this, deferring "the ingestion and
-- administrative reassignment workflow" in as many words. ADR 0020 decides what
-- that workflow does when it arrives: fixture changes import automatically and
-- notify an administrator for review, results enter the feed without
-- confirmation, and official scoring and progression stay governed by the
-- existing fail-closed result rules.
--
-- ---------------------------------------------------------------------------
-- WHY THIS CONTRACT IS THE MAP AND NOTHING ELSE
-- ---------------------------------------------------------------------------
--
-- The obvious move is to build the map and the import together. Building the
-- map first found the reason not to.
--
-- `src/domain/season/fixtureReassignment.ts` is the authority for a fixture
-- whose kickoff moves, and it resolves the destination by ROUND WINDOW — it
-- takes `windowStartsAt` and `windowEndsAt` per round and refuses when no round
-- contains the new kickoff, or when more than one does. `competition_rounds`
-- has no window columns. There is no window authority in this repository, and
-- inventing one inside an ingestion migration would be deciding a lock-adjacent
-- rule as a side effect of plumbing.
--
-- That is a real decision needing its own contract and its own evidence. The
-- map does not need it, cannot be wrong about it, and is required either way.
--
-- ---------------------------------------------------------------------------
-- REFERENTIAL INTEGRITY OVER A POLYMORPHIC COLUMN
-- ---------------------------------------------------------------------------
--
-- The convenient shape is (entity_kind, entity_id) with no foreign key, because
-- one column cannot reference three tables. That shape cannot be trusted: a
-- mapping surviving the deletion of the thing it maps is a mapping that will
-- one day resolve a fixture onto a club that no longer exists.
--
-- Instead each kind gets its own nullable column with its own real foreign key,
-- and a CHECK insists that a row carries exactly the column its kind needs and
-- no other. The keys are COMPOSITE — `(tournament_id, team_id)` rather than
-- `team_id` — so the database itself refuses to map a provider identifier onto
-- a club belonging to a different competition season. That mistake is otherwise
-- entirely silent, and it is the one this table exists to make impossible.

begin;

create table public.provider_entity_map (
  id uuid primary key default gen_random_uuid(),

  provider text not null,
  entity_kind text not null,

  -- Text, not a number. Two of the three providers already return non-numeric
  -- identifiers in at least one field, and the decoder normalises every one of
  -- them to a string precisely so this column never has to guess.
  provider_id text not null,

  -- Always present, for every kind. A provider's team identifier is global and
  -- ours is not: the same club is a different `teams` row in every competition
  -- season, so a mapping without a season is not a fact.
  tournament_id uuid not null,

  competition_round_id uuid,
  team_id uuid,

  -- What evidences this mapping — a payload reference, an admin note, a
  -- migration name. Required, because a mapping nobody can account for is one
  -- nobody can safely correct.
  evidence_ref text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint provider_entity_map_provider_allowed
    check (provider in ('sportmonks', 'api-football', 'football-data')),

  -- `season` maps a provider's season to one of our competition seasons; the
  -- other two map within it. There is deliberately no `competition` kind: a
  -- provider's league identifier without a season does not identify anything we
  -- store, because every one of our rows is season-scoped.
  constraint provider_entity_map_kind_allowed
    check (entity_kind in ('season', 'round', 'team')),

  constraint provider_entity_map_provider_id_length
    check (char_length(btrim(provider_id)) between 1 and 128),

  constraint provider_entity_map_evidence_length
    check (char_length(btrim(evidence_ref)) between 1 and 200),

  -- Exactly the column its kind needs, and no other. Without this a `team` row
  -- could carry a round and resolve as both.
  constraint provider_entity_map_shape
    check (
      (entity_kind = 'season'
        and competition_round_id is null and team_id is null)
      or (entity_kind = 'round'
        and competition_round_id is not null and team_id is null)
      or (entity_kind = 'team'
        and team_id is not null and competition_round_id is null)
    ),

  constraint provider_entity_map_tournament_fkey
    foreign key (tournament_id)
    references public.tournaments(id)
    on delete cascade,

  -- Composite on purpose. `references competition_rounds(id)` would happily
  -- accept a round from a different season.
  constraint provider_entity_map_round_fkey
    foreign key (tournament_id, competition_round_id)
    references public.competition_rounds(tournament_id, id)
    on delete cascade,

  constraint provider_entity_map_team_fkey
    foreign key (tournament_id, team_id)
    references public.teams(tournament_id, id)
    on delete cascade
);

-- One provider identifier means one of our rows, within one season. Without
-- this a feed could map team 1234 onto two clubs and every fixture between them
-- would be plausible and wrong.
create unique index provider_entity_map_identifier_key
  on public.provider_entity_map (provider, entity_kind, provider_id, tournament_id);

-- And the other direction, per kind: one of our rows is named by at most one
-- identifier per provider. A club with two provider identifiers would take
-- alternating halves of its own fixture list.
create unique index provider_entity_map_round_target_key
  on public.provider_entity_map (provider, competition_round_id)
  where competition_round_id is not null;

create unique index provider_entity_map_team_target_key
  on public.provider_entity_map (provider, team_id)
  where team_id is not null;

create unique index provider_entity_map_season_target_key
  on public.provider_entity_map (provider, tournament_id)
  where entity_kind = 'season';

create index provider_entity_map_tournament_idx
  on public.provider_entity_map (tournament_id, entity_kind);

comment on table public.provider_entity_map is
  'Contract 112. Relates a provider''s season, round and team identifiers to '
  'this platform''s rows, always within one competition season. Server-only: '
  'browser roles receive no access.';

-- Provider identity is operational data, never a browser read. RLS on with no
-- policy is the whole story: nothing but a definer function reaches it.
alter table public.provider_entity_map enable row level security;

revoke all on table public.provider_entity_map from anon, authenticated, service_role;

create or replace function predictor_internal.touch_provider_entity_map()
returns trigger
language plpgsql
security definer
set search_path = ''
as $touch$
begin
  new.updated_at := now();
  return new;
end;
$touch$;

revoke all on function predictor_internal.touch_provider_entity_map()
  from public, anon, authenticated, service_role;

create trigger touch_provider_entity_map
before update on public.provider_entity_map
for each row
execute function predictor_internal.touch_provider_entity_map();

-- ---------------------------------------------------------------------------
-- Resolution
--
-- Three readers rather than one polymorphic one. A caller resolving a team
-- should not be able to typo its way into a round, and each returns null rather
-- than raising: an unmapped identifier is an ordinary state during rehearsal,
-- and the ingestion driver's job is to refuse the fixture and say which
-- identifier it could not place. Raising here would make every gap an incident.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.resolve_provider_season(
  p_provider text,
  p_provider_id text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $resolve$
  select entry.tournament_id
    from public.provider_entity_map entry
   where entry.provider = p_provider
     and entry.entity_kind = 'season'
     and entry.provider_id = p_provider_id;
$resolve$;

create or replace function predictor_internal.resolve_provider_round(
  p_provider text,
  p_tournament_id uuid,
  p_provider_id text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $resolve$
  select entry.competition_round_id
    from public.provider_entity_map entry
   where entry.provider = p_provider
     and entry.entity_kind = 'round'
     and entry.tournament_id = p_tournament_id
     and entry.provider_id = p_provider_id;
$resolve$;

create or replace function predictor_internal.resolve_provider_team(
  p_provider text,
  p_tournament_id uuid,
  p_provider_id text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $resolve$
  select entry.team_id
    from public.provider_entity_map entry
   where entry.provider = p_provider
     and entry.entity_kind = 'team'
     and entry.tournament_id = p_tournament_id
     and entry.provider_id = p_provider_id;
$resolve$;

revoke all on function predictor_internal.resolve_provider_season(text, text)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.resolve_provider_round(text, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.resolve_provider_team(text, uuid, text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The gap report
--
-- The question an operator actually has is not "is this mapped" but "what is
-- still missing before this payload can be imported". Answering it one
-- identifier at a time is how a rehearsal turns into an afternoon of guessing.
--
-- It takes a decoder payload — the exact `normalized_payload` shape contract 96
-- already stores — and names every round and team identifier in it that has no
-- mapping, with the count of fixtures each one blocks so the biggest gap is
-- obvious. It writes nothing.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.provider_mapping_gaps(
  p_provider text,
  p_tournament_id uuid,
  p_payload jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $gaps$
  with fixture as (
    select entry from jsonb_array_elements(coalesce(p_payload, '[]'::jsonb)) as entry
  ), referenced as (
    select 'round' as kind, fixture.entry->>'roundProviderId' as provider_id
      from fixture
     where fixture.entry->>'roundProviderId' is not null
    union all
    select 'team', fixture.entry->>'homeTeamProviderId' from fixture
    union all
    select 'team', fixture.entry->>'awayTeamProviderId' from fixture
  ), counted as (
    select referenced.kind, referenced.provider_id, count(*)::integer as fixtures
      from referenced
     group by referenced.kind, referenced.provider_id
  ), missing as (
    select counted.*
      from counted
     where not exists (
       select 1 from public.provider_entity_map entry
        where entry.provider = p_provider
          and entry.tournament_id = p_tournament_id
          and entry.entity_kind = counted.kind
          and entry.provider_id = counted.provider_id
     )
  )
  select jsonb_build_object(
    'provider', p_provider,
    'tournamentId', p_tournament_id,
    'fixtures', (select count(*)::integer from fixture),
    'unmappedRounds', coalesce((
      select jsonb_agg(jsonb_build_object('providerId', provider_id, 'fixtures', fixtures)
                       order by fixtures desc, provider_id)
        from missing where kind = 'round'), '[]'::jsonb),
    'unmappedTeams', coalesce((
      select jsonb_agg(jsonb_build_object('providerId', provider_id, 'fixtures', fixtures)
                       order by fixtures desc, provider_id)
        from missing where kind = 'team'), '[]'::jsonb),
    'ready', not exists (select 1 from missing)
  );
$gaps$;

revoke all on function predictor_internal.provider_mapping_gaps(text, uuid, jsonb)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Prove the container is empty and correctly shaped, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  if (select count(*) from public.provider_entity_map) <> 0 then
    raise exception 'provider_entity_map must start empty; this migration maps nothing';
  end if;

  if not (
    select relrowsecurity from pg_class
     where oid = 'public.provider_entity_map'::regclass
  ) then
    raise exception 'provider_entity_map must have row level security enabled';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public'
       and table_name = 'provider_entity_map'
       and grantee in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'provider_entity_map must not be reachable by a browser or service role';
  end if;
end;
$$;

commit;
