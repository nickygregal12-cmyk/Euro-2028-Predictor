-- ---------------------------------------------------------------------------
-- Contract 180 — the season prediction card is shared, and holding one is not
-- joining the Match Predictor.
--
-- `PPLAY-002`, and the finding the 12 August 2026 investigation rates critical.
--
-- ---------------------------------------------------------------------------
-- THE STRUCTURAL DEFECT, TRACED RATHER THAN DESCRIBED
-- ---------------------------------------------------------------------------
--
--   1. `game_definitions` gives `predictor_cup` `requires_prediction_entry =
--      false`, so `predictor_internal.enter_competition_game` writes a
--      `bonus_competition_entrants` row and NO `public.entries` row.
--   2. Season Championship scoring resolves, for every member and fixture,
--      `bonus_cup_members.user_id -> entries(user_id, tournament_id) ->
--      season_predictions(entry_id, season_fixture_id)`. No entry, no
--      prediction, and the Championship reads the player as having predicted
--      nothing.
--   3. `public.save_season_prediction` resolves the same entry and calls
--      `predictor_internal.require_season_entry`, which raises "You have not
--      joined the Main Predictor for this season".
--
-- So a Championship membership can be perfectly valid and carry no way to
-- submit the predictions the Championship scores. The private-Championship
-- creation journey states the opposite in as many words: anyone with the
-- invite code may join directly and need not have joined another game first.
--
-- Development fixtures HID this, and that is worth recording: every active
-- Championship member checked happened to hold a season entry already, so the
-- broken state looks healthy on any seeded account. The pgTAP suite therefore
-- starts from a user with no entry and no membership of any kind.
--
-- ---------------------------------------------------------------------------
-- OPTION B, AND WHY NOT OPTION A
-- ---------------------------------------------------------------------------
--
-- The investigation offers two coherent rules. **Option A** makes Match
-- Predictor a prerequisite for the Championship. It is refused here because it
-- contradicts an accepted product rule rather than an accident: onboarding
-- permits `predictor_cup` without `main_predictor`, and the private-Championship
-- journey promises direct entry to invitees. Making the server refuse would turn
-- a delivered promise into an error message.
--
-- **Option B** is implemented: entering a game that USES the shared season
-- prediction card establishes the card, and nothing else. `game_memberships`
-- stays truthful — no Match Predictor row appears — which is the invariant the
-- register, the onboarding tests and ADR 0011's separation all depend on.
--
-- ---------------------------------------------------------------------------
-- THE CARD KEEPS POINTING AT THE CARD-OWNING GAME, AND THAT IS THE WHOLE
-- DESIGN. THE OBVIOUS ALTERNATIVE IS A SILENT SCORING OUTAGE.
-- ---------------------------------------------------------------------------
--
-- The tempting shape is to let the new entry belong to the Championship —
-- `entries.game_competition_id = <the private Cup>` — so that every row names
-- the game the player actually joined. Measured against the committed text,
-- that is a worse defect than the one being fixed:
--
--   * `predictor_internal.process_due_season_matchweek_scores` selects the
--     entries to settle by joining `entries -> bonus_competitions on game.id =
--     entry.game_competition_id` and filtering `lock_scope = 'matchweek' and
--     requires_prediction_entry`. An entry naming the Championship fails that
--     filter, so the player would predict and NEVER BE SCORED — silently, with
--     every function behaving exactly as written.
--   * the same join supplies `definition.buffer_minutes` to
--     `season_matchweek_lock_at`. The Championship's buffer is not the
--     Predictor's, so two players in one matchweek would lock at different
--     instants — from the same fixtures.
--   * contract 170's matchweek action generator and contract 173's settled
--     recap select on exactly that property too, so a Championship entrant
--     would get no card reminder and no recap.
--
-- So `game_competition_id` continues to name the game that OWNS the card. What
-- changes is `game_membership_id`, which becomes **null** for a card held
-- without joining the card-owning game. That is the honest representation:
-- there is no membership, so there is no membership id. Everything that selects
-- work by the entry's game keeps working unchanged, and nothing gains a
-- membership it did not earn.
--
-- The one behaviour that reads `game_membership_id` is the TOURNAMENT automatic
-- submission driver, which joins `membership.id = entry.game_membership_id and
-- status = 'active'`. It is bounded by `tournaments.lock_at`, which a
-- `league_season` does not carry, and this capability is granted for league
-- seasons only — asserted below and in `229_shared_season_prediction_capability.sql`
-- rather than argued.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO, AND ONE CONSEQUENCE WORTH STATING PLAINLY
-- ---------------------------------------------------------------------------
--
-- It writes no membership, changes no scoring value, moves no lock, settles
-- nothing and grants nothing new to a browser role. `save_season_prediction`,
-- `save_season_predictions_batch` and every season scoring function are
-- untouched: they already work the moment the entry exists, which is the point.
--
-- **THE CONSEQUENCE:** `predictor_internal.season_standings` ranks ENTRIES for a
-- season and applies no membership filter, so a Championship entrant who
-- predicts appears in the season's cumulative points table. That is ADR 0012's
-- table — the season's, ranked on the card every entrant plays — and it is not
-- the Match Predictor membership list, which stays `game_memberships` and stays
-- empty for them. Excluding them would require a second standings authority
-- filtered differently from the banked one, which is the shape this repository
-- refuses. It is recorded here, asserted in pgTAP, and flagged in the register
-- as a product consequence rather than hidden inside a scoring path.
-- ---------------------------------------------------------------------------

begin;

-- ===========================================================================
-- 1. The property, declared as data.
-- ===========================================================================
--
-- Which games use the shared season prediction card is a FACT ABOUT EACH GAME,
-- and it belongs beside `requires_prediction_entry` in `game_definitions` for
-- the same reason that one does: so that every selection can be made by
-- property and no function has to name a game. `requires_prediction_entry`
-- keeps its exact meaning — this game OWNS the card — and the new column says
-- this game READS it.

alter table public.game_definitions
  add column if not exists uses_season_prediction_card boolean not null default false;

comment on column public.game_definitions.uses_season_prediction_card is
  'Contract 180. True when this game''s scoring reads public.season_predictions '
  'through the shared season entry. requires_prediction_entry says the game '
  'OWNS the card; this says it USES one. Owning implies using, which is a '
  'constraint rather than a convention.';

-- Owning the card implies using it. Stated so the pair cannot drift into a
-- combination that means nothing.
update public.game_definitions
   set uses_season_prediction_card = true
 where requires_prediction_entry;

-- The season Predictor Championship: ADR 0014 scores a Championship tie from
-- the two entrants' season predictions, through
-- `predictor_internal.cup_season_fixture_points`. That is measured in the
-- committed text rather than asserted from the name.
update public.game_definitions
   set uses_season_prediction_card = true
 where game_key = 'predictor_cup';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'game_definitions_card_use_implied'
  ) then
    alter table public.game_definitions
      add constraint game_definitions_card_use_implied
      check (not requires_prediction_entry or uses_season_prediction_card);
  end if;
end;
$$;

-- ===========================================================================
-- 2. The entry may exist without a membership of the game that owns the card.
-- ===========================================================================
--
-- Redefined from its committed text in
-- `20260803070000_c1b_game_catalogue_memberships.sql` with ONE branch added and
-- nothing removed. Verified by diff in
-- `tests/database-parity/sharedPredictionCapabilityParity.test.ts`, not by
-- reading: this trigger also holds the card-owner resolution, the
-- wrong-game refusal and the inactive-membership refusal, and none of them may
-- move.
--
-- THE NEW BRANCH IS DELIBERATELY NARROW. Fabricating a Match Predictor
-- membership stays the behaviour for a caller who holds no card-using
-- membership at all — that is the existing tournament path, where an entry
-- inserted directly through the `own entries insert` policy is how a player
-- creates one, and changing it would be a second, unrelated behaviour change
-- hidden in this contract. Only a caller who ALREADY holds an active membership
-- in a card-using game that does not own the card gets the null-membership
-- entry. That distinction is derivable from stored rows, needs no session flag
-- and cannot be spoofed by a client.

create or replace function predictor_internal.prepare_entry_game_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id uuid;
  v_membership_id uuid;
  v_status text;
  -- >>> contract 180
  v_holds_card_using_membership boolean;
  -- <<< contract 180
begin
  v_game_id := new.game_competition_id;

  if v_game_id is null then
    select availability.id
      into v_game_id
      from public.bonus_competitions availability
      join public.tournaments season on season.id = availability.tournament_id
      where availability.tournament_id = new.tournament_id
        and availability.game_key = case
          when season.kind = 'league_season' then 'main_predictor'
          else 'original_predictor'
        end;
  end if;

  if not exists (
    select 1
    from public.bonus_competitions availability
    join public.game_definitions definition on definition.game_key = availability.game_key
    where availability.id = v_game_id
      and availability.tournament_id = new.tournament_id
      and definition.requires_prediction_entry
  ) then
    raise exception 'Entry must belong to the season Main or Original Predictor'
      using errcode = 'check_violation';
  end if;

  select membership.id, membership.status
    into v_membership_id, v_status
    from public.game_memberships membership
    where membership.game_competition_id = v_game_id
      and membership.user_id = new.user_id
    for update;

  if v_membership_id is null then
    -- >>> contract 180
    -- Contract 180. Does this player already hold an ACTIVE membership of some
    -- other game in this season that reads the shared card? If so the card is
    -- theirs by that game's rules, and manufacturing a Match Predictor
    -- membership for them would be the exact falsehood `PPLAY-002` forbids.
    select exists (
      select 1
      from public.game_memberships membership
      join public.bonus_competitions availability
        on availability.id = membership.game_competition_id
      join public.game_definitions definition
        on definition.game_key = availability.game_key
      join public.tournaments season on season.id = availability.tournament_id
      where membership.user_id = new.user_id
        and membership.status = 'active'
        and availability.tournament_id = new.tournament_id
        and availability.id <> v_game_id
        and definition.uses_season_prediction_card
        and not definition.requires_prediction_entry
        -- League seasons only. The tournament path keeps its single
        -- `tournaments.lock_at` and its automatic-submission driver, which
        -- selects on an ACTIVE membership through `entry.game_membership_id`;
        -- a null there would silently drop the entry from it.
        and season.kind = 'league_season'
    ) into v_holds_card_using_membership;

    if v_holds_card_using_membership then
      new.game_competition_id := v_game_id;
      new.game_membership_id := null;
      return new;
    end if;
    -- <<< contract 180

    insert into public.game_memberships (
      tournament_id,
      game_competition_id,
      user_id,
      status,
      active_since
    ) values (
      new.tournament_id,
      v_game_id,
      new.user_id,
      'active',
      now()
    )
    returning id, status into v_membership_id, v_status;
  end if;

  if v_status <> 'active' then
    raise exception 'Join or rejoin the game before creating an entry'
      using errcode = 'insufficient_privilege';
  end if;

  new.game_competition_id := v_game_id;
  new.game_membership_id := v_membership_id;
  return new;
end;
$$;

revoke all on function predictor_internal.prepare_entry_game_membership()
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 3. Entering a card-using game establishes the card.
-- ===========================================================================
--
-- Redefined from its committed text in `20260810190000_private_season_lms.sql`
-- with ONE block added at the end of the participation write and nothing else
-- moved: the authentication check, the availability, completion and
-- registration-window refusals, the disqualification refusal, contract 126's
-- rejoin rule and the membership write are all character-identical, and the
-- parity test asserts that by diff.

create or replace function predictor_internal.enter_competition_game(
  p_game_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $enter$
declare
  v_uid uuid := (select auth.uid());
  v_availability public.bonus_competitions%rowtype;
  v_definition public.game_definitions%rowtype;
  v_membership public.game_memberships%rowtype;
  -- >>> contract 180
  v_card_competition_id uuid;
  v_season_kind text;
  -- <<< contract 180
begin
  if v_uid is null then
    raise exception 'Authentication is required'
      using errcode = 'insufficient_privilege';
  end if;

  select availability.*
    into v_availability
    from public.bonus_competitions availability
    where availability.id = p_game_competition_id
    for update;

  if not found or v_availability.availability_status <> 'active' then
    raise exception 'Game not found'
      using errcode = 'no_data_found';
  end if;

  select * into strict v_definition
    from public.game_definitions
    where game_key = v_availability.game_key;

  if v_availability.completed_at is not null then
    raise exception 'This game has finished'
      using errcode = '55000';
  end if;

  if v_availability.registration_opens_at is null
     or now() < v_availability.registration_opens_at then
    raise exception 'Registration has not opened'
      using errcode = '55000';
  end if;

  if v_availability.registration_closes_at is not null
     and now() >= v_availability.registration_closes_at then
    raise exception 'Registration has closed'
      using errcode = '55000';
  end if;

  select * into v_membership
    from public.game_memberships membership
    where membership.game_competition_id = p_game_competition_id
      and membership.user_id = v_uid
    for update;

  if found then
    if v_membership.status = 'active' then
      raise exception 'You have already entered this game'
        using errcode = 'unique_violation';
    end if;

    if v_membership.status = 'disqualified' then
      raise exception 'A disqualified game entry cannot be rejoined'
        using errcode = '55000';
    end if;

    -- Contract 126. `allow_rejoin` is the game's capability, and it bites only
    -- once the competition is RUNNING. ADR 0020's word is deliberate: "leaving
    -- an LMS competition never permits rejoining that same RUNNING
    -- competition, consistent with the rolling-entry rejection". That
    -- rejection's own reason is depletion — "a player joining at round eight
    -- arrives with all twenty clubs while survivors have burned eight" — and
    -- before the first round locks nobody has burned anything.
    if not v_definition.allow_rejoin
       and predictor_internal.competition_is_running(v_availability.id)
    then
      raise exception 'This game cannot be rejoined once it has started'
        using errcode = '55000';
    end if;

    update public.game_memberships membership
      set status = 'active',
          active_since = now(),
          left_at = null,
          disqualified_at = null,
          rejoin_count = membership.rejoin_count + 1,
          updated_at = now()
      where membership.id = v_membership.id
      returning * into v_membership;
  else
    insert into public.game_memberships (
      tournament_id,
      game_competition_id,
      user_id,
      status,
      active_since
    ) values (
      v_availability.tournament_id,
      v_availability.id,
      v_uid,
      'active',
      now()
    )
    returning * into v_membership;
  end if;

  if v_definition.requires_prediction_entry then
    insert into public.entries (
      user_id,
      tournament_id,
      game_competition_id,
      game_membership_id
    ) values (
      v_uid,
      v_availability.tournament_id,
      v_availability.id,
      v_membership.id
    )
    on conflict (user_id, tournament_id) do nothing;

    -- >>> contract 180
    -- Contract 180. A player who reached the card through the Championship and
    -- has now joined the game that OWNS it holds a real membership, so the
    -- entry adopts it. Without this the `on conflict do nothing` above would
    -- leave the card permanently orphaned from a membership that exists —
    -- true, but needlessly untidy, and it would make the null mean two
    -- different things.
    update public.entries entry
       set game_membership_id = v_membership.id
     where entry.user_id = v_uid
       and entry.tournament_id = v_availability.tournament_id
       and entry.game_competition_id = v_availability.id
       and entry.game_membership_id is null;
    -- <<< contract 180
  else
    insert into public.bonus_competition_entrants (
      competition_id,
      user_id,
      game_membership_id
    ) values (
      v_availability.id,
      v_uid,
      v_membership.id
    )
    on conflict (competition_id, user_id) do update
      set game_membership_id = excluded.game_membership_id,
          updated_at = now();

    -- >>> contract 180
    -- Contract 180 / `PPLAY-002`. A game that READS the shared card but does
    -- not own it establishes the card, and nothing else. Selected by PROPERTY,
    -- so no game is named here and a future card-using game inherits the
    -- behaviour by declaring the column.
    if v_definition.uses_season_prediction_card then
      select season.kind into v_season_kind
        from public.tournaments season
       where season.id = v_availability.tournament_id;

      if v_season_kind = 'league_season' then
        select owner.id into v_card_competition_id
          from public.bonus_competitions owner
          join public.game_definitions owner_definition
            on owner_definition.game_key = owner.game_key
         where owner.tournament_id = v_availability.tournament_id
           and owner_definition.requires_prediction_entry
         order by owner.created_at, owner.id
         limit 1;

        if v_card_competition_id is not null then
          -- `do nothing` on conflict: a player who already holds the card keeps
          -- exactly the card they have, with whatever membership it carries.
          -- This never converts a membership-backed entry into an orphan.
          insert into public.entries (
            user_id,
            tournament_id,
            game_competition_id
          ) values (
            v_uid,
            v_availability.tournament_id,
            v_card_competition_id
          )
          on conflict (user_id, tournament_id) do nothing;
        end if;
      end if;
    end if;
    -- <<< contract 180
  end if;

  return jsonb_build_object(
    'game_competition_id', v_availability.id,
    'game_key', v_availability.game_key,
    'membership_id', v_membership.id,
    'status', v_membership.status,
    'joined_at', v_membership.joined_at,
    'active_since', v_membership.active_since,
    'rejoin_count', v_membership.rejoin_count
  );
end;
$enter$;

revoke all on function predictor_internal.enter_competition_game(uuid)
  from public, anon, authenticated, service_role;

comment on function predictor_internal.enter_competition_game(uuid) is
  'Contract 180. The membership authority. Entering a game that USES the shared '
  'season prediction card without OWNING it establishes the card and writes no '
  'membership of the owning game, which is PPLAY-002''s rule: Championship '
  'membership is not Match Predictor membership.';

-- ===========================================================================
-- 4. Prove what cannot be left to a test file.
-- ===========================================================================

do $$
declare
  v_cup boolean;
  v_main boolean;
begin
  select uses_season_prediction_card into v_cup
    from public.game_definitions where game_key = 'predictor_cup';
  select uses_season_prediction_card into v_main
    from public.game_definitions where game_key = 'main_predictor';

  if not coalesce(v_cup, false) or not coalesce(v_main, false) then
    raise exception 'Both the Championship and the Predictor must read the shared card';
  end if;

  if exists (
    select 1 from public.game_definitions
     where game_key = 'last_man_standing' and uses_season_prediction_card
  ) then
    raise exception
      'Last Man Standing picks a club and reads no prediction card; marking it '
      'as a card user would hand a season entry to every LMS entrant';
  end if;

  -- The membership authority must not have acquired a way to write a
  -- membership of the card-owning game on behalf of a Championship entrant.
  -- Asserted against the INSTALLED text, because that is the claim that
  -- matters: the entry insert in the card-using branch names three columns and
  -- `game_membership_id` is not one of them.
  if pg_catalog.pg_get_functiondef(
       'predictor_internal.enter_competition_game(uuid)'::regprocedure
     ) !~ 'uses_season_prediction_card' then
    raise exception 'The card-using branch must select by property, not by game name';
  end if;
end;
$$;

commit;
