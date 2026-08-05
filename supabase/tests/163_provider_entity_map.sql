-- Contract 112: the provider identity map.
--
-- A decoded provider fixture names team 1234 playing team 5678 in round 40, and
-- until this table exists there is no fact anywhere saying which of our clubs
-- those are. Every later ingestion step is blocked on the same missing fact.
--
-- The assertions below are mostly about the mistakes that do not announce
-- themselves. A mapping pointing at a club in the wrong competition season, or
-- one provider identifier claiming two clubs, produces fixtures that are
-- entirely plausible and entirely wrong — nobody sees an error, they see a
-- league table that is subtly untrue.

begin;

select plan(20);

select set_config('test.pem_pl',
  (select t.id::text from public.tournaments t where t.name = 'Premier League 2026/27'), true);

select set_config('test.pem_sp',
  (select t.id::text from public.tournaments t where t.name = 'Scottish Premiership 2026/27'), true);

-- Every row this suite needs, it creates. An earlier draft closed the gap
-- report against clubs and rounds from the development league seed, which
-- passed against a seeded database and failed against a clean one — the shape
-- CI actually builds. A test that depends on seed data is testing the seed.
insert into public.teams (tournament_id, name) values
  (current_setting('test.pem_pl')::uuid, 'Mapping Rovers'),
  (current_setting('test.pem_pl')::uuid, 'Mapping United'),
  (current_setting('test.pem_pl')::uuid, 'Mapping Athletic'),
  (current_setting('test.pem_sp')::uuid, 'Mapping Thistle');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label) values
  (current_setting('test.pem_pl')::uuid, 'pem-mw1', 901, 'league_matchweek', 'Mapping Matchweek 1'),
  (current_setting('test.pem_pl')::uuid, 'pem-mw2', 902, 'league_matchweek', 'Mapping Matchweek 2'),
  (current_setting('test.pem_sp')::uuid, 'pem-sp-mw1', 901, 'league_matchweek', 'Mapping Matchweek 1');

select set_config('test.pem_rovers',
  (select id::text from public.teams
    where tournament_id = current_setting('test.pem_pl')::uuid and name = 'Mapping Rovers'), true);
select set_config('test.pem_united',
  (select id::text from public.teams
    where tournament_id = current_setting('test.pem_pl')::uuid and name = 'Mapping United'), true);
select set_config('test.pem_thistle',
  (select id::text from public.teams
    where tournament_id = current_setting('test.pem_sp')::uuid and name = 'Mapping Thistle'), true);
select set_config('test.pem_round',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.pem_pl')::uuid and round_key = 'pem-mw1'), true);

-- ---------------------------------------------------------------------------
-- Reachability
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'provider_entity_map'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'no browser or service role may read the identity map'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.provider_entity_map'::regclass),
  true,
  'and row level security is enabled on it'
);

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_schema = 'predictor_internal'
      and routine_name in ('resolve_provider_season', 'resolve_provider_round',
                           'resolve_provider_team', 'provider_mapping_gaps')
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'nor call any of the resolvers'
);

select is(
  (select count(*)::integer from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
   where ns.nspname = 'predictor_internal'
     and proc.proname in ('resolve_provider_season', 'resolve_provider_round',
                          'resolve_provider_team', 'provider_mapping_gaps')
     and proc.prosecdef
     and proc.proconfig @> array['search_path=""']),
  4,
  'every resolver is security definer with a pinned search path'
);

-- ---------------------------------------------------------------------------
-- The mistakes that do not announce themselves
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$insert into public.provider_entity_map
            (provider, entity_kind, provider_id, tournament_id, team_id, evidence_ref)
          values ('football-data', 'team', '57', %L::uuid, %L::uuid, 'cross-season')$$,
         current_setting('test.pem_sp'), current_setting('test.pem_rovers')),
  '23503',
  null,
  'a club cannot be mapped under a competition season it does not belong to — the composite key refuses it, and nothing else would have'
);

select throws_ok(
  format($$insert into public.provider_entity_map
            (provider, entity_kind, provider_id, tournament_id, team_id, competition_round_id, evidence_ref)
          values ('football-data', 'team', '57', %L::uuid, %L::uuid, %L::uuid, 'both at once')$$,
         current_setting('test.pem_pl'), current_setting('test.pem_rovers'),
         current_setting('test.pem_round')),
  '23514',
  null,
  'a team mapping may not also carry a round, which would let one row resolve as two things'
);

select throws_ok(
  format($$insert into public.provider_entity_map
            (provider, entity_kind, provider_id, tournament_id, evidence_ref)
          values ('football-data', 'round', '40', %L::uuid, 'round without a round')$$,
         current_setting('test.pem_pl')),
  '23514',
  null,
  'and a round mapping that names no round is refused rather than stored as a mapping to nothing'
);

select throws_ok(
  format($$insert into public.provider_entity_map
            (provider, entity_kind, provider_id, tournament_id, team_id, evidence_ref)
          values ('acme-football', 'team', '57', %L::uuid, %L::uuid, 'unknown provider')$$,
         current_setting('test.pem_pl'), current_setting('test.pem_rovers')),
  '23514',
  null,
  'an unrecognised provider is refused — the decoders support exactly three'
);

-- ---------------------------------------------------------------------------
-- Mapping, and the two directions of uniqueness
-- ---------------------------------------------------------------------------

insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, team_id, evidence_ref) values
  ('football-data', 'team', '57', current_setting('test.pem_pl')::uuid,
   current_setting('test.pem_rovers')::uuid, 'contract 112 test'),
  ('football-data', 'team', '61', current_setting('test.pem_pl')::uuid,
   current_setting('test.pem_united')::uuid, 'contract 112 test');

insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, competition_round_id, evidence_ref) values
  ('football-data', 'round', '3', current_setting('test.pem_pl')::uuid,
   current_setting('test.pem_round')::uuid, 'contract 112 test');

insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, evidence_ref) values
  ('football-data', 'season', '2026', current_setting('test.pem_pl')::uuid, 'contract 112 test');

select throws_ok(
  format($$insert into public.provider_entity_map
            (provider, entity_kind, provider_id, tournament_id, team_id, evidence_ref)
          values ('football-data', 'team', '57', %L::uuid, %L::uuid, 'same identifier twice')$$,
         current_setting('test.pem_pl'), current_setting('test.pem_united')),
  '23505',
  null,
  'one provider identifier cannot name two clubs — every fixture between them would look right'
);

select throws_ok(
  format($$insert into public.provider_entity_map
            (provider, entity_kind, provider_id, tournament_id, team_id, evidence_ref)
          values ('football-data', 'team', '999', %L::uuid, %L::uuid, 'two identifiers, one club')$$,
         current_setting('test.pem_pl'), current_setting('test.pem_rovers')),
  '23505',
  null,
  'and one club cannot answer to two identifiers, which would split its fixture list in half'
);

-- The same provider identifier in a DIFFERENT season is not a conflict: our
-- clubs are season-scoped and a provider's are not, so the same club in next
-- season is a different row here and must be mappable.
select lives_ok(
  format($$insert into public.provider_entity_map
            (provider, entity_kind, provider_id, tournament_id, team_id, evidence_ref)
          values ('football-data', 'team', '57', %L::uuid, %L::uuid, 'same club, other season')$$,
         current_setting('test.pem_sp'), current_setting('test.pem_thistle')),
  'the same provider identifier may map in another competition season, because our clubs are season-scoped and theirs are not'
);

-- ---------------------------------------------------------------------------
-- Resolution
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_provider_team(
    'football-data', current_setting('test.pem_pl')::uuid, '57'),
  current_setting('test.pem_rovers')::uuid,
  'a mapped team resolves to the club in the season that was asked about'
);

select is(
  predictor_internal.resolve_provider_team(
    'football-data', current_setting('test.pem_sp')::uuid, '57'),
  current_setting('test.pem_thistle')::uuid,
  'and the same identifier in the other season resolves to that season''s club'
);

select is(
  predictor_internal.resolve_provider_round(
    'football-data', current_setting('test.pem_pl')::uuid, '3'),
  current_setting('test.pem_round')::uuid,
  'a mapped round resolves within its season'
);

select is(
  predictor_internal.resolve_provider_season('football-data', '2026'),
  current_setting('test.pem_pl')::uuid,
  'and a mapped season resolves to the competition season'
);

select is(
  predictor_internal.resolve_provider_team(
    'football-data', current_setting('test.pem_pl')::uuid, '404'),
  null,
  'an unmapped identifier returns null rather than raising — a gap during rehearsal is an ordinary state, not an incident'
);

select is(
  predictor_internal.resolve_provider_team(
    'sportmonks', current_setting('test.pem_pl')::uuid, '57'),
  null,
  'and identifiers never leak between providers, whose numbering has nothing to do with each other'
);

-- ---------------------------------------------------------------------------
-- The gap report
-- ---------------------------------------------------------------------------

select set_config('test.pem_payload', jsonb_build_array(
  jsonb_build_object('roundProviderId', '3', 'homeTeamProviderId', '57', 'awayTeamProviderId', '61'),
  jsonb_build_object('roundProviderId', '4', 'homeTeamProviderId', '57', 'awayTeamProviderId', '99'),
  jsonb_build_object('roundProviderId', '4', 'homeTeamProviderId', '99', 'awayTeamProviderId', '61')
)::text, true);

select is(
  predictor_internal.provider_mapping_gaps(
    'football-data', current_setting('test.pem_pl')::uuid,
    current_setting('test.pem_payload')::jsonb)
    - 'provider' - 'tournamentId',
  jsonb_build_object(
    'fixtures', 3,
    'unmappedRounds', jsonb_build_array(jsonb_build_object('providerId', '4', 'fixtures', 2)),
    'unmappedTeams', jsonb_build_array(jsonb_build_object('providerId', '99', 'fixtures', 2)),
    'ready', false),
  'the gap report names every unmapped identifier with the number of fixtures it blocks, so the biggest gap is the obvious one to close first'
);

insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, competition_round_id, evidence_ref)
select 'football-data', 'round', '4', current_setting('test.pem_pl')::uuid, round.id, 'closing the gap'
  from public.competition_rounds round
 where round.tournament_id = current_setting('test.pem_pl')::uuid
   and round.round_key = 'pem-mw2';

insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, team_id, evidence_ref)
select 'football-data', 'team', '99', current_setting('test.pem_pl')::uuid, team.id, 'closing the gap'
  from public.teams team
 where team.tournament_id = current_setting('test.pem_pl')::uuid
   and team.name = 'Mapping Athletic';

select is(
  predictor_internal.provider_mapping_gaps(
    'football-data', current_setting('test.pem_pl')::uuid,
    current_setting('test.pem_payload')::jsonb) ->> 'ready',
  'true',
  'and reports ready once nothing in the payload is unmapped'
);

-- ---------------------------------------------------------------------------
-- A mapping never outlives what it maps
-- ---------------------------------------------------------------------------

delete from public.teams where id = current_setting('test.pem_thistle')::uuid;

select is(
  (select count(*)::integer from public.provider_entity_map
    where team_id = current_setting('test.pem_thistle')::uuid),
  0,
  'deleting a club takes its mapping with it — a mapping outliving its club would one day resolve a fixture onto nothing'
);

select finish();

rollback;
