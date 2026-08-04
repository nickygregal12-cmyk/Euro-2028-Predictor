-- Contract 83: notice that a matchweek has locked, and act on it.
--
-- Contract 80 decided what the lock does to a card. Contract 81 stored where
-- each card stands and an append-only record of what the lock did. Nothing yet
-- notices that a matchweek has locked. This is that job.
--
-- The contract number is the canonical migration count, so it is not a free
-- choice. Concurrent provider-ingestion work (#431) also wants a number, and
-- the resolution is merge order rather than push order — whichever lands first
-- takes the next count, and the other rebases onto it.
--
-- ---------------------------------------------------------------------------
-- WHERE THE LOCK INSTANT COMES FROM
-- ---------------------------------------------------------------------------
--
-- `competition_rounds` carries no lock time, and that is not an omission. The
-- instant is DERIVED from the matchweek's earliest kickoff minus the game's
-- `buffer_minutes`, exactly as `src/domain/competition/lockState.ts` derives it
-- for the browser. Storing a second copy would drift the moment a fixture is
-- rescheduled — and a rescheduled matchweek is precisely the case contract 81's
-- `locks_at` key exists to handle. One truth, derived in both languages, held
-- in step by `seasonMatchweekSchedulerParity.test.ts`.
--
-- FAIL CLOSED, as the browser authority does. A matchweek with no fixtures, or
-- with ANY fixture whose `kickoff_at` is null, has no derivable lock instant and
-- is not due. `season_fixtures.kickoff_at` is nullable precisely so a scheduled
-- but unconfirmed fixture can exist, and the browser treats missing fixture data
-- as a reason to stay locked. This treats it as a reason not to act. The failure
-- directions agree: nothing is submitted on incomplete data.
--
-- The browser additionally checks snapshot freshness (`observedAt`,
-- `validUntil`). That is a property of a fetched snapshot going stale in a tab,
-- not of the table this job reads, where `season_fixtures` IS the truth. It is
-- omitted deliberately rather than overlooked.
--
-- ---------------------------------------------------------------------------
-- WHY THE JOB ITERATES ENTRIES, NOT CARDS
-- ---------------------------------------------------------------------------
--
-- A player with no card row is unbanked, and it would be cheaper to skip them.
-- The job records them anyway, because without a row "not yet processed" and
-- "processed, and the player was unbanked" are indistinguishable — and the
-- first is a bug while the second is the rule working correctly. The ledger is
-- the only place that distinction can live.
--
-- ---------------------------------------------------------------------------
-- EVERY ENGAGED CARD IS RESOLVABLE, INCLUDING A PARTIAL ONE
-- ---------------------------------------------------------------------------
--
-- An earlier draft of this job could not process a partially filled card. ADR
-- 0012 then required the card to be pre-filled with "a sensible default", and
-- nothing in the repository said what the default was, so the job deferred
-- those cards rather than invent a scoring rule in a migration.
--
-- Contract 82 removed the question. The card is not pre-filled, a blank fixture
-- is submitted as no prediction, and it scores nothing — so there is no default
-- to be missing and nothing to defer. A partial card submits exactly what the
-- player entered, like any other.
--
-- The deferral counter is gone with it. A count that is now structurally always
-- zero would read as "nothing is wrong" rather than "this can no longer
-- happen", which is the more dangerous of the two.

begin;

-- ---------------------------------------------------------------------------
-- The derived lock instant. Null means "not derivable", which means "not due".
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_matchweek_lock_at(
  p_tournament_id uuid,
  p_round_id uuid,
  p_buffer_minutes integer
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    -- No fixtures, or any unconfirmed kickoff: no derivable instant. Counting
    -- rows and non-null kickoffs in one pass makes both conditions the same
    -- test, so neither can be lost independently of the other.
    when count(*) = 0 then null
    when count(*) <> count(fixture.kickoff_at) then null
    when p_buffer_minutes is null or p_buffer_minutes < 0 then null
    else min(fixture.kickoff_at) - make_interval(mins => p_buffer_minutes)
  end
  from public.season_fixtures fixture
  where fixture.tournament_id = p_tournament_id
    and fixture.competition_round_id = p_round_id;
$$;

revoke all on function predictor_internal.season_matchweek_lock_at(uuid, uuid, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The card as `resolve_season_card_at_lock` wants it.
--
-- Every fixture in the matchweek, carrying the player's prediction where they
-- gave one and JSON null where they did not. A LEFT JOIN, deliberately: an
-- INNER JOIN would silently drop the blanks, and the card would then look
-- complete to the resolver instead of partial.
--
-- Returns null only for a matchweek with no fixtures at all — which the lock
-- derivation already refuses, so the job never reaches it.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_card_fixtures(
  p_tournament_id uuid,
  p_entry_id uuid,
  p_round_id uuid
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_fixtures jsonb;
begin
  select jsonb_agg(
           jsonb_build_object(
             'fixtureId', fixture.id,
             'playerPrediction', case
               when prediction.id is null then null
               else jsonb_build_object(
                 'home', prediction.home_score, 'away', prediction.away_score)
             end
           )
           order by fixture.id
         )
    into v_fixtures
    from public.season_fixtures fixture
    left join public.season_predictions prediction
      on prediction.tournament_id = fixture.tournament_id
     and prediction.season_fixture_id = fixture.id
     and prediction.entry_id = p_entry_id
   where fixture.tournament_id = p_tournament_id
     and fixture.competition_round_id = p_round_id;

  return v_fixtures;
end;
$$;

revoke all on function predictor_internal.season_card_fixtures(uuid, uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The job.
--
-- Mirrors `public.process_due_entry_submissions`: `skip locked` so concurrent
-- runs do not fight, a `not exists` against the ledger so a retry after a crash
-- or redeploy is a no-op, and per-row exception handling so one contradictory
-- card cannot abort the batch for everyone else.
-- ---------------------------------------------------------------------------

create or replace function public.process_due_season_matchweek_submissions(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due record;
  v_attempted integer := 0;
  v_submitted integer := 0;
  v_unbanked integer := 0;
  v_refused integer := 0;
  v_status text;
  v_fixtures jsonb;
  v_resolution jsonb;
  v_failure text;
begin
  if p_now is null then
    raise exception 'Processing time is required'
      using errcode = '22023';
  end if;

  for v_due in
    select
      entry.id as entry_id,
      entry.tournament_id,
      round.id as competition_round_id,
      predictor_internal.season_matchweek_lock_at(
        entry.tournament_id, round.id, definition.buffer_minutes) as locks_at
    from public.entries entry
    join public.bonus_competitions game
      on game.tournament_id = entry.tournament_id
     and game.id = entry.game_competition_id
    join public.game_definitions definition
      on definition.game_key = game.game_key
    join public.competition_rounds round
      on round.tournament_id = entry.tournament_id
    -- Selected by PROPERTY, not by name: a matchweek-scoped game that holds a
    -- prediction entry. That is the Main Predictor today; Last Man Standing is
    -- matchweek-scoped but holds no card, and is settled by its own job.
    where definition.lock_scope = 'matchweek'
      and definition.requires_prediction_entry
      and round.kind = 'league_matchweek'
    order by round.id, entry.id
    for update of entry skip locked
  loop
    -- Not derivable is not due. Recording nothing here is deliberate: the
    -- fixture list can still be completed, and the matchweek becomes due then.
    continue when v_due.locks_at is null or v_due.locks_at > p_now;

    continue when exists (
      select 1
        from public.season_matchweek_submission_outcomes recorded
       where recorded.entry_id = v_due.entry_id
         and recorded.competition_round_id = v_due.competition_round_id
         and recorded.locks_at = v_due.locks_at
    );

    begin
      select card.status
        into v_status
        from public.season_matchweek_cards card
       where card.tournament_id = v_due.tournament_id
         and card.entry_id = v_due.entry_id
         and card.competition_round_id = v_due.competition_round_id;

      if v_status is null then
        v_attempted := v_attempted + 1;
        -- Rolling entry: absence IS no-submission. No row was ever written for
        -- this player, and none is invented for them now.
        insert into public.season_matchweek_submission_outcomes (
          tournament_id, entry_id, competition_round_id, locks_at,
          outcome, attempted_at
        ) values (
          v_due.tournament_id, v_due.entry_id, v_due.competition_round_id,
          v_due.locks_at, 'unbanked', p_now
        );
        v_unbanked := v_unbanked + 1;
        continue;
      end if;

      v_fixtures := predictor_internal.season_card_fixtures(
        v_due.tournament_id, v_due.entry_id, v_due.competition_round_id);

      v_attempted := v_attempted + 1;
      v_resolution := predictor_internal.resolve_season_card_at_lock(
        v_fixtures, v_status);

      if v_resolution->>'kind' = 'submitted' then
        insert into public.season_matchweek_submission_outcomes (
          tournament_id, entry_id, competition_round_id, locks_at,
          outcome, attempted_at, submitted_at, auto_completed
        ) values (
          v_due.tournament_id, v_due.entry_id, v_due.competition_round_id,
          -- `auto_completed` is always false now: contract 82 withdrew the
          -- pre-filled card, so nothing completes a card but the player. The
          -- column is contract 81's and stays; the value is now a constant fact
          -- rather than a resolver output.
          v_due.locks_at, 'submitted', p_now, p_now, false
        );
        v_submitted := v_submitted + 1;
      else
        insert into public.season_matchweek_submission_outcomes (
          tournament_id, entry_id, competition_round_id, locks_at,
          outcome, attempted_at, refusal_reason
        ) values (
          v_due.tournament_id, v_due.entry_id, v_due.competition_round_id,
          v_due.locks_at, 'refused', p_now,
          left(coalesce(v_resolution->>'reason', 'unknown'), 500)
        );
        v_refused := v_refused + 1;
      end if;
    exception
      when check_violation or foreign_key_violation or data_exception then
        get stacked diagnostics v_failure = message_text;
        -- The refusal is recorded rather than retried forever. A card that
        -- cannot be resolved is a fact about the card, and the next run must
        -- not spend the same work on it again.
        insert into public.season_matchweek_submission_outcomes (
          tournament_id, entry_id, competition_round_id, locks_at,
          outcome, attempted_at, refusal_reason
        ) values (
          v_due.tournament_id, v_due.entry_id, v_due.competition_round_id,
          v_due.locks_at, 'refused', p_now,
          left(coalesce(nullif(btrim(v_failure), ''), 'unknown'), 500)
        );
        v_refused := v_refused + 1;
    end;
  end loop;

  return jsonb_build_object(
    'processedAt', p_now,
    'attempted', v_attempted,
    'submitted', v_submitted,
    'unbanked', v_unbanked,
    'refused', v_refused
  );
end;
$$;

revoke all on function public.process_due_season_matchweek_submissions(timestamptz)
  from public, anon, authenticated, service_role;

grant execute on function public.process_due_season_matchweek_submissions(timestamptz)
  to service_role;

-- Every minute, matching the tournament's `euro28-auto-submit-due-entries`. A
-- matchweek lock is an instant, not a window, so a coarser cadence would let a
-- card sit unresolved for as long as the interval — and the run is a no-op when
-- nothing is due.
select cron.schedule(
  'season-process-due-matchweek-submissions',
  '* * * * *',
  'select public.process_due_season_matchweek_submissions();'
);

commit;
