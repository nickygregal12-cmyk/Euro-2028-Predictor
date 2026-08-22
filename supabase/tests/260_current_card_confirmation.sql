-- Contract 214 / UX-008: a confirmation belongs to the current card.
--
-- The regression this suite protects is temporal: confirm a card, edit it while
-- still open, and the old confirmation must disappear. It also proves the
-- inverse because an implementation that clears confirmation on every RPC is
-- only differently wrong: no-op and failed writes must preserve it.

begin;

select plan(15);

create temporary table contract_214_context (
  tournament_id uuid not null,
  round_id uuid not null,
  fixture_id uuid not null
) on commit drop;

do $$
declare
  v_tournament uuid;
  v_round uuid;
  v_home uuid;
  v_away uuid;
  v_fixture uuid;
begin
  insert into public.tournaments
    (competition_id, name, year, season_key, kind, display_timezone, status)
  select source.competition_id,
         'Contract 214 Confirmation Season',
         source.year,
         'contract-214-confirmation',
         source.kind,
         source.display_timezone,
         source.status
    from public.tournaments source
   where source.kind = 'league_season'
   order by source.name
   limit 1
  returning id into v_tournament;

  insert into public.bonus_competitions
    (tournament_id, game_key, availability_status, visibility_kind,
     series_id, series_sequence, published)
  select v_tournament, 'main_predictor', source.availability_status, 'public',
         gen_random_uuid(), 1, source.published
    from public.bonus_competitions source
   where source.game_key = 'main_predictor'
     and source.visibility_kind = 'public'
   order by source.created_at
   limit 1;

  insert into public.competition_rounds
    (tournament_id, round_key, ordinal, kind, label)
  values (v_tournament, 'c214-mw1', 1, 'league_matchweek', 'Contract 214 Matchweek 1')
  returning id into v_round;

  -- The Joker authority is intentionally undefined below two matchweeks.
  -- This second round makes the fixture a valid minimal season while keeping
  -- every Contract-214 assertion focused on matchweek 1.
  insert into public.competition_rounds
    (tournament_id, round_key, ordinal, kind, label)
  values
    (v_tournament, 'c214-mw2', 2, 'league_matchweek', 'Contract 214 Matchweek 2');

  insert into public.teams (tournament_id, name)
  values (v_tournament, 'Contract 214 Home') returning id into v_home;
  insert into public.teams (tournament_id, name)
  values (v_tournament, 'Contract 214 Away') returning id into v_away;

  insert into public.season_fixtures
    (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
  values
    (v_tournament, v_round, v_home, v_away, now() + interval '7 days', 'scheduled')
  returning id into v_fixture;

  insert into contract_214_context values (v_tournament, v_round, v_fixture);
end;
$$;

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  md5('contract-214-player')::uuid,
  'contract-214-player@example.test',
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
);
set local session_replication_role = origin;

insert into public.entries (tournament_id, user_id)
select tournament_id, md5('contract-214-player')::uuid from contract_214_context;

select set_config('request.jwt.claim.sub', md5('contract-214-player')::uuid::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims',
  format('{"sub":"%s","role":"authenticated"}', md5('contract-214-player')::uuid), true);

select is(
  (select public.save_season_prediction(
    tournament_id, fixture_id, 2::smallint, 1::smallint, 0
  )->>'changed' from contract_214_context),
  'true',
  'the first prediction is a material card change');

select is(
  (select card->>'card_status'
     from contract_214_context c,
          lateral public.get_season_matchweek_card(c.tournament_id, 1) card),
  'provisional',
  'a changed card is provisional before confirmation');

create temporary table contract_214_first_confirmation as
select confirmed->>'confirmed_at' as confirmed_at,
       confirmed->>'confirmation_reference' as reference
  from contract_214_context c,
       lateral public.confirm_season_matchweek_card(c.tournament_id, 1) confirmed;

select isnt(
  (select confirmed_at from contract_214_first_confirmation),
  null,
  'confirmation returns the server confirmation instant');

select matches(
  (select reference from contract_214_first_confirmation),
  '^MW1-[A-F0-9]{8}$',
  'confirmation returns a compact server-derived human reference');

select is(
  (select card->>'confirmation_reference'
     from contract_214_context c,
          lateral public.get_season_matchweek_card(c.tournament_id, 1) card),
  (select reference from contract_214_first_confirmation),
  'the card read publishes the same current confirmation reference');

select is(
  (select public.save_season_prediction(
    tournament_id, fixture_id, 2::smallint, 1::smallint, 0
  )->>'changed' from contract_214_context),
  'false',
  'saving the already-stored scoreline is a no-op');

select is(
  (select card->>'card_status'
     from contract_214_context c,
          lateral public.get_season_matchweek_card(c.tournament_id, 1) card),
  'confirmed',
  'a prediction no-op does not invalidate confirmation');

select is(
  (select public.save_season_prediction(
    tournament_id, fixture_id, 3::smallint, 1::smallint, 0
  )->>'changed' from contract_214_context),
  'true',
  'a different scoreline is a material card change');

select is(
  (select jsonb_build_array(
      card->>'card_status',
      card->>'confirmed_at',
      card->>'confirmation_reference'
    )
     from contract_214_context c,
          lateral public.get_season_matchweek_card(c.tournament_id, 1) card),
  '["provisional", null, null]'::jsonb,
  'editing after confirmation clears status, instant and reference together');

create temporary table contract_214_second_confirmation as
select confirmed->>'confirmation_reference' as reference
  from contract_214_context c,
       lateral public.confirm_season_matchweek_card(c.tournament_id, 1) confirmed;

select isnt(
  (select reference from contract_214_second_confirmation),
  (select reference from contract_214_first_confirmation),
  'reconfirming the changed card produces a new reference');

select throws_ok(
  format(
    $$select public.save_season_prediction('%s', '%s', 4::smallint, 1::smallint, 0)$$,
    (select tournament_id from contract_214_context),
    (select fixture_id from contract_214_context)
  ),
  'PT409', null,
  'a stale changed prediction still refuses through optimistic concurrency');

select is(
  (select card->>'confirmation_reference'
     from contract_214_context c,
          lateral public.get_season_matchweek_card(c.tournament_id, 1) card),
  (select reference from contract_214_second_confirmation),
  'a failed prediction write leaves the current confirmation intact');

select is(
  (select public.set_season_matchweek_joker(tournament_id, 1, true)->>'changed'
     from contract_214_context),
  'true',
  'playing the Joker is a material card change');

select is(
  (select card->>'card_status'
     from contract_214_context c,
          lateral public.get_season_matchweek_card(c.tournament_id, 1) card),
  'provisional',
  'a Joker change invalidates confirmation too');

-- Reconfirm with the Joker already present, then repeat the same Joker command.
select public.confirm_season_matchweek_card(tournament_id, 1) from contract_214_context;

select is(
  (select public.set_season_matchweek_joker(tournament_id, 1, true)->>'changed'
     from contract_214_context),
  'false',
  'repeating the already-applied Joker state is a no-op');

select * from finish();

rollback;
