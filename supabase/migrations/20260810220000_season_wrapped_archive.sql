-- ---------------------------------------------------------------------------
-- Contract 156 — MIG-UI-08: the season Wrapped and permanent history archive.
--
-- ---------------------------------------------------------------------------
-- WHY THIS ONE IS STORED, WHEN CONTRACT 150 REFUSED TO STORE
-- ---------------------------------------------------------------------------
--
-- Contract 150 derived league rank movement rather than snapshotting it, and
-- said why: "a snapshot table would add a second thing that can disagree with
-- the first". That reasoning is right and it does NOT apply here, for a reason
-- worth stating plainly rather than leaving as an apparent contradiction.
--
-- Movement is derivable forever, because `season_matchweek_scores` keeps every
-- banked total with its round. A Wrapped is not, because it is a statement
-- about a season that has ENDED, and the things it reports — final rank, field
-- size, percentile — are answers whose inputs keep moving afterwards. A player
-- who finished 12th of 4,000 stays 12th of 4,000 forever; re-deriving it next
-- year against a season that has since been archived, re-settled after a
-- correction, or had entrants erased under Stage C2, would quietly produce a
-- different past.
--
-- `predictor_internal.season_standings` is a FUNCTION, not a table. There is no
-- stored season table to point at. So "derive it later" means "re-run a
-- derivation over data that is allowed to change", which is precisely what a
-- permanent history must not do.
--
-- THE SNAPSHOT IS THEREFORE THE POINT, and the rules that make it safe are:
--
--   * it can only be taken once the season is COMPLETE, so it cannot capture a
--     table that is still moving;
--   * taking it twice is idempotent and the second call changes nothing, so a
--     retried job cannot rewrite history;
--   * it is immutable once written — a trigger refuses UPDATE and DELETE, so
--     "a later UI formula" cannot reach back and restate what a player was
--     told they finished;
--   * it stores FACTS and not presentation. No percentile band, no trophy
--     name, no copy. Those are the UI's, and the register's own evidence
--     requirement is that "a stored Wrapped does not change when a later UI
--     formula does" — which is only true if the formula was never stored.
--
-- ---------------------------------------------------------------------------
-- WHAT IT DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It computes no points. Every number comes from the banked authorities the
-- season, the leagues and the profile already use — `season_matchweek_scores`
-- and `predictor_internal.season_standings` — so a Wrapped cannot disagree
-- with the season it describes.
--
-- It does not decide when a season is over. `tournaments.status = 'complete'`
-- is that decision and it belongs to whoever runs the season.
-- ---------------------------------------------------------------------------

create table if not exists public.season_wrapped (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- The final table, as it stood.
  final_points integer not null,
  final_rank integer not null,
  field_size integer not null,
  matchweeks_played integer not null,

  -- The season's own shape.
  best_matchweek_ordinal integer,
  best_matchweek_points integer,
  exact_scores integer not null default 0,
  correct_outcomes integer not null default 0,
  fixtures_predicted integer not null default 0,
  jokers_played integer not null default 0,

  finalised_at timestamptz not null default now(),

  primary key (tournament_id, entry_id)
);

alter table public.season_wrapped enable row level security;

-- Read through the bounded read below, never directly. A season's whole final
-- table is exactly the kind of thing a `select *` turns into a scrape.
revoke all on table public.season_wrapped from public, anon, authenticated;

create index if not exists season_wrapped_user_idx
  on public.season_wrapped (user_id);

-- ---------------------------------------------------------------------------
-- Immutable once written.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.refuse_wrapped_rewrite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $refuse$
begin
  raise exception 'A finalised season Wrapped is immutable'
    using errcode = '55006';
end;
$refuse$;

revoke all on function predictor_internal.refuse_wrapped_rewrite()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_season_wrapped_immutable on public.season_wrapped;
create trigger trg_season_wrapped_immutable
  before update or delete on public.season_wrapped
  for each row execute function predictor_internal.refuse_wrapped_rewrite();

-- ---------------------------------------------------------------------------
-- Finalising it.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.finalise_season_wrapped(p_tournament_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $finalise$
declare
  v_status text;
  v_kind text;
  v_existing integer;
  v_written integer;
begin
  select season.status, season.kind
    into v_status, v_kind
    from public.tournaments season
    where season.id = p_tournament_id;

  if v_kind is distinct from 'league_season' then
    return jsonb_build_object('outcome', 'refused', 'reason', 'not_a_league_season');
  end if;

  -- A season still being played has a table that is still moving. Reporting a
  -- final rank from it would tell a player they finished somewhere they had
  -- not finished.
  if v_status is distinct from 'complete' then
    return jsonb_build_object('outcome', 'refused', 'reason', 'season_not_complete',
                              'status', v_status);
  end if;

  select count(*)::integer into v_existing
    from public.season_wrapped where tournament_id = p_tournament_id;

  -- Idempotent by doing nothing, not by rewriting. A retried job must not be
  -- able to restate a past a player has already been shown.
  if v_existing > 0 then
    return jsonb_build_object('outcome', 'already_finalised', 'entries', v_existing);
  end if;

  with standing as (
    select (row ->> 'entryId')::uuid as entry_id,
           (row ->> 'points')::integer as points,
           (row ->> 'matchweeksPlayed')::integer as matchweeks_played,
           rank() over (order by (row ->> 'points')::integer desc)::integer as final_rank,
           count(*) over ()::integer as field_size
      from jsonb_array_elements(
             coalesce(predictor_internal.season_standings(p_tournament_id), '[]'::jsonb)) row
  ),
  best as (
    select score.entry_id, round.ordinal, score.points,
           row_number() over (partition by score.entry_id
                              order by score.points desc, round.ordinal) as pick
      from public.season_matchweek_scores score
      join public.competition_rounds round on round.id = score.competition_round_id
     where score.tournament_id = p_tournament_id
  ),
  accuracy as (
    select prediction.entry_id,
           count(*)::integer as fixtures_predicted,
           count(*) filter (
             where fixture.home_score = prediction.home_score
               and fixture.away_score = prediction.away_score)::integer as exact_scores,
           count(*) filter (
             where sign(fixture.home_score - fixture.away_score)
                 = sign(prediction.home_score - prediction.away_score))::integer as correct_outcomes
      from public.season_predictions prediction
      join public.season_fixtures fixture on fixture.id = prediction.season_fixture_id
     where prediction.tournament_id = p_tournament_id
       and fixture.status = 'played'
     group by prediction.entry_id
  ),
  jokers as (
    select joker.entry_id, count(*)::integer as played
      from public.season_matchweek_jokers joker
     where joker.tournament_id = p_tournament_id
     group by joker.entry_id
  )
  insert into public.season_wrapped (
    tournament_id, entry_id, user_id,
    final_points, final_rank, field_size, matchweeks_played,
    best_matchweek_ordinal, best_matchweek_points,
    exact_scores, correct_outcomes, fixtures_predicted, jokers_played
  )
  select p_tournament_id,
         standing.entry_id,
         player_entry.user_id,
         standing.points,
         standing.final_rank,
         standing.field_size,
         standing.matchweeks_played,
         best.ordinal,
         best.points,
         coalesce(accuracy.exact_scores, 0),
         coalesce(accuracy.correct_outcomes, 0),
         coalesce(accuracy.fixtures_predicted, 0),
         coalesce(jokers.played, 0)
    from standing
    join public.entries player_entry on player_entry.id = standing.entry_id
    left join best on best.entry_id = standing.entry_id and best.pick = 1
    left join accuracy on accuracy.entry_id = standing.entry_id
    left join jokers on jokers.entry_id = standing.entry_id;

  get diagnostics v_written = row_count;

  return jsonb_build_object('outcome', 'finalised', 'entries', v_written);
end;
$finalise$;

revoke all on function predictor_internal.finalise_season_wrapped(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reading your own.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_wrapped(p_tournament_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $read$
declare
  v_uid uuid := (select auth.uid());
  v_row public.season_wrapped%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row
    from public.season_wrapped wrapped
    where wrapped.tournament_id = p_tournament_id
      and wrapped.user_id = v_uid;

  -- A season that has not been finalised is a real state, not an error: the
  -- player is asking a fair question and the answer is "not yet".
  if not found then
    return jsonb_build_object('finalised', false);
  end if;

  return jsonb_build_object(
    'finalised', true,
    'season', jsonb_build_object(
      'points', v_row.final_points,
      'rank', v_row.final_rank,
      'field_size', v_row.field_size,
      'matchweeks_played', v_row.matchweeks_played),
    'best_matchweek', case
      when v_row.best_matchweek_ordinal is null then null
      else jsonb_build_object('ordinal', v_row.best_matchweek_ordinal,
                              'points', v_row.best_matchweek_points)
    end,
    'accuracy', jsonb_build_object(
      'fixtures_predicted', v_row.fixtures_predicted,
      'exact_scores', v_row.exact_scores,
      'correct_outcomes', v_row.correct_outcomes),
    'jokers_played', v_row.jokers_played,
    'finalised_at', v_row.finalised_at);
end;
$read$;

revoke all on function public.get_season_wrapped(uuid) from public, anon;
grant execute on function public.get_season_wrapped(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_finalise text := pg_get_functiondef('predictor_internal.finalise_season_wrapped(uuid)'::regprocedure);
begin
  -- Facts, not presentation. The register's evidence requirement is that a
  -- stored Wrapped does not change when a later UI formula does, and that is
  -- only true if the formula was never stored.
  if v_finalise ~* 'percentile|trophy|badge|headline|copy' then
    raise exception 'The Wrapped must store facts, not presentation';
  end if;

  -- It recomputes no points.
  if v_finalise !~ 'season_standings' or v_finalise !~ 'season_matchweek_scores' then
    raise exception 'The Wrapped must come from the banked authorities';
  end if;

  -- It refuses an incomplete season.
  if v_finalise !~ 'season_not_complete' then
    raise exception 'The Wrapped must refuse a season that is still being played';
  end if;

  -- Immutability is enforced, not documented.
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_season_wrapped_immutable'
  ) then
    raise exception 'A finalised Wrapped must be immutable by trigger';
  end if;

  if exists (
    select 1 from information_schema.table_privileges
     where table_schema = 'public' and table_name = 'season_wrapped'
       and grantee in ('anon', 'authenticated', 'PUBLIC')
  ) then
    raise exception 'A season''s whole final table must not be selectable by a browser role';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'public' and routine_name = 'get_season_wrapped'
       and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'A Wrapped must not be readable anonymously';
  end if;
end;
$$;
