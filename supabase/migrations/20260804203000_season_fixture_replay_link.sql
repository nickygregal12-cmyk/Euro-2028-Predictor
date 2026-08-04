-- Contract 92: which fixture a replay is.
--
-- WHY THIS EXISTS, and why it blocks the scoring job rather than following it.
-- Contract 91 gave `matchweekSettlement.ts` a PostgreSQL counterpart, and that
-- authority has four dispositions. Three of them — scoreable, awaiting_result,
-- awaiting_replay, void_no_points — are reachable from `season_fixtures.status`
-- today. The fourth, `carried_to_replay`, is NOT: nothing in the schema can say
-- which fixture an abandoned match handed its slot to, so the resolver's
-- `replayFixtureId` could only ever arrive null from stored data.
--
-- That is not a cosmetic gap. `carried_to_replay` is the disposition that
-- removes a fixture from the matches-played denominator, and it is the half of
-- that rule contract 91's header calls the one that is easy to get wrong. A
-- scoring job written against the schema as it stood would have had exactly one
-- behaviour available for an abandoned fixture — `awaiting_replay` — and a
-- matchweek containing one would never settle and never score. For every player
-- in that league. Until an operator intervened.
--
-- And the only interventions available would have been lies: void the abandoned
-- fixture, which says "never to be played" about a match that WAS replayed and
-- silently drops it from the denominator with no replay to take its slot; or
-- mark the original `played` and enter the replay's score against the original
-- date, which makes the fixture list disagree with what happened. Leaving the
-- link out does not leave the season neutral — it pushes the operator into
-- corrupting it. So the link comes first, and the job is contract 93.
--
-- ---------------------------------------------------------------------------
-- WHAT THE SCHEMA NOW MAKES UNCONSTRUCTIBLE
-- ---------------------------------------------------------------------------
--
-- Two of contract 91's six refusal reasons describe cards this table can no
-- longer produce:
--
--   replay_on_non_abandoned_fixture — refused by `season_fixtures_replay_only_when_abandoned`
--   replay_self_reference           — refused by `season_fixtures_replay_not_self`
--
-- The resolver keeps both, and that is deliberate rather than redundant: it is
-- a pure function over a jsonb card and serves callers whose fixtures are not
-- yet stored — a preview, a proposed correction, an import being validated. The
-- schema stops bad data being kept; the resolver stops bad data being believed.
-- Removing either would leave one of those two paths unguarded.

begin;

alter table public.season_fixtures
  add column if not exists replay_fixture_id uuid;

-- Composite, so a replay cannot be borrowed from another tournament's season.
--
-- `on delete restrict`, NOT `set null`: a null-out would silently return the
-- abandoned fixture to the matches-played denominator with no replay holding
-- its slot, changing a settled historic total with no statement anywhere that
-- anything changed. Restrict forces the unlink to be explicit. It also means a
-- `competition_rounds` delete cascading into its fixtures is refused while one
-- of them is somebody's replay, which is the correct answer: that round's
-- deletion would alter another matchweek's denominator.
alter table public.season_fixtures
  add constraint season_fixtures_replay_fkey
    foreign key (tournament_id, replay_fixture_id)
    references public.season_fixtures(tournament_id, id)
    on delete restrict;

-- Only an abandoned fixture hands its slot on. `status` is NOT NULL, so this
-- conjunction has no three-valued hole.
alter table public.season_fixtures
  add constraint season_fixtures_replay_only_when_abandoned
    check (replay_fixture_id is null or status = 'abandoned');

alter table public.season_fixtures
  add constraint season_fixtures_replay_not_self
    check (replay_fixture_id is null or replay_fixture_id <> id);

-- A fixture is the replay for AT MOST ONE abandoned match. Two abandoned
-- fixtures pointing at the same replay would each leave the denominator while
-- only one match took their place, so the matchweek would report one fewer
-- match played than was ever played. Postgres treats nulls as distinct, so the
-- unlinked majority is unaffected; the partial index says so explicitly and
-- stays small.
create unique index season_fixtures_replay_target_unique
  on public.season_fixtures (replay_fixture_id)
  where replay_fixture_id is not null;

-- ---------------------------------------------------------------------------
-- Cycles, which no CHECK can see.
--
-- `A abandoned → B` and `B abandoned → A` satisfies every constraint above:
-- both rows are abandoned, neither points at itself, and no replay is shared.
-- Both fixtures would then be `carried_to_replay`, both would leave the
-- denominator, and NEITHER slot would ever be filled — the matchweek would
-- report two fewer matches played than it had, permanently, and would still
-- settle, so nothing would ever look stuck. That is precisely the failure the
-- denominator rule exists to prevent, arriving through the mechanism meant to
-- honour it.
--
-- A chain is legitimate — a replay can itself be abandoned and replayed — so
-- the walk follows the chain rather than forbidding depth outright, and stops
-- at a bound so a long or corrupt chain cannot spin.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.assert_season_fixture_replay_acyclic()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cursor uuid := new.replay_fixture_id;
  v_steps integer := 0;
begin
  while v_cursor is not null loop
    if v_cursor = new.id then
      raise exception 'A replay chain cannot return to the fixture it started from'
        using errcode = 'check_violation';
    end if;

    v_steps := v_steps + 1;
    if v_steps > 10 then
      raise exception 'A replay chain may not exceed 10 links'
        using errcode = 'check_violation';
    end if;

    -- No matching row leaves v_cursor null and ends the walk, which is what
    -- should happen: this is a BEFORE trigger, so it runs ahead of the foreign
    -- key, and refusing here would report a cycle where the real fault is a
    -- fixture that does not exist.
    select fixture.replay_fixture_id
      into v_cursor
      from public.season_fixtures fixture
     where fixture.id = v_cursor;
  end loop;

  return new;
end;
$$;

revoke all on function predictor_internal.assert_season_fixture_replay_acyclic()
  from public, anon, authenticated;

create trigger assert_season_fixture_replay_acyclic
  before insert or update of replay_fixture_id on public.season_fixtures
  for each row
  when (new.replay_fixture_id is not null)
  execute function predictor_internal.assert_season_fixture_replay_acyclic();

commit;
