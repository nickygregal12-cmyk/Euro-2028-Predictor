-- Contract 87: make the mandatory used-list reset storable.
--
-- ADR 0013 is explicit twice over. §25: "Used-team reset is mandatory. When a
-- player has used every eligible team, their used list resets. Without it a
-- survivor exhausts a twenty-club pool and the competition cannot continue."
-- §87 records "No used-team reset" as a REJECTED alternative, "because long
-- competitions become mathematically impossible once a survivor exhausts the
-- team pool."
--
-- `bonus_lms_selections` cannot store it. The table carries
-- `unique (competition_id, user_id, team_id)` from the contract-63 tournament
-- baseline — one club per entrant per competition, ever — so the pick the rule
-- authorises is the pick the key refuses. Measured on a database carrying every
-- migration and the seed, with a two-club season and a player who had used both:
--
--   rule says:    {"ok": true, "usedListReset": true, "eligibleTeamIds": [both]}
--   storage says: REFUSED (23505) duplicate key value violates unique
--                 constraint "bonus_lms_selections_competition_id_user_id_team_id_key"
--
-- This is not a corner case. A twenty-club league over thirty-eight matchweeks
-- reaches it around matchweek twenty of every season, and it blocks the player
-- RPC as much as any server writer — `save_lms_selection` carries its own
-- reuse check on top of the key, so both have to move.
--
-- The tournament never met it: twenty-four clubs across roughly seven rounds
-- cannot exhaust the pool, which is why a constraint that is wrong for a season
-- has been right for three years.
--
-- ---------------------------------------------------------------------------
-- THE SHAPE: A CYCLE, NOT A DELETION
-- ---------------------------------------------------------------------------
--
-- The reset could have been stored by deleting the used rows, or by dropping
-- the key and enforcing reuse in code alone. Both lose something. Deleting
-- destroys the record of what a player actually picked, which is the history
-- the settlement replay folds over — contract 85 exists precisely because
-- survival must be re-derivable after a correction, and it cannot re-derive
-- from rows that were deleted. Dropping the key moves an authoritative rule out
-- of the database, leaving nothing to catch a writer that computes a used list
-- wrongly.
--
-- So a selection records WHICH CYCLE it belongs to, and uniqueness scopes to
-- the cycle: a club may be used once per cycle, and the reset opens a new one.
-- Nothing is deleted, and the database still refuses a repeat.
--
-- ---------------------------------------------------------------------------
-- WHY THE TOURNAMENT CANNOT NOTICE
-- ---------------------------------------------------------------------------
--
-- `used_cycle` defaults to 0, so every existing row is cycle 0, and the reset
-- below fires only for a `league_season` competition. A tournament entrant
-- therefore never leaves cycle 0, where `unique (competition_id, user_id,
-- team_id, 0)` accepts and refuses exactly what `unique (competition_id,
-- user_id, team_id)` accepted and refused. That equivalence is proven by the
-- apply-time block at the foot of this migration rather than argued.
--
-- Gating the reset on the competition kind is deliberate. Applying ADR 0013's
-- reset to the tournament would be a rule change to a delivered, hosted game
-- with its own authority — a small knockout round of two fixtures is exactly
-- where a tournament player could exhaust the clubs on offer, so the change
-- would be reachable, not theoretical. It is not this contract's to make.
--
-- ---------------------------------------------------------------------------
-- WHAT THE FAST LANE IS TOLD
-- ---------------------------------------------------------------------------
--
-- This migration drops a constraint. `scripts/check-migration-additive.mjs`
-- classified that as neither destructive nor worth mentioning, because its
-- destructive pattern never named `constraint` — so the lane would have carried
-- it in silence. That gap is closed in the same change: a constraint or index
-- drop is now recognised as removing a GUARANTEE rather than a row, still
-- carried by the lane, and always reported so the rollout record names it.

begin;

-- ---------------------------------------------------------------------------
-- The cycle.
-- ---------------------------------------------------------------------------

alter table public.bonus_lms_selections
  add column if not exists used_cycle smallint not null default 0;

alter table public.bonus_lms_selections
  add constraint bonus_lms_selections_used_cycle_non_negative
    check (used_cycle >= 0);

comment on column public.bonus_lms_selections.used_cycle is
  'Which pass through the club pool this pick belongs to. ADR 0013 makes the '
  'used-list reset mandatory; the reset opens a new cycle rather than deleting '
  'the history the settlement replay folds over. Season competitions only — a '
  'tournament entrant never leaves cycle 0.';

-- Re-key club uniqueness to the cycle. At cycle 0 this is the old key.
alter table public.bonus_lms_selections
  drop constraint bonus_lms_selections_competition_id_user_id_team_id_key;

alter table public.bonus_lms_selections
  add constraint bonus_lms_selections_club_once_per_cycle
    unique (competition_id, user_id, team_id, used_cycle);

-- ---------------------------------------------------------------------------
-- Where an entrant currently stands in the pool.
--
-- Derived from the selections themselves rather than stored beside them. A
-- separate counter would be a second truth that can disagree with the rows, and
-- the one thing this table must survive is a correction that re-derives.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.lms_current_used_cycle(
  p_competition_id uuid,
  p_user_id uuid
)
returns smallint
language sql
stable
set search_path = ''
as $$
  select coalesce(max(used_cycle), 0)::smallint
    from public.bonus_lms_selections
   where competition_id = p_competition_id
     and user_id = p_user_id;
$$;

revoke all on function predictor_internal.lms_current_used_cycle(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The clubs an entrant has consumed SINCE THEIR LAST RESET.
--
-- This, not the full history, is what `resolve_lms_eligibility` must be fed.
-- Passing every club an entrant ever picked would re-exhaust the pool the
-- moment the reset fired, and the reset would fire again on the next round, for
-- ever.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.lms_used_team_ids(
  p_competition_id uuid,
  p_user_id uuid
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(team_id::text order by created_at, team_id), '[]'::jsonb)
    from public.bonus_lms_selections
   where competition_id = p_competition_id
     and user_id = p_user_id
     and used_cycle = predictor_internal.lms_current_used_cycle(p_competition_id, p_user_id);
$$;

revoke all on function predictor_internal.lms_used_team_ids(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Has the reset fired for this entrant, in this round?
--
-- True when every club playing once in the round is already in the entrant's
-- current cycle — ADR 0013's condition exactly. Season competitions only.
--
-- A round in which NO club plays once must not reset. Contract 84's
-- `resolve_lms_eligibility` makes the same distinction, and for the same reason
-- — an empty round leaves eligibility empty so the caller fails closed, rather
-- than resetting the pool because nothing was available.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.lms_reset_due(
  p_competition_id uuid,
  p_user_id uuid,
  p_window_id uuid
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_kind text;
  v_playing_once uuid[];
  v_used jsonb;
begin
  select t.kind
    into v_kind
    from public.bonus_competitions c
    join public.tournaments t on t.id = c.tournament_id
   where c.id = p_competition_id;

  -- The tournament keeps contract-63 behaviour. See the header.
  --
  -- STATED PLAINLY: this check is REDUNDANT TODAY, and mutation testing is what
  -- established that rather than a reading of the code. Deleting it leaves the
  -- whole suite passing, including a case that deliberately mislinks a season
  -- fixture to a tournament round.
  --
  -- The reset can never fire for a tournament entrant for a structural reason
  -- instead. `bonus_lms_tournament_team_fkey` keys a selection's club to the
  -- selection's competition, so a tournament entrant's used clubs are always
  -- tournament clubs, while the clubs below always come from `season_fixtures`
  -- and belong to a season. A club row carries exactly one `tournament_id`, so
  -- the two sets cannot intersect, so "every club playing once is already used"
  -- cannot be satisfied. `138_lms_used_cycle.sql` asserts that structural fact
  -- rather than pretending to exercise this branch.
  --
  -- It is kept because it says the intent where the intent is decided, and
  -- because the structural argument depends on a foreign key that a future
  -- contract could relax. It must not be mistaken for the thing doing the work.
  if v_kind is distinct from 'league_season' then
    return false;
  end if;

  select array_agg(club)
    into v_playing_once
    from (
      select club, count(*) as appearances
        from (
          select fixture.home_team_id as club
            from public.season_cup_window_fixtures link
            join public.season_fixtures fixture on fixture.id = link.season_fixture_id
           where link.window_id = p_window_id
          union all
          select fixture.away_team_id
            from public.season_cup_window_fixtures link
            join public.season_fixtures fixture on fixture.id = link.season_fixture_id
           where link.window_id = p_window_id
        ) appearance
       group by club
      having count(*) = 1
    ) playing_once;

  -- `array_agg` over an empty set yields NULL, never a zero-length array, so
  -- this one test covers the empty round. A `cardinality(...) = 0` arm beside
  -- it would read as defensive and be unreachable — checked, and removed rather
  -- than shipped as a branch no test can enter.
  if v_playing_once is null then
    return false;
  end if;

  v_used := predictor_internal.lms_used_team_ids(p_competition_id, p_user_id);

  -- Every club playing once is already used: the pool is exhausted.
  return not exists (
    select 1
      from unnest(v_playing_once) as club
     where not (v_used ? club::text)
  );
end;
$$;

revoke all on function predictor_internal.lms_reset_due(uuid, uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The cycle a new pick belongs to.
--
-- One place decides it, so the RPC below and the auto-assignment writer that
-- follows cannot disagree about which cycle a round's picks landed in.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.lms_cycle_for_pick(
  p_competition_id uuid,
  p_user_id uuid,
  p_window_id uuid
)
returns smallint
language sql
stable
set search_path = ''
as $$
  select (
    predictor_internal.lms_current_used_cycle(p_competition_id, p_user_id)
    + case
        when predictor_internal.lms_reset_due(p_competition_id, p_user_id, p_window_id)
          then 1
        else 0
      end
  )::smallint;
$$;

revoke all on function predictor_internal.lms_cycle_for_pick(uuid, uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The player path, which has its own reuse check on top of the key.
--
-- Redefined here because the constraint change alone does not free it: the
-- existing check refuses reuse across EVERY window regardless of cycle, so a
-- season player would still be told "Each team can only be used once" on the
-- round their reset fires. Everything else about this RPC is preserved
-- character for character — authentication, the published/game check, the
-- entrant and elimination checks, optimistic concurrency and its PT409, and the
-- returned shape. A tournament caller reaches an unchanged function: the cycle
-- is 0 for them, so the reuse check spans exactly the rows it always did.
-- ---------------------------------------------------------------------------

create or replace function public.save_lms_selection(
  p_window_id uuid,
  p_team_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_competition_id uuid;
  v_published boolean;
  v_game text;
  v_outcome text;
  v_row_id uuid;
  v_stored_version integer;
  v_new_version integer;
  v_cycle smallint;
  v_stored_cycle smallint;
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select w.competition_id, c.published, c.game_key
    into v_competition_id, v_published, v_game
    from public.bonus_competition_windows w
    join public.bonus_competitions c on c.id = w.competition_id
    where w.id = p_window_id;

  if v_competition_id is null or not v_published or v_game <> 'last_man_standing' then
    raise exception 'Round not found'
      using errcode = 'no_data_found';
  end if;

  select entrant.outcome
    into v_outcome
    from public.bonus_competition_entrants entrant
    where entrant.competition_id = v_competition_id
      and entrant.user_id = v_uid;

  if v_outcome is null then
    raise exception 'Enter Last Man Standing to make picks'
      using errcode = 'insufficient_privilege';
  end if;

  if v_outcome in ('eliminated') then
    raise exception 'You have been eliminated from this competition'
      using errcode = '55000';
  end if;

  if p_team_id is null then
    raise exception 'A team pick is required'
      using errcode = 'check_violation';
  end if;

  -- The existing row is read BEFORE the reuse check, which is a change of order
  -- from contract 63 and a necessary one. An amendment must be judged against
  -- the cycle its round was actually recorded in, not against a freshly
  -- computed one: a player who amends an early round after their reset has
  -- fired would otherwise be checked against the new cycle while the row stayed
  -- in the old, so the RPC could refuse a club that is free and admit one that
  -- is taken — the latter reaching the unique key as a raw 23505 instead of the
  -- sentence below. The error ORDER is preserved: reuse still reports before
  -- the version conflict.
  select sel.id, sel.version, sel.used_cycle
    into v_row_id, v_stored_version, v_stored_cycle
    from public.bonus_lms_selections sel
    where sel.competition_id = v_competition_id
      and sel.user_id = v_uid
      and sel.window_id = p_window_id
    for update;

  if v_row_id is null then
    v_cycle := predictor_internal.lms_cycle_for_pick(v_competition_id, v_uid, p_window_id);
  else
    v_cycle := v_stored_cycle;
  end if;

  -- Team reuse gets a clear error before the unique constraint would fire.
  -- Scoped to the cycle: a club used before the reset is available again after
  -- it, which is the whole of ADR 0013 §25.
  if exists (
    select 1
    from public.bonus_lms_selections sel
    where sel.competition_id = v_competition_id
      and sel.user_id = v_uid
      and sel.team_id = p_team_id
      and sel.used_cycle = v_cycle
      and sel.window_id <> p_window_id
  ) then
    raise exception 'Each team can only be used once in Last Man Standing'
      using errcode = 'unique_violation';
  end if;

  if v_row_id is null then
    if p_expected_version is not null and p_expected_version <> 0 then
      raise exception 'selection version conflict (expected %, stored none)',
        p_expected_version
        using errcode = 'PT409';
    end if;

    insert into public.bonus_lms_selections (
      competition_id, user_id, window_id, team_id, used_cycle
    ) values (
      v_competition_id, v_uid, p_window_id, p_team_id, v_cycle
    );
    v_new_version := 0;
  else
    if p_expected_version is null
      or p_expected_version is distinct from v_stored_version then
      raise exception 'selection version conflict (expected %, stored %)',
        p_expected_version, v_stored_version
        using errcode = 'PT409';
    end if;

    -- The cycle is not rewritten on an amendment. A player changing their mind
    -- within an open round stays in the cycle the round was opened in;
    -- recomputing it here would let an amendment silently move the pick into a
    -- new cycle and free a club the player has not actually released.
    update public.bonus_lms_selections sel
      set team_id = p_team_id,
          version = v_stored_version + 1,
          updated_at = now()
      where sel.id = v_row_id;
    v_new_version := v_stored_version + 1;
  end if;

  return jsonb_build_object(
    'window_id', p_window_id,
    'team_id', p_team_id,
    'version', v_new_version
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Prove at apply time that cycle 0 is the old key.
--
-- The risk in re-keying is not that the season stops working — that is what the
-- change is for and it is loud when wrong. It is that the TOURNAMENT quietly
-- gains a second chance at a club, because the new key has a column the old one
-- did not and every tournament row shares one value in it. Two picks of the
-- same club at cycle 0 must still collide.
-- ---------------------------------------------------------------------------

do $$
declare
  v_conflicted boolean := false;
begin
  create temporary table lms_cycle_equivalence (
    competition_id uuid,
    user_id uuid,
    team_id uuid,
    used_cycle smallint,
    constraint lms_cycle_equivalence_key
      unique (competition_id, user_id, team_id, used_cycle)
  ) on commit drop;

  insert into lms_cycle_equivalence values
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
     '00000000-0000-4000-8000-000000000003', 0);

  begin
    -- Same entrant, same club, still cycle 0: the tournament's situation.
    insert into lms_cycle_equivalence values
      ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
       '00000000-0000-4000-8000-000000000003', 0);
  exception when unique_violation then
    v_conflicted := true;
  end;

  if not v_conflicted then
    raise exception
      'the re-keyed constraint accepted a repeated club at cycle 0; the tournament rule has been weakened';
  end if;

  -- And the season's situation: the same club in the NEXT cycle is allowed,
  -- which is the whole point. If this raised, the reset would still be
  -- unstorable and the migration would have achieved nothing.
  insert into lms_cycle_equivalence values
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
     '00000000-0000-4000-8000-000000000003', 1);
end;
$$;

commit;
