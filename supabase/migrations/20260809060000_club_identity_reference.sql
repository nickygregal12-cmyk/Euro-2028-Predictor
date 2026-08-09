-- Contract 136: a club has a code and colours, so it stops rendering as a blank
-- shirt.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT, MEASURED
-- ---------------------------------------------------------------------------
--
-- `DFA-003`'s `ClubIdentity` is delivered and adopted: it renders a shirt in
-- the club's colours with a three-letter monogram, and it is deliberately not a
-- crest, because no provider grants the right to display one.
--
-- It renders every club identically today, in the neutral fallback grey. The
-- reason is not in the component. `resolveClubIdentity` takes a provider club —
-- `{ externalId, name, shortName?, tla?, clubColors? }` — and the only caller
-- in production code, `seasonMatchPredictor.ts`, constructs one from the two
-- fields the matchweek card returns:
--
--     resolveClubIdentity({ externalId: fixture.id, name: fixture.home_name })
--
-- No `tla`, so the monogram is derived from the name and the curated pattern
-- overlay — which is keyed by three-letter code — can never match, so
-- Newcastle's stripes and Celtic's hoops are unreachable. No `clubColors`, so
-- `parseClubColours` returns an empty array and every club falls to
-- `FALLBACK_PRIMARY`.
--
-- `public.teams` holds `id`, `tournament_id`, `name` and `created_at`. There is
-- nowhere for a code or a colour to come from.
--
-- ---------------------------------------------------------------------------
-- WHY THE COLUMNS ARE SHAPED LIKE A PROVIDER RESPONSE
-- ---------------------------------------------------------------------------
--
-- `club_colours` stores free text in football-data.org's own idiom — 'Claret /
-- Sky Blue' — rather than hex. That looks like the weaker choice and is the
-- stronger one:
--
--   * `parseClubColours` and its named-colour map already exist, are pure, and
--     are covered by tests. Storing hex would mean changing a domain authority
--     to accept a second format for no gain;
--   * the ordering is meaningful in both — the first colour is the shirt;
--   * it is the shape a provider would eventually populate, so the enrichment
--     lane can fill these columns later without a second schema.
--
-- The values seeded here are NOT provider data. They are ordinary club colours,
-- which are facts rather than assets, and they are written from the owner's own
-- reference rather than copied from a provider payload. The capability audit's
-- image rule is untouched: no crest, no logo, no `image_path`, nothing this
-- platform lacks the right to display.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A REFERENCE TABLE AND NOT TWO COLUMNS ON `teams`
-- ---------------------------------------------------------------------------
--
-- Columns on `public.teams` were the first design and are the wrong one here,
-- for a reason that only appears when you ask when the data would be written.
--
-- A migration can only seed the clubs that exist when it runs. Hosted
-- development holds its 32 real clubs already, so columns would work there —
-- but a database rebuilt from the committed migrations loads its seed AFTER
-- them, so every club would come back blank, and contract 132's approval path
-- creates clubs later still. The columns would be correct in exactly one
-- environment and silently empty everywhere else.
--
-- Resolving at read time has none of that. A club seeded, promoted or adopted
-- at any point picks up its identity the first time it is read, an operator
-- adds a promoted club by inserting one row, and `public.teams` is not altered
-- at all — no new column, no new constraint, no new trigger on a relation that
-- fixtures, predictions and results all key on.
--
-- The match is on a NORMALISED name because the two hosted providers disagree:
-- football-data says 'Arsenal FC' and SportMonks says plain 'Celtic'. A club
-- the reference does not name resolves to null and renders exactly as it does
-- today — the neutral fallback — so nothing can regress.

begin;

-- ---------------------------------------------------------------------------
-- The name normaliser.
--
-- Immutable, because the seed below joins on it and a stable answer is the
-- whole point. Letters only, then the legal suffix or prefix a provider adds
-- and a supporter never says.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.normalised_club_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $normalise$
  select pg_catalog.regexp_replace(
           pg_catalog.regexp_replace(
             pg_catalog.regexp_replace(
               -- `coalesce` is a SQL construct rather than a catalogue
               -- function, so it is not schema-qualified and does not need to
               -- be: it cannot be shadowed by a search_path.
               pg_catalog.lower(coalesce(p_name, '')),
               '[^a-z]', '', 'g'),
             '^(afc|fc)', ''),
           '(afc|fc)$', '');
$normalise$;

revoke all on function predictor_internal.normalised_club_name(text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The reference itself.
--
-- Kept as a table rather than inlined into one update, because an operator
-- adding a promoted club should be adding a row, not editing a statement. It is
-- internal: it decides no rule and no browser reads it.
-- ---------------------------------------------------------------------------

create table predictor_internal.club_identity_reference (
  normalised_name text primary key,
  short_code text not null,
  club_colours text not null,
  note text,

  constraint club_identity_reference_short_code_shape
    check (short_code ~ '^[A-Z]{2,4}$'),
  constraint club_identity_reference_colours_bound
    check (char_length(btrim(club_colours)) between 1 and 120)
);

comment on table predictor_internal.club_identity_reference is
  'Contract 136. Owner-controlled club code and colours, matched onto teams by '
  'normalised name. Not provider data and not a crest.';

alter table predictor_internal.club_identity_reference enable row level security;

revoke all on table predictor_internal.club_identity_reference
  from public, anon, authenticated, service_role;

-- Colour words are chosen from the vocabulary `parseClubColours` already
-- resolves. A word outside it falls back rather than guessing a shade, which is
-- that function's documented behaviour and is why the list stays conservative.
insert into predictor_internal.club_identity_reference
  (normalised_name, short_code, club_colours, note)
values
  -- Premier League and recent members.
  ('arsenal',                'ARS', 'Red / White',            null),
  ('astonvilla',             'AVL', 'Claret / Sky Blue',      null),
  ('bournemouth',            'BOU', 'Red / Black',            null),
  ('brentford',              'BRE', 'Red / White',            'striped in the overlay'),
  ('brightonhovealbion',     'BHA', 'Blue / White',           null),
  ('burnley',                'BUR', 'Claret / Sky Blue',      null),
  ('chelsea',                'CHE', 'Royal Blue / White',     null),
  ('coventrycity',           'COV', 'Sky Blue / White',       null),
  ('crystalpalace',          'CRY', 'Blue / Red',             'sash in the overlay'),
  ('everton',                'EVE', 'Blue / White',           null),
  ('fulham',                 'FUL', 'White / Black',          'dark monogram in the overlay'),
  ('ipswichtown',            'IPS', 'Blue / White',           null),
  ('leedsunited',            'LEE', 'White / Blue',           null),
  ('leicestercity',          'LEI', 'Royal Blue / White',     null),
  ('liverpool',              'LIV', 'Red / White',            null),
  ('lutontown',              'LUT', 'Orange / Navy',          null),
  ('manchestercity',         'MCI', 'Sky Blue / White',       'dark monogram in the overlay'),
  ('manchesterunited',       'MUN', 'Red / White',            null),
  ('middlesbrough',          'MID', 'Red / White',            null),
  ('newcastleunited',        'NEW', 'Black / White',          'striped in the overlay'),
  ('norwichcity',            'NOR', 'Yellow / Green',         null),
  ('nottinghamforest',       'NFO', 'Red / White',            null),
  ('sheffieldunited',        'SHU', 'Red / White',            null),
  ('southampton',            'SOU', 'Red / White',            null),
  ('sunderland',             'SUN', 'Red / White',            null),
  ('tottenhamhotspur',       'TOT', 'White / Navy',           'dark monogram in the overlay'),
  ('watford',                'WAT', 'Yellow / Black',         null),
  ('westbromwichalbion',     'WBA', 'Navy / White',           null),
  ('westhamunited',          'WHU', 'Claret / Sky Blue',      null),
  ('wolverhamptonwanderers', 'WOL', 'Gold / Black',           'dark monogram in the overlay'),

  -- Scottish Premiership and recent members.
  ('aberdeen',               'ABD', 'Red / White',            null),
  ('celtic',                 'CEL', 'Green / White',          'hooped in the overlay'),
  ('dundee',                 'DEE', 'Navy / White',           null),
  ('dundeeunited',           'DUU', 'Orange / Black',         'dark monogram would suit; overlay owns it'),
  ('falkirk',                'FAL', 'Navy / White',           null),
  ('heartofmidlothian',      'HEA', 'Maroon / White',         null),
  ('hearts',                 'HEA', 'Maroon / White',         'short provider form'),
  ('hibernian',              'HIB', 'Green / White',          null),
  ('kilmarnock',             'KIL', 'Blue / White',           null),
  ('livingston',             'LIV', 'Yellow / Black',         'shares a code with Liverpool; codes are not unique'),
  ('motherwell',             'MOT', 'Amber / Claret',         null),
  ('partickthistle',         'PAR', 'Yellow / Red',           null),
  ('rangers',                'RAN', 'Royal Blue / White',     null),
  ('rosscounty',             'ROS', 'Navy / White',           null),
  ('stjohnstone',            'STJ', 'Royal Blue / White',     null),
  ('stmirren',               'STM', 'Black / White',          'striped; overlay owns the pattern');

-- ---------------------------------------------------------------------------
-- The matchweek card carries it, and says what the football is doing.
--
-- Replaced rather than joined by a second read: this is the same card, for the
-- same rows, with the club identity it should always have carried. The
-- signature does not move, so the deployment contract is unchanged.
--
-- The live block is contract 135's projection and is labelled as what it is.
-- `result_home`/`result_away` remain the only confirmed result, and a surface
-- that shows the live block must show it as provisional — it is not an input to
-- any lock, score or standing, and this read does not let it become one.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_matchweek_card(
  p_tournament_id uuid,
  p_matchweek integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_card_status text;
  v_joker jsonb;
  v_fixtures jsonb;
  v_points integer;
begin
  select * into v_ctx
    from predictor_internal.season_card_context(p_tournament_id, p_matchweek);

  if v_ctx.o_entry_id is null then
    v_card_status := 'no_submission';
  else
    select status into v_card_status
      from public.season_matchweek_cards
     where entry_id = v_ctx.o_entry_id
       and competition_round_id = v_ctx.o_round_id;
    v_card_status := coalesce(v_card_status, 'no_submission');
  end if;

  select jsonb_build_object(
      'played', count(*) filter (where round.id = v_ctx.o_round_id) > 0,
      'used_first_half', count(*) filter (where round.ordinal <= v_ctx.o_half_size),
      'used_second_half', count(*) filter (where round.ordinal > v_ctx.o_half_size),
      'matchweek_count', v_ctx.o_matchweek_count
    )
    into v_joker
    from public.season_matchweek_jokers joker
    join public.competition_rounds round on round.id = joker.competition_round_id
   where joker.entry_id = v_ctx.o_entry_id
     and round.kind = 'league_matchweek';

  select points into v_points
    from public.season_matchweek_scores
   where entry_id = v_ctx.o_entry_id
     and competition_round_id = v_ctx.o_round_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', fixture.id,
      'kickoff_at', fixture.kickoff_at,
      'status', fixture.status,
      'home_name', home_team.name,
      'away_name', away_team.name,
      'home_short_code', home_identity.short_code,
      'away_short_code', away_identity.short_code,
      'home_club_colours', home_identity.club_colours,
      'away_club_colours', away_identity.club_colours,
      'result_home', case when fixture.status = 'played' then fixture.home_score end,
      'result_away', case when fixture.status = 'played' then fixture.away_score end,
      'live', case when live.season_fixture_id is not null then jsonb_build_object(
        'kind', live.kind,
        'home', live.home_score,
        'away', live.away_score,
        'observed_at', live.observed_at
      ) end,
      'prediction', case when prediction.id is not null then jsonb_build_object(
        'home', prediction.home_score,
        'away', prediction.away_score,
        'version', prediction.version
      ) end
    ) order by fixture.kickoff_at nulls last, fixture.id), '[]'::jsonb)
    into v_fixtures
    from public.season_fixtures fixture
    join public.teams home_team on home_team.id = fixture.home_team_id
    join public.teams away_team on away_team.id = fixture.away_team_id
    left join predictor_internal.club_identity_reference home_identity
      on home_identity.normalised_name
       = predictor_internal.normalised_club_name(home_team.name)
    left join predictor_internal.club_identity_reference away_identity
      on away_identity.normalised_name
       = predictor_internal.normalised_club_name(away_team.name)
    left join predictor_internal.season_fixture_live_state live
      on live.season_fixture_id = fixture.id
    left join public.season_predictions prediction
      on prediction.season_fixture_id = fixture.id
     and prediction.entry_id = v_ctx.o_entry_id
   where fixture.competition_round_id = v_ctx.o_round_id;

  return jsonb_build_object(
    'matchweek', jsonb_build_object('number', p_matchweek, 'of', v_ctx.o_matchweek_count),
    'card_status', v_card_status,
    'joker', v_joker,
    'settled_points', v_points,
    'fixtures', v_fixtures
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace ns on ns.oid = relation.relnamespace
     where ns.nspname = 'predictor_internal'
       and relation.relname = 'club_identity_reference'
       and relation.relrowsecurity
  ) then
    raise exception 'club_identity_reference must have row level security enabled';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'predictor_internal'
       and table_name = 'club_identity_reference'
       and grantee in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'club_identity_reference must not be reachable by a browser or service role';
  end if;

  -- The normaliser is the join key, so a change in its behaviour silently
  -- unseeds every club. These are the three forms the two hosted providers
  -- actually produce.
  if predictor_internal.normalised_club_name('Arsenal FC') <> 'arsenal'
     or predictor_internal.normalised_club_name('AFC Bournemouth') <> 'bournemouth'
     or predictor_internal.normalised_club_name('Heart of Midlothian') <> 'heartofmidlothian'
  then
    raise exception 'the club name normaliser does not resolve the known provider forms';
  end if;

  if (select count(*) from predictor_internal.club_identity_reference) < 40 then
    raise exception 'the club identity reference is too small to cover both seasons';
  end if;
end;
$$;

commit;
