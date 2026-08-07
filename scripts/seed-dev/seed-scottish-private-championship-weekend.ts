#!/usr/bin/env -S node --experimental-strip-types
/**
 * Deterministic hosted-Development rehearsal seed for the Scottish Premiership
 * private Predictor Championship.
 *
 * This file PRINTS SQL ONLY. It opens no connection. The generated SQL is for
 * the Development rehearsal and is deliberately pinned to the existing test
 * identities, with Nicky Gregal as the primary player.
 *
 * The public Championship is not touched. The current public threshold opens
 * into the multi-group format, whose launch driver is deliberately not built
 * yet; the working single-group season path is the private 4-20 entrant path.
 */

export const SCOTTISH_TOURNAMENT_ID = '6a64a59b-b721-443e-a864-0fd52db1edbd'
export const MAIN_PREDICTOR_ID = '865d558a-2f9c-4512-bc41-5542a2b3e98a'
export const PRIVATE_CHAMPIONSHIP_ID = 'd3fa0007-2026-4808-8000-000000000001'
export const NICKY_USER_ID = '698e8c98-0f39-42a3-bd56-6f7cb98f446d'

export const WEEKEND_ENTRANTS = [
  { userId: NICKY_USER_ID, displayName: 'Nicky Gregal' },
  { userId: 'e1466b71-fd9e-4fea-889e-f53e490d4a39', displayName: 'Dev Tester' },
  { userId: '7c1c37e1-5d3b-4f86-a254-09f3b0171221', displayName: 'Al' },
  { userId: '02d04495-fe14-4e06-90a5-edf519377663', displayName: 'Bo' },
  { userId: '8a300844-06af-4ffe-b4e2-6e07e4936112', displayName: 'Cristiano' },
  { userId: 'a72c1540-53cc-4b7e-b11a-ee82d06273f8', displayName: 'Priya Shah' },
  { userId: 'cd0e2446-4a7b-437f-858e-fb58d8329994', displayName: 'Alex Turner' },
  { userId: '9e53a253-c3d7-48cc-90db-8647ea5cc82c', displayName: 'Jordan Blake' },
] as const

function entrantValues(): string {
  return WEEKEND_ENTRANTS.map(
    (entrant, index) =>
      `      ('${entrant.userId}'::uuid, ${index + 1}, '${entrant.displayName.replace(/'/g, "''")}')`,
  ).join(',\n')
}

function entrantUuidArray(): string {
  return `array[${WEEKEND_ENTRANTS.map((entrant) => `'${entrant.userId}'::uuid`).join(', ')}]`
}

export function seedSql(): string {
  const entrants = entrantValues()
  const entrantIds = entrantUuidArray()

  return `begin;

do $seed$
declare
  v_tournament uuid := '${SCOTTISH_TOURNAMENT_ID}';
  v_main_predictor uuid := '${MAIN_PREDICTOR_ID}';
  v_private_cup uuid := '${PRIVATE_CHAMPIONSHIP_ID}';
  v_mw2 uuid;
  v_lock_at timestamptz;
  v_user record;
  v_fixture record;
  v_prediction_count integer;
  v_card_status text;
  v_fixture_no integer;
  v_home smallint;
  v_away smallint;
  v_launch jsonb;
begin
  -- Development identity guard. A database without this exact named rehearsal
  -- cohort is not the database this seed was written for.
  for v_user in
    select * from (values
${entrants}
    ) as chosen(user_id, seed_order, expected_name)
  loop
    if not exists (
      select 1
      from auth.users u
      join public.profiles p on p.id = u.id
      where u.id = v_user.user_id
        and p.display_name = v_user.expected_name
    ) then
      raise exception 'Required Development rehearsal identity % (%) is missing',
        v_user.expected_name, v_user.user_id;
    end if;
  end loop;

  if not exists (
    select 1 from public.tournaments
    where id = v_tournament
      and name = 'Scottish Premiership 2026/27'
      and kind = 'league_season'
  ) then
    raise exception 'The pinned Scottish Development season is not present';
  end if;

  -- Once launched, replay is verification only. Never redraw a live private
  -- Championship underneath real weekend cards.
  if exists (select 1 from public.bonus_cup_groups where competition_id = v_private_cup) then
    if (select count(*) from public.bonus_competition_entrants where competition_id = v_private_cup) <> 8
       or exists (
         select 1
         from public.bonus_competition_entrants entrant
         where entrant.competition_id = v_private_cup
           and not (entrant.user_id = any(${entrantIds}))
       )
       or exists (
         select expected.user_id
         from unnest(${entrantIds}) as expected(user_id)
         where not exists (
           select 1 from public.bonus_competition_entrants entrant
           where entrant.competition_id = v_private_cup
             and entrant.user_id = expected.user_id
         )
       )
    then
      raise exception 'The deterministic private Championship is launched with a different field';
    end if;
    raise notice 'Scottish private Championship rehearsal is already launched; left untouched';
    return;
  end if;

  select id into strict v_mw2
  from public.competition_rounds
  where tournament_id = v_tournament
    and kind = 'league_matchweek'
    and ordinal = 2;

  if (select count(*) from public.season_fixtures where competition_round_id = v_mw2) <> 6 then
    raise exception 'Scottish Matchweek 2 must contain exactly six real fixtures';
  end if;

  v_lock_at := predictor_internal.season_matchweek_lock_at(v_tournament, v_mw2, 0);
  if v_lock_at is null or now() >= v_lock_at then
    raise exception 'Scottish Matchweek 2 is already locked; refusing to fabricate a rehearsal card';
  end if;

  insert into public.bonus_competitions (
    id, tournament_id, game_key, published, availability_status,
    registration_opens_at, registration_closes_at, draw_required, visibility_kind
  ) values (
    v_private_cup, v_tournament, 'predictor_cup', false, 'active',
    now() - interval '1 hour', now() + interval '2 hours', true, 'private'
  )
  on conflict (id) do nothing;

  if not exists (
    select 1 from public.bonus_competitions
    where id = v_private_cup
      and tournament_id = v_tournament
      and game_key = 'predictor_cup'
      and visibility_kind = 'private'
      and completed_at is null
  ) then
    raise exception 'Deterministic private Championship id is occupied by an incompatible row';
  end if;

  for v_user in
    select * from (values
${entrants}
    ) as chosen(user_id, seed_order, expected_name)
  loop
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_user.user_id, 'role', 'authenticated')::text,
      true
    );

    if not exists (
      select 1 from public.game_memberships
      where game_competition_id = v_main_predictor
        and user_id = v_user.user_id
        and status = 'active'
    ) then
      perform public.join_competition_game(v_main_predictor);
    end if;

    select count(*) into v_prediction_count
    from public.season_predictions sp
    join public.entries e on e.id = sp.entry_id
    join public.season_fixtures sf on sf.id = sp.season_fixture_id
    where e.tournament_id = v_tournament
      and e.user_id = v_user.user_id
      and sf.competition_round_id = v_mw2;

    select smc.status into v_card_status
    from public.season_matchweek_cards smc
    join public.entries e on e.id = smc.entry_id
    where e.tournament_id = v_tournament
      and e.user_id = v_user.user_id
      and smc.competition_round_id = v_mw2;

    -- Nicky's own real Development choices are a hard boundary: use them,
    -- never replace them.
    if v_user.user_id = '${NICKY_USER_ID}'::uuid then
      if v_prediction_count <> 6 or v_card_status is distinct from 'confirmed' then
        raise exception 'Nicky Gregal MW2 card changed from the protected six-pick confirmed baseline';
      end if;
    elsif v_prediction_count = 0 then
      v_fixture_no := 0;
      for v_fixture in
        select sf.id
        from public.season_fixtures sf
        where sf.tournament_id = v_tournament
          and sf.competition_round_id = v_mw2
        order by sf.kickoff_at, sf.id
      loop
        v_fixture_no := v_fixture_no + 1;
        v_home := ((v_user.seed_order + v_fixture_no) % 4)::smallint;
        v_away := ((v_user.seed_order * 2 + v_fixture_no + 1) % 4)::smallint;
        perform public.save_season_prediction(
          v_tournament, v_fixture.id, v_home, v_away, 0
        );
      end loop;
      perform public.confirm_season_matchweek_card(v_tournament, 2);
    elsif v_prediction_count <> 6 or v_card_status is distinct from 'confirmed' then
      raise exception 'Support user % has partial pre-existing MW2 state; refusing to overwrite it',
        v_user.expected_name;
    end if;

    if not exists (
      select 1 from public.game_memberships
      where game_competition_id = v_private_cup
        and user_id = v_user.user_id
        and status = 'active'
    ) then
      perform public.join_competition_game(v_private_cup);
    end if;
  end loop;

  update public.bonus_competitions
     set registration_closes_at = now(), updated_at = now()
   where id = v_private_cup;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', '${NICKY_USER_ID}',
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('admin_role', 'super_admin')
    )::text,
    true
  );

  select public.admin_open_season_competition(v_private_cup) into v_launch;
  if v_launch->>'outcome' <> 'launched' then
    raise exception 'Private Championship did not launch: %', v_launch;
  end if;
end;
$seed$;

commit;
`
}

function main() {
  process.stdout.write(
    [
      '-- Hosted Development rehearsal seed: Scottish private Predictor Championship.',
      '-- GENERATED from scripts/seed-dev/seed-scottish-private-championship-weekend.ts',
      '-- Prints SQL only; it does not connect to Supabase.',
      '-- Nicky Gregal is a required entrant and his existing MW2 card is never overwritten.',
      '-- The public Championship is deliberately untouched.',
      '',
      seedSql(),
    ].join('\n'),
  )
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main()
