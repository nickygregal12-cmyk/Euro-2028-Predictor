-- Contract 132: provider discovery may propose an initial domestic league calendar,
-- but publication remains an explicit competition-admin decision and provider
-- scores remain evidence rather than official result truth.

create table predictor_internal.provider_fixture_proposals (
  id uuid primary key default gen_random_uuid(),
  raw_response_id uuid not null references predictor_internal.provider_raw_responses(id) on delete restrict,
  provider text not null,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  provider_fixture_id text not null,
  competition_provider_id text,
  season_provider_id text,
  round_provider_id text not null,
  home_team_provider_id text not null,
  home_team_name text not null,
  away_team_provider_id text not null,
  away_team_name text not null,
  proposed_kickoff_at timestamptz not null,
  provider_status text not null,
  provider_home_score integer,
  provider_away_score integer,
  state text not null default 'pending',
  staged_at timestamptz not null default clock_timestamp(),
  decided_at timestamptz,
  decided_by uuid,
  decision_reason text,
  created_fixture_id uuid references public.season_fixtures(id) on delete restrict,
  constraint provider_fixture_proposals_provider_allowed
    check (provider in ('sportmonks', 'api-football', 'football-data')),
  constraint provider_fixture_proposals_provider_fixture_id_length
    check (char_length(btrim(provider_fixture_id)) between 1 and 128),
  constraint provider_fixture_proposals_competition_provider_id_length
    check (competition_provider_id is null or char_length(btrim(competition_provider_id)) between 1 and 128),
  constraint provider_fixture_proposals_season_provider_id_length
    check (season_provider_id is null or char_length(btrim(season_provider_id)) between 1 and 128),
  constraint provider_fixture_proposals_round_provider_id_length
    check (char_length(btrim(round_provider_id)) between 1 and 128),
  constraint provider_fixture_proposals_home_team_provider_id_length
    check (char_length(btrim(home_team_provider_id)) between 1 and 128),
  constraint provider_fixture_proposals_away_team_provider_id_length
    check (char_length(btrim(away_team_provider_id)) between 1 and 128),
  constraint provider_fixture_proposals_team_name_length
    check (
      char_length(btrim(home_team_name)) between 1 and 160
      and char_length(btrim(away_team_name)) between 1 and 160
    ),
  constraint provider_fixture_proposals_distinct_teams
    check (home_team_provider_id <> away_team_provider_id),
  constraint provider_fixture_proposals_status_length
    check (char_length(btrim(provider_status)) between 1 and 80),
  constraint provider_fixture_proposals_scores_non_negative
    check (
      (provider_home_score is null or provider_home_score >= 0)
      and (provider_away_score is null or provider_away_score >= 0)
    ),
  constraint provider_fixture_proposals_state_allowed
    check (state in ('pending', 'approved', 'rejected')),
  constraint provider_fixture_proposals_decision_shape
    check (
      (
        state = 'pending'
        and decided_at is null
        and decided_by is null
        and decision_reason is null
        and created_fixture_id is null
      )
      or
      (
        state = 'approved'
        and decided_at is not null
        and decided_by is not null
        and char_length(btrim(decision_reason)) between 1 and 500
        and created_fixture_id is not null
      )
      or
      (
        state = 'rejected'
        and decided_at is not null
        and decided_by is not null
        and char_length(btrim(decision_reason)) between 1 and 500
        and created_fixture_id is null
      )
    ),
  constraint provider_fixture_proposals_raw_fixture_unique
    unique (raw_response_id, provider_fixture_id)
);

create index provider_fixture_proposals_pending_lookup
  on predictor_internal.provider_fixture_proposals
    (tournament_id, provider, state, provider_fixture_id);

alter table predictor_internal.provider_fixture_proposals enable row level security;

revoke all on table predictor_internal.provider_fixture_proposals
  from public, anon, authenticated, service_role;

create or replace function predictor_internal.block_provider_fixture_proposal_rewrite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Provider fixture proposal evidence is append-only'
      using errcode = '42501';
  end if;

  if old.state <> 'pending' then
    raise exception 'A decided provider fixture proposal is immutable'
      using errcode = '42501';
  end if;

  if new.raw_response_id is distinct from old.raw_response_id
     or new.provider is distinct from old.provider
     or new.tournament_id is distinct from old.tournament_id
     or new.provider_fixture_id is distinct from old.provider_fixture_id
     or new.competition_provider_id is distinct from old.competition_provider_id
     or new.season_provider_id is distinct from old.season_provider_id
     or new.round_provider_id is distinct from old.round_provider_id
     or new.home_team_provider_id is distinct from old.home_team_provider_id
     or new.home_team_name is distinct from old.home_team_name
     or new.away_team_provider_id is distinct from old.away_team_provider_id
     or new.away_team_name is distinct from old.away_team_name
     or new.proposed_kickoff_at is distinct from old.proposed_kickoff_at
     or new.provider_status is distinct from old.provider_status
     or new.provider_home_score is distinct from old.provider_home_score
     or new.provider_away_score is distinct from old.provider_away_score
     or new.staged_at is distinct from old.staged_at
  then
    raise exception 'Provider fixture proposal evidence is immutable'
      using errcode = '42501';
  end if;

  if new.state not in ('approved', 'rejected') then
    raise exception 'A pending provider fixture proposal may only be decided'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.block_provider_fixture_proposal_rewrite()
  from public, anon, authenticated, service_role;

create trigger provider_fixture_proposals_immutable
before update or delete on predictor_internal.provider_fixture_proposals
for each row execute function predictor_internal.block_provider_fixture_proposal_rewrite();

create or replace function predictor_internal.stage_provider_fixture_proposals(
  p_raw_response_id uuid,
  p_tournament_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text;
  v_response_status integer;
  v_decoder_version text;
  v_succeeded boolean;
  v_decoded_fixture_count integer;
  v_payload jsonb;
  v_kind text;
  v_item jsonb;
  v_kickoff timestamptz;
  v_home_score integer;
  v_away_score integer;
  v_inserted integer := 0;
  v_existing integer := 0;
begin
  if p_raw_response_id is null or p_tournament_id is null then
    raise exception 'raw response and tournament are required'
      using errcode = '22023';
  end if;

  select t.kind
    into v_kind
    from public.tournaments t
   where t.id = p_tournament_id;

  if not found then
    raise exception 'Tournament does not exist'
      using errcode = '23503';
  end if;

  if v_kind <> 'league_season' then
    raise exception 'Initial provider fixture proposals are only supported for league seasons'
      using errcode = '23514';
  end if;

  select raw.provider,
         raw.response_status,
         processing.decoder_version,
         processing.succeeded,
         processing.decoded_fixture_count,
         processing.normalized_payload
    into v_provider,
         v_response_status,
         v_decoder_version,
         v_succeeded,
         v_decoded_fixture_count,
         v_payload
    from predictor_internal.provider_raw_responses raw
    left join lateral (
      select p.decoder_version,
             p.succeeded,
             p.decoded_fixture_count,
             p.normalized_payload
        from predictor_internal.provider_response_processing p
       where p.raw_response_id = raw.id
       order by p.processed_at desc, p.id desc
       limit 1
    ) processing on true
   where raw.id = p_raw_response_id;

  if not found then
    raise exception 'Provider raw response does not exist'
      using errcode = '23503';
  end if;

  if v_response_status < 200 or v_response_status >= 300 then
    raise exception 'Only successful provider responses may be staged'
      using errcode = '23514';
  end if;

  if v_decoder_version is null then
    raise exception 'Provider response has no processing record'
      using errcode = '23514';
  end if;

  if v_succeeded is distinct from true then
    raise exception 'Only successfully decoded provider responses may be staged'
      using errcode = '23514';
  end if;

  if v_decoder_version <> 'contract-132-v1' then
    raise exception 'Provider response must be decoded by contract-132-v1 before staging'
      using errcode = '23514';
  end if;

  if jsonb_typeof(v_payload) <> 'array' then
    raise exception 'Normalized provider payload must be an array'
      using errcode = '23514';
  end if;

  if v_decoded_fixture_count is null
     or v_decoded_fixture_count <> jsonb_array_length(v_payload)
     or v_decoded_fixture_count <= 0
  then
    raise exception 'Normalized provider fixture count is invalid'
      using errcode = '23514';
  end if;

  for v_item in
    select value from jsonb_array_elements(v_payload)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each normalized fixture must be an object'
        using errcode = '23514';
    end if;

    if v_item ->> 'provider' is distinct from v_provider then
      raise exception 'Normalized fixture provider does not match archived provider'
        using errcode = '23514';
    end if;

    if nullif(btrim(v_item ->> 'providerFixtureId'), '') is null
       or nullif(btrim(v_item ->> 'roundProviderId'), '') is null
       or nullif(btrim(v_item ->> 'homeTeamProviderId'), '') is null
       or nullif(btrim(v_item ->> 'awayTeamProviderId'), '') is null
       or nullif(btrim(v_item ->> 'homeTeamName'), '') is null
       or nullif(btrim(v_item ->> 'awayTeamName'), '') is null
       or nullif(btrim(v_item ->> 'kickoffAt'), '') is null
       or nullif(btrim(v_item ->> 'status'), '') is null
    then
      raise exception 'Normalized fixture is missing initial-adoption identity fields'
        using errcode = '23514';
    end if;

    if btrim(v_item ->> 'homeTeamProviderId') = btrim(v_item ->> 'awayTeamProviderId') then
      raise exception 'Normalized fixture home and away teams must differ'
        using errcode = '23514';
    end if;

    begin
      v_kickoff := (v_item ->> 'kickoffAt')::timestamptz;
    exception when others then
      raise exception 'Normalized fixture kickoff is not a valid timestamp'
        using errcode = '22007';
    end;

    v_home_score := null;
    if v_item ? 'homeScore' and jsonb_typeof(v_item -> 'homeScore') <> 'null' then
      if jsonb_typeof(v_item -> 'homeScore') <> 'number' then
        raise exception 'Normalized home score must be a non-negative integer or null'
          using errcode = '23514';
      end if;
      begin
        v_home_score := (v_item ->> 'homeScore')::integer;
      exception when others then
        raise exception 'Normalized home score must be a non-negative integer or null'
          using errcode = '23514';
      end;
      if v_home_score < 0 then
        raise exception 'Normalized home score must be a non-negative integer or null'
          using errcode = '23514';
      end if;
    end if;

    v_away_score := null;
    if v_item ? 'awayScore' and jsonb_typeof(v_item -> 'awayScore') <> 'null' then
      if jsonb_typeof(v_item -> 'awayScore') <> 'number' then
        raise exception 'Normalized away score must be a non-negative integer or null'
          using errcode = '23514';
      end if;
      begin
        v_away_score := (v_item ->> 'awayScore')::integer;
      exception when others then
        raise exception 'Normalized away score must be a non-negative integer or null'
          using errcode = '23514';
      end;
      if v_away_score < 0 then
        raise exception 'Normalized away score must be a non-negative integer or null'
          using errcode = '23514';
      end if;
    end if;

    insert into predictor_internal.provider_fixture_proposals (
      raw_response_id,
      provider,
      tournament_id,
      provider_fixture_id,
      competition_provider_id,
      season_provider_id,
      round_provider_id,
      home_team_provider_id,
      home_team_name,
      away_team_provider_id,
      away_team_name,
      proposed_kickoff_at,
      provider_status,
      provider_home_score,
      provider_away_score
    ) values (
      p_raw_response_id,
      v_provider,
      p_tournament_id,
      btrim(v_item ->> 'providerFixtureId'),
      nullif(btrim(v_item ->> 'competitionProviderId'), ''),
      nullif(btrim(v_item ->> 'seasonProviderId'), ''),
      btrim(v_item ->> 'roundProviderId'),
      btrim(v_item ->> 'homeTeamProviderId'),
      btrim(v_item ->> 'homeTeamName'),
      btrim(v_item ->> 'awayTeamProviderId'),
      btrim(v_item ->> 'awayTeamName'),
      v_kickoff,
      btrim(v_item ->> 'status'),
      v_home_score,
      v_away_score
    )
    on conflict (raw_response_id, provider_fixture_id) do nothing;

    if found then
      v_inserted := v_inserted + 1;
    else
      v_existing := v_existing + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'provider', v_provider,
    'rawResponseId', p_raw_response_id,
    'tournamentId', p_tournament_id,
    'inserted', v_inserted,
    'existing', v_existing
  );
end;
$$;

revoke all on function predictor_internal.stage_provider_fixture_proposals(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.admin_approve_initial_provider_fixtures(
  p_tournament_id uuid,
  p_provider text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_competition_slug text;
  v_kind text;
  v_expected_rounds integer;
  v_expected_teams integer;
  v_expected_fixtures integer;
  v_matches_per_round integer;
  v_round_prefix text;
  v_fixture_count integer;
  v_proposal_count integer;
  v_round_count integer;
  v_team_count integer;
  v_season_provider_count integer;
  v_season_provider_id text;
  v_competition_provider_count integer;
  v_now timestamptz := clock_timestamp();
  v_evidence_ref text;
  v_team record;
  v_round record;
  v_fixture record;
  v_team_id uuid;
  v_round_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_existing_name text;
  v_existing_count integer;
  v_fixture_id uuid;
  v_created integer := 0;
begin
  perform predictor_internal.require_competition_admin();

  if v_actor is null then
    raise exception 'An authenticated administrator is required'
      using errcode = '42501';
  end if;

  if p_tournament_id is null
     or p_provider is null
     or p_provider not in ('sportmonks', 'api-football', 'football-data')
  then
    raise exception 'A supported provider and tournament are required'
      using errcode = '22023';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Approval reason must contain between 1 and 500 characters'
      using errcode = '22023';
  end if;

  select c.slug, t.kind
    into v_competition_slug, v_kind
    from public.tournaments t
    join public.competitions c on c.id = t.competition_id
   where t.id = p_tournament_id
   for update of t;

  if not found then
    raise exception 'Tournament does not exist'
      using errcode = '23503';
  end if;

  if v_kind <> 'league_season' then
    raise exception 'Initial provider fixture approval is only supported for league seasons'
      using errcode = '23514';
  end if;

  if v_competition_slug = 'scottish-premiership' then
    v_expected_rounds := 33;
    v_expected_teams := 12;
    v_expected_fixtures := 198;
    v_matches_per_round := 6;
    v_round_prefix := 'sp';
  elsif v_competition_slug = 'premier-league' then
    v_expected_rounds := 38;
    v_expected_teams := 20;
    v_expected_fixtures := 380;
    v_matches_per_round := 10;
    v_round_prefix := 'pl';
  else
    raise exception 'Initial provider fixture approval is not configured for competition %', v_competition_slug
      using errcode = '23514';
  end if;

  if exists (
    select 1 from public.season_fixtures f where f.tournament_id = p_tournament_id
  ) then
    raise exception 'Initial provider fixture approval requires an empty season fixture set'
      using errcode = '23514';
  end if;

  select count(*)::integer,
         count(distinct provider_fixture_id)::integer,
         count(distinct round_provider_id)::integer
    into v_proposal_count, v_fixture_count, v_round_count
    from predictor_internal.provider_fixture_proposals p
   where p.tournament_id = p_tournament_id
     and p.provider = p_provider
     and p.state = 'pending';

  if v_fixture_count = 0 then
    raise exception 'No pending provider fixture proposals exist for this season'
      using errcode = '23514';
  end if;

  if v_fixture_count <> v_expected_fixtures then
    raise exception 'Expected % distinct fixtures for %, found %',
      v_expected_fixtures, v_competition_slug, v_fixture_count
      using errcode = '23514';
  end if;

  if v_round_count <> v_expected_rounds then
    raise exception 'Expected % matchweeks for %, found %',
      v_expected_rounds, v_competition_slug, v_round_count
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from predictor_internal.provider_fixture_proposals p
     where p.tournament_id = p_tournament_id
       and p.provider = p_provider
       and p.state = 'pending'
       and (
         p.round_provider_id !~ '^[1-9][0-9]*$'
         or p.round_provider_id::integer > v_expected_rounds
       )
  ) then
    raise exception 'Pending provider proposals contain an unsupported matchweek identifier'
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from predictor_internal.provider_fixture_proposals p
     where p.tournament_id = p_tournament_id
       and p.provider = p_provider
       and p.state = 'pending'
       and p.season_provider_id is null
  ) then
    raise exception 'Every pending provider proposal must identify its provider season'
      using errcode = '23514';
  end if;

  select count(distinct p.season_provider_id)::integer,
         min(p.season_provider_id)
    into v_season_provider_count, v_season_provider_id
    from predictor_internal.provider_fixture_proposals p
   where p.tournament_id = p_tournament_id
     and p.provider = p_provider
     and p.state = 'pending';

  if v_season_provider_count <> 1 then
    raise exception 'Pending proposals must describe exactly one provider season'
      using errcode = '23514';
  end if;

  select count(distinct p.competition_provider_id)::integer
    into v_competition_provider_count
    from predictor_internal.provider_fixture_proposals p
   where p.tournament_id = p_tournament_id
     and p.provider = p_provider
     and p.state = 'pending'
     and p.competition_provider_id is not null;

  if v_competition_provider_count > 1 then
    raise exception 'Pending proposals span more than one provider competition'
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from (
        select p.provider_fixture_id
          from predictor_internal.provider_fixture_proposals p
         where p.tournament_id = p_tournament_id
           and p.provider = p_provider
           and p.state = 'pending'
         group by p.provider_fixture_id
        having count(distinct jsonb_build_array(
          p.competition_provider_id,
          p.season_provider_id,
          p.round_provider_id,
          p.home_team_provider_id,
          p.home_team_name,
          p.away_team_provider_id,
          p.away_team_name,
          p.proposed_kickoff_at,
          p.provider_status,
          p.provider_home_score,
          p.provider_away_score
        )) > 1
      ) conflicts
  ) then
    raise exception 'Conflicting pending evidence exists for a provider fixture'
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from (
        select identity.provider_team_id
          from (
            select p.home_team_provider_id as provider_team_id, p.home_team_name as team_name
              from predictor_internal.provider_fixture_proposals p
             where p.tournament_id = p_tournament_id
               and p.provider = p_provider
               and p.state = 'pending'
            union all
            select p.away_team_provider_id, p.away_team_name
              from predictor_internal.provider_fixture_proposals p
             where p.tournament_id = p_tournament_id
               and p.provider = p_provider
               and p.state = 'pending'
          ) identity
         group by identity.provider_team_id
        having count(distinct btrim(identity.team_name)) > 1
      ) unstable
  ) then
    raise exception 'A provider team identifier has more than one club name in pending evidence'
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from (
        select lower(btrim(identity.team_name)) as normalized_name
          from (
            select p.home_team_provider_id as provider_team_id, p.home_team_name as team_name
              from predictor_internal.provider_fixture_proposals p
             where p.tournament_id = p_tournament_id
               and p.provider = p_provider
               and p.state = 'pending'
            union all
            select p.away_team_provider_id, p.away_team_name
              from predictor_internal.provider_fixture_proposals p
             where p.tournament_id = p_tournament_id
               and p.provider = p_provider
               and p.state = 'pending'
          ) identity
         group by lower(btrim(identity.team_name))
        having count(distinct identity.provider_team_id) > 1
      ) ambiguous
  ) then
    raise exception 'A club name maps to more than one provider team identifier'
      using errcode = '23514';
  end if;

  select count(distinct identity.provider_team_id)::integer
    into v_team_count
    from (
      select p.home_team_provider_id as provider_team_id
        from predictor_internal.provider_fixture_proposals p
       where p.tournament_id = p_tournament_id
         and p.provider = p_provider
         and p.state = 'pending'
      union all
      select p.away_team_provider_id
        from predictor_internal.provider_fixture_proposals p
       where p.tournament_id = p_tournament_id
         and p.provider = p_provider
         and p.state = 'pending'
    ) identity;

  if v_team_count <> v_expected_teams then
    raise exception 'Expected % clubs for %, found %',
      v_expected_teams, v_competition_slug, v_team_count
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from predictor_internal.provider_fixture_proposals p
     where p.tournament_id = p_tournament_id
       and p.provider = p_provider
       and p.state = 'pending'
     group by p.round_provider_id
    having count(distinct p.provider_fixture_id) <> v_matches_per_round
  ) then
    raise exception 'At least one matchweek does not contain the expected number of fixtures'
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from (
        select appearances.round_provider_id,
               appearances.provider_team_id
          from (
            select p.round_provider_id,
                   p.provider_fixture_id,
                   p.home_team_provider_id as provider_team_id
              from predictor_internal.provider_fixture_proposals p
             where p.tournament_id = p_tournament_id
               and p.provider = p_provider
               and p.state = 'pending'
            union all
            select p.round_provider_id,
                   p.provider_fixture_id,
                   p.away_team_provider_id
              from predictor_internal.provider_fixture_proposals p
             where p.tournament_id = p_tournament_id
               and p.provider = p_provider
               and p.state = 'pending'
          ) appearances
         group by appearances.round_provider_id, appearances.provider_team_id
        having count(distinct appearances.provider_fixture_id) <> 1
      ) duplicate_appearance
  ) then
    raise exception 'A club appears more than once in a pending matchweek'
      using errcode = '23514';
  end if;

  v_evidence_ref := 'contract132 initial fixture approval; proposal evidence retained internally';

  if not exists (
    select 1
      from public.provider_entity_map m
     where m.provider = p_provider
       and m.entity_kind = 'season'
       and m.provider_id = v_season_provider_id
       and m.tournament_id = p_tournament_id
  ) then
    insert into public.provider_entity_map (
      provider, entity_kind, provider_id, tournament_id, evidence_ref
    ) values (
      p_provider, 'season', v_season_provider_id, p_tournament_id, v_evidence_ref
    );
  end if;

  for v_team in
    select identity.provider_team_id,
           min(btrim(identity.team_name)) as team_name
      from (
        select p.home_team_provider_id as provider_team_id, p.home_team_name as team_name
          from predictor_internal.provider_fixture_proposals p
         where p.tournament_id = p_tournament_id
           and p.provider = p_provider
           and p.state = 'pending'
        union all
        select p.away_team_provider_id, p.away_team_name
          from predictor_internal.provider_fixture_proposals p
         where p.tournament_id = p_tournament_id
           and p.provider = p_provider
           and p.state = 'pending'
      ) identity
     group by identity.provider_team_id
     order by min(lower(btrim(identity.team_name))), identity.provider_team_id
  loop
    v_team_id := null;
    select m.team_id
      into v_team_id
      from public.provider_entity_map m
     where m.provider = p_provider
       and m.entity_kind = 'team'
       and m.provider_id = v_team.provider_team_id
       and m.tournament_id = p_tournament_id;

    if v_team_id is not null then
      select t.name
        into v_existing_name
        from public.teams t
       where t.id = v_team_id
         and t.tournament_id = p_tournament_id;

      if not found or lower(btrim(v_existing_name)) <> lower(btrim(v_team.team_name)) then
        raise exception 'Existing provider team mapping conflicts with pending club identity'
          using errcode = '23514';
      end if;
    else
      select count(*)::integer, min(t.id)
        into v_existing_count, v_team_id
        from public.teams t
       where t.tournament_id = p_tournament_id
         and lower(btrim(t.name)) = lower(btrim(v_team.team_name));

      if v_existing_count > 1 then
        raise exception 'Canonical season contains ambiguous case-insensitive club names'
          using errcode = '23514';
      elsif v_existing_count = 0 then
        insert into public.teams (tournament_id, name)
        values (p_tournament_id, v_team.team_name)
        returning id into v_team_id;
      end if;

      insert into public.provider_entity_map (
        provider, entity_kind, provider_id, tournament_id, team_id, evidence_ref
      ) values (
        p_provider, 'team', v_team.provider_team_id, p_tournament_id, v_team_id, v_evidence_ref
      );
    end if;
  end loop;

  for v_round in
    select distinct p.round_provider_id,
           p.round_provider_id::integer as ordinal
      from predictor_internal.provider_fixture_proposals p
     where p.tournament_id = p_tournament_id
       and p.provider = p_provider
       and p.state = 'pending'
     order by ordinal
  loop
    v_round_id := null;
    select m.competition_round_id
      into v_round_id
      from public.provider_entity_map m
     where m.provider = p_provider
       and m.entity_kind = 'round'
       and m.provider_id = v_round.round_provider_id
       and m.tournament_id = p_tournament_id;

    if v_round_id is not null then
      if not exists (
        select 1
          from public.competition_rounds r
         where r.id = v_round_id
           and r.tournament_id = p_tournament_id
           and r.round_key = v_round_prefix || '-mw' || v_round.ordinal::text
           and r.ordinal = v_round.ordinal
           and r.kind = 'league_matchweek'
           and r.label = 'Matchweek ' || v_round.ordinal::text
      ) then
        raise exception 'Existing provider round mapping conflicts with canonical matchweek shape'
          using errcode = '23514';
      end if;
    else
      select r.id
        into v_round_id
        from public.competition_rounds r
       where r.tournament_id = p_tournament_id
         and r.round_key = v_round_prefix || '-mw' || v_round.ordinal::text;

      if v_round_id is not null then
        if not exists (
          select 1
            from public.competition_rounds r
           where r.id = v_round_id
             and r.ordinal = v_round.ordinal
             and r.kind = 'league_matchweek'
             and r.label = 'Matchweek ' || v_round.ordinal::text
        ) then
          raise exception 'Existing canonical round key has incompatible matchweek metadata'
            using errcode = '23514';
        end if;
      else
        insert into public.competition_rounds (
          tournament_id, round_key, ordinal, kind, label
        ) values (
          p_tournament_id,
          v_round_prefix || '-mw' || v_round.ordinal::text,
          v_round.ordinal,
          'league_matchweek',
          'Matchweek ' || v_round.ordinal::text
        ) returning id into v_round_id;
      end if;

      insert into public.provider_entity_map (
        provider, entity_kind, provider_id, tournament_id, competition_round_id, evidence_ref
      ) values (
        p_provider, 'round', v_round.round_provider_id, p_tournament_id, v_round_id, v_evidence_ref
      );
    end if;
  end loop;

  for v_fixture in
    select canonical.*
      from (
        select distinct on (p.provider_fixture_id)
               p.provider_fixture_id,
               p.round_provider_id,
               p.home_team_provider_id,
               p.away_team_provider_id,
               p.proposed_kickoff_at
          from predictor_internal.provider_fixture_proposals p
         where p.tournament_id = p_tournament_id
           and p.provider = p_provider
           and p.state = 'pending'
         order by p.provider_fixture_id, p.staged_at desc, p.id desc
      ) canonical
     order by canonical.proposed_kickoff_at, canonical.provider_fixture_id
  loop
    select m.team_id
      into v_home_team_id
      from public.provider_entity_map m
     where m.provider = p_provider
       and m.entity_kind = 'team'
       and m.provider_id = v_fixture.home_team_provider_id
       and m.tournament_id = p_tournament_id;

    select m.team_id
      into v_away_team_id
      from public.provider_entity_map m
     where m.provider = p_provider
       and m.entity_kind = 'team'
       and m.provider_id = v_fixture.away_team_provider_id
       and m.tournament_id = p_tournament_id;

    select m.competition_round_id
      into v_round_id
      from public.provider_entity_map m
     where m.provider = p_provider
       and m.entity_kind = 'round'
       and m.provider_id = v_fixture.round_provider_id
       and m.tournament_id = p_tournament_id;

    if v_home_team_id is null or v_away_team_id is null or v_round_id is null then
      raise exception 'Approved fixture identity could not be resolved through provider mappings'
        using errcode = '23514';
    end if;

    insert into public.season_fixtures (
      tournament_id,
      competition_round_id,
      home_team_id,
      away_team_id,
      kickoff_at,
      status,
      home_score,
      away_score
    ) values (
      p_tournament_id,
      v_round_id,
      v_home_team_id,
      v_away_team_id,
      v_fixture.proposed_kickoff_at,
      'scheduled',
      null,
      null
    ) returning id into v_fixture_id;

    update predictor_internal.provider_fixture_proposals p
       set state = 'approved',
           decided_at = v_now,
           decided_by = v_actor,
           decision_reason = btrim(p_reason),
           created_fixture_id = v_fixture_id
     where p.tournament_id = p_tournament_id
       and p.provider = p_provider
       and p.state = 'pending'
       and p.provider_fixture_id = v_fixture.provider_fixture_id;

    v_created := v_created + 1;
  end loop;

  if v_created <> v_expected_fixtures then
    raise exception 'Initial provider approval created an unexpected number of fixtures'
      using errcode = '23514';
  end if;

  return jsonb_build_object(
    'outcome', 'approved',
    'provider', p_provider,
    'tournamentId', p_tournament_id,
    'proposalEvidenceRows', v_proposal_count,
    'fixturesCreated', v_created,
    'teams', v_expected_teams,
    'rounds', v_expected_rounds,
    'officialResultsWritten', 0
  );
end;
$$;

revoke all on function public.admin_approve_initial_provider_fixtures(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_approve_initial_provider_fixtures(uuid, text, text)
  to authenticated;

create or replace function public.admin_reject_initial_provider_fixtures(
  p_tournament_id uuid,
  p_provider text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_rejected integer;
begin
  perform predictor_internal.require_competition_admin();

  if v_actor is null then
    raise exception 'An authenticated administrator is required'
      using errcode = '42501';
  end if;

  if p_tournament_id is null
     or p_provider is null
     or p_provider not in ('sportmonks', 'api-football', 'football-data')
  then
    raise exception 'A supported provider and tournament are required'
      using errcode = '22023';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Rejection reason must contain between 1 and 500 characters'
      using errcode = '22023';
  end if;

  update predictor_internal.provider_fixture_proposals p
     set state = 'rejected',
         decided_at = clock_timestamp(),
         decided_by = v_actor,
         decision_reason = btrim(p_reason),
         created_fixture_id = null
   where p.tournament_id = p_tournament_id
     and p.provider = p_provider
     and p.state = 'pending';

  get diagnostics v_rejected = row_count;

  if v_rejected = 0 then
    raise exception 'No pending provider fixture proposals exist for this season'
      using errcode = '23514';
  end if;

  return jsonb_build_object(
    'outcome', 'rejected',
    'provider', p_provider,
    'tournamentId', p_tournament_id,
    'proposalsRejected', v_rejected
  );
end;
$$;

revoke all on function public.admin_reject_initial_provider_fixtures(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_reject_initial_provider_fixtures(uuid, text, text)
  to authenticated;
