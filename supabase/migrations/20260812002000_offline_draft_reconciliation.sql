-- ---------------------------------------------------------------------------
-- Contract 177 — INNOV-020: reconciling a batch of drafts written while the
-- phone had no signal.
--
-- Promoted from the Innovation Lab register by the owner authorisation of
-- 12 August 2026 and recorded in ADR 0027.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS ALREADY TRUE, MEASURED RATHER THAN ASSUMED
-- ---------------------------------------------------------------------------
--
-- The server-side half of offline drafting mostly exists and is not the gap:
--
--   * `season_predictions.version` carries contract 47's shared
--     `enforce_write_version` trigger, so a second device's write raises
--     `PT409` rather than silently overwriting the first;
--   * `predictor_internal.enforce_season_matchweek_lock` refuses an insert,
--     update or delete past the matchweek's own lock, resolved server-side;
--   * `save_season_prediction` accepts no instant of any kind, so a client
--     cannot backdate a draft by describing when it wrote it.
--
-- What is missing is the SHAPE OF THE ANSWER. `save_season_prediction` submits
-- one fixture and either succeeds or raises. A phone reconnecting with eight
-- drafts has to make eight calls and, worse, gets a single exception per call
-- with nothing to distinguish "this one is locked" from "someone else edited
-- this one on the laptop" without parsing a message. Wrapping the eight in one
-- transaction is worse still: one locked fixture would roll back the seven that
-- were perfectly submittable.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS ADDS, AND WHAT IT DELIBERATELY DOES NOT
-- ---------------------------------------------------------------------------
--
-- One call, PER-ITEM outcomes, and no new rule anywhere. Every draft is routed
-- through `public.save_season_prediction` unchanged, inside its own
-- subtransaction, so the lock, the version check, the Joker allowance and the
-- card's provisional status are all enforced by the triggers and the function
-- that already own them. This contract adds no second write path: if it were
-- deleted, every rule it appears to enforce would still be enforced.
--
-- The outcomes are the vocabulary a reconciling client needs:
--
--   accepted  — written; the new stored version is returned so the device can
--               keep drafting from it
--   locked    — the matchweek's lock has passed (`55000`). Not retryable, and
--               the draft is the player's to discard
--   conflict  — another device wrote this fixture since this draft was taken
--               (`PT409`). The stored version and the stored scores come back,
--               so the surface can show both and let the player choose
--   invalid   — a malformed draft (`22023`); the reason is passed through
--   refused   — anything else the server said no to, with its SQLSTATE
--
-- A refusal to authenticate or authorise is NOT one of these: `42501` is
-- re-raised rather than reported per item, because a batch that quietly
-- reports "insufficient_privilege" eight times would look like eight ordinary
-- rejections instead of one broken session.
--
-- TWO DRAFTS FOR ONE FIXTURE REFUSE THE WHOLE CALL. Applying both would make
-- the stored value depend on the order of a JSON array, and applying the last
-- silently discards a prediction the player made. That is a client defect, and
-- a defect is better as a refusal than as a coin toss.
--
-- The batch is capped at sixty drafts — six matchweeks of a twenty-club
-- division, comfortably more than any offline session and far short of a way to
-- drive the write path in bulk.
--
-- NO CLIENT TIMESTAMP ANYWHERE. The function takes no instant, reads none from
-- the payload, and the lock it is measured against is derived server-side from
-- `predictor_internal.season_matchweek_lock_at`. A source assertion below
-- refuses any future redefinition that grows a timestamp parameter.
-- ---------------------------------------------------------------------------

begin;

create or replace function public.save_season_predictions_batch(
  p_tournament_id uuid,
  p_drafts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $batch$
declare
  c_max_drafts constant integer := 60;
  v_uid uuid := (select auth.uid());
  v_entry uuid;
  v_draft jsonb;
  v_fixture uuid;
  v_home smallint;
  v_away smallint;
  v_version integer;
  v_results jsonb := '[]'::jsonb;
  v_accepted integer := 0;
  v_rejected integer := 0;
  v_count integer;
  v_saved jsonb;
  v_stored_version integer;
  v_stored_home smallint;
  v_stored_away smallint;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_tournament_id is null then
    raise exception 'A competition season is required' using errcode = '22023';
  end if;

  if p_drafts is null or jsonb_typeof(p_drafts) <> 'array' then
    raise exception 'Drafts must be a JSON array' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_drafts);

  if v_count > c_max_drafts then
    raise exception 'A batch carries at most % drafts; % were sent',
      c_max_drafts, v_count using errcode = '22023';
  end if;

  select player_entry.id into v_entry
    from public.entries player_entry
   where player_entry.user_id = v_uid
     and player_entry.tournament_id = p_tournament_id;

  if v_entry is null then
    raise exception 'You have not entered this season' using errcode = 'insufficient_privilege';
  end if;

  -- Two drafts for one fixture: refuse the call rather than pick one.
  -- Nulls are excluded: two drafts naming no fixture at all are two malformed
  -- drafts, and each gets the per-item `invalid` this contract promises rather
  -- than being reported as a collision between things that name nothing.
  if exists (
    select 1
      from jsonb_array_elements(p_drafts) draft
     where draft ->> 'fixture_id' is not null
     group by draft ->> 'fixture_id'
    having count(*) > 1
  ) then
    raise exception 'The batch names the same fixture more than once'
      using errcode = '22023';
  end if;

  for v_draft in select value from jsonb_array_elements(p_drafts) loop
    v_fixture := null;
    v_home := null;
    v_away := null;
    v_version := null;

    begin
      v_fixture := (v_draft ->> 'fixture_id')::uuid;
      v_home := case when v_draft ->> 'home' is null then null
                     else (v_draft ->> 'home')::smallint end;
      v_away := case when v_draft ->> 'away' is null then null
                     else (v_draft ->> 'away')::smallint end;
      v_version := coalesce((v_draft ->> 'version')::integer, 0);
    exception
      when others then
        v_rejected := v_rejected + 1;
        v_results := v_results || jsonb_build_object(
          'fixture_id', v_draft ->> 'fixture_id',
          'outcome', 'invalid',
          'reason', 'A draft needs a fixture id and whole-number scores or none');
        continue;
    end;

    -- Each draft in its own subtransaction, so a locked or conflicting one
    -- rejects itself and leaves the rest of the batch standing.
    begin
      v_saved := public.save_season_prediction(
        p_tournament_id, v_fixture, v_home, v_away, v_version);

      v_accepted := v_accepted + 1;
      v_results := v_results || jsonb_build_object(
        'fixture_id', v_fixture,
        'outcome', 'accepted',
        'cleared', v_home is null,
        'version', v_saved -> 'version');
    exception
      when sqlstate '55000' then
        v_rejected := v_rejected + 1;
        v_results := v_results || jsonb_build_object(
          'fixture_id', v_fixture,
          'outcome', 'locked',
          'reason', sqlerrm);
      when sqlstate 'PT409' then
        -- Return what the server holds, so the surface can show the player
        -- both versions rather than telling them only that they lost.
        select prediction.version, prediction.home_score, prediction.away_score
          into v_stored_version, v_stored_home, v_stored_away
          from public.season_predictions prediction
         where prediction.entry_id = v_entry
           and prediction.season_fixture_id = v_fixture;

        v_rejected := v_rejected + 1;
        v_results := v_results || jsonb_build_object(
          'fixture_id', v_fixture,
          'outcome', 'conflict',
          'reason', 'Another device submitted this fixture after this draft was taken',
          'stored', jsonb_build_object(
            'version', v_stored_version,
            'home', v_stored_home,
            'away', v_stored_away),
          'draft', jsonb_build_object(
            'version', v_version, 'home', v_home, 'away', v_away));
      when sqlstate '22023' then
        v_rejected := v_rejected + 1;
        v_results := v_results || jsonb_build_object(
          'fixture_id', v_fixture,
          'outcome', 'invalid',
          'reason', sqlerrm);
      when sqlstate '42501' then
        -- Never per-item. A broken session is one fact about the call.
        raise;
      when others then
        v_rejected := v_rejected + 1;
        v_results := v_results || jsonb_build_object(
          'fixture_id', v_fixture,
          'outcome', 'refused',
          'sqlstate', sqlstate,
          'reason', sqlerrm);
    end;
  end loop;

  return jsonb_build_object(
    'server_now', now(),
    'submitted', v_count,
    'accepted', v_accepted,
    'rejected', v_rejected,
    'results', v_results);
end;
$batch$;

revoke all on function public.save_season_predictions_batch(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_season_predictions_batch(uuid, jsonb)
  to authenticated;

comment on function public.save_season_predictions_batch(uuid, jsonb) is
  'Contract 177 (INNOV-020). Submits a batch of offline drafts through '
  'save_season_prediction unchanged, one subtransaction each, returning a '
  'per-fixture outcome of accepted, locked, conflict, invalid or refused. '
  'Adds no rule and accepts no client timestamp.';

-- ---------------------------------------------------------------------------
-- The safety property, asserted against the installed definition rather than
-- against this file.
--
-- Two things must stay true, and both are the kind of thing a later edit
-- removes without noticing:
--
--   * the batch writes through `save_season_prediction` and NOT through the
--     prediction table, so it cannot become a second write path that misses a
--     trigger;
--   * it takes no instant from its caller, so a draft cannot be backdated
--     across a lock.
--
-- `pg_get_functiondef` returns comments with the code, so the source is
-- stripped of `--` comments before matching — the rule
-- `rpcAllowlistParity.test.ts` states, and the defect Database parity caught in
-- contracts 172 and 173.
-- ---------------------------------------------------------------------------

do $assert$
declare
  v_source text;
begin
  select string_agg(regexp_replace(line, '--.*$', ''), E'\n')
    into v_source
    from regexp_split_to_table(
      pg_get_functiondef('public.save_season_predictions_batch(uuid, jsonb)'::regprocedure),
      E'\n') line;

  if v_source !~ 'public\.save_season_prediction\(' then
    raise exception
      'The batch must submit through save_season_prediction, not around it';
  end if;

  if v_source ~* 'insert\s+into\s+public\.season_predictions'
     or v_source ~* 'update\s+public\.season_predictions'
     or v_source ~* 'delete\s+from\s+public\.season_predictions' then
    raise exception
      'The batch must not write season_predictions directly; that is a second write path';
  end if;

  if v_source ~* '(timestamptz|timestamp with time zone)\s*[,)]'
     or v_source ~* 'p_[a-z_]*(at|time|now|timestamp)\b' then
    raise exception
      'The batch must accept no caller-supplied instant; the lock is resolved server-side';
  end if;
end;
$assert$;

commit;
