-- ===========================================================================
-- Contract 207 — contract 193 states the caller's outcome, and means
--                "knockout" when it says so
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- A NOTE ON THIS NUMBER, BECAUSE ANOTHER BRANCH ALSO WANTS IT
-- ---------------------------------------------------------------------------
--
-- A contract number here is the migration's POSITION IN THE CHAIN, not a
-- reservation: `config/deployment-contract.json` asserts
-- `contractVersion === requiredMigrationCount === the file count`. So the
-- number a migration holds is decided by what else is in the chain beside it.
--
-- Against `main` at `7b8339c` this file is the 206th migration and the one
-- beside it is the 207th, which is what they are called throughout.
--
-- **PR #920 is open and its own records call its migration contract 206.** Its
-- timestamp (`20260819110000`) sorts BEFORE both of these, so if it lands first
-- these two become 207 and 208 and the two numbers in this pair of files must
-- be swept forward. That is a mechanical rename of a stated number, not a
-- change of behaviour, and it is recorded here rather than discovered by
-- whichever branch merges second.
--
-- The pgTAP side of the same coordination is already settled: #920's suite is
-- `252_same_season_player_profile_visibility.sql` on its branch head — its PR
-- BODY still describes an earlier 251, which was corrected and not rewritten —
-- so this contract's suites took 253 and 254 and the two branches do not
-- collide. `tests/scripts/pgTapSuiteNumbering.test.ts` is what would have
-- caught it, and a new collision is exactly what that guard is for.
--
-- Two corrections to `get_season_cup_bracket`, both of which the vNext
-- Championship recorded as owed rather than worked around permanently
-- (`docs/product/vnext-championship.md` §6 and §7).
--
-- ---------------------------------------------------------------------------
-- 1. THE ELIMINATION GAP
-- ---------------------------------------------------------------------------
--
-- `champion` was present and `eliminated` was returned by NO season
-- Championship read a surface can call — not 193, not 133, not 167, not 120.
-- The authoritative fact is `bonus_competition_entrants.outcome`, constrained
-- since the games platform was founded to
--
--     outcome in ('active', 'qualified', 'survived', 'eliminated', 'champion')
--
-- Two TOURNAMENT-scoped reads expose it (`get_bonus_games`, `get_my_cup`) and
-- neither is usable from a season surface: `get_my_cup` selects into a single
-- record with no limit and raises for a season running several Championship
-- instances, which is exactly the case a season surface exists for.
--
-- So a page could say who WON and could not say who was OUT. The available
-- inferences — lost your only tie, hold no later fixture, hold no seed — are
-- each conclusive-looking and each WRONG whenever a competition has not
-- finished eliminating, and each would sit exactly where a real verdict goes.
-- The vNext surface therefore stated nothing, correctly, and recorded the
-- silence as a debt rather than as completeness.
--
-- This closes it in the smallest way available: the entrancy gate already
-- looked the row up, so it now READS the column instead of testing for
-- existence, and the caller's own value is emitted verbatim. One column,
-- already joined, already the vocabulary the surface is modelled on.
--
-- IT IS THE CALLER'S OWN AND NOBODY ELSE'S. `bracket[]` names opponents; a
-- per-seat outcome would turn a draw sheet into a disclosure of every
-- entrant's standing, which is the same boundary the Penalty Number keeps.
--
-- ---------------------------------------------------------------------------
-- 2. `stage <> 'group'` IS NOT "KNOCKOUT", AND HAS NOT BEEN SINCE CONTRACT 102
-- ---------------------------------------------------------------------------
--
-- `bonus_cup_fixtures.stage` was widened to `('group','split','playoff',
-- 'knockout')` by contract 102, and that migration's own commentary says the
-- broad form must not be allowed to "let a split fixture enter the knockout
-- settler merely because old code used `stage <> 'group'` as shorthand for
-- knockout".
--
-- Contract 193 uses the broad form in four places. Contracts 194 and 195 use
-- `stage in ('playoff','knockout')`, and 194 ASSERTS AGAINST the broad form
-- reappearing. Contract 195's own SQL states the consequence:
--
--     `stage <> 'group'` would sweep in a `split` fixture, which is a
--     group-phase table row with no Penalty Number.
--
-- A split fixture never settles, so `my_tie`'s `winner_user_id is null` filter
-- does not exclude it. A `single_group` Championship that reached its split was
-- therefore offered a LEAGUE FIXTURE AS A KNOCKOUT TIE, with a null
-- `round_size` and `bracket_slot`, and a Penalty Number lane for a fixture that
-- has none — and `qualification.drawn` reported `true` with no bracket in
-- existence.
--
-- The vNext decoder filters to `playoff | knockout` itself and drops the
-- Penalty Number when the tie it belonged to was dropped. That is a
-- presentation workaround for a read defect, and a workaround is not an
-- authority: the next consumer of contract 193 would not have it. Contract 205
-- deliberately left this alone because its own job was to stop an exception and
-- folding in a second correction would have made both harder to revert. This
-- migration is where it belongs.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT CHANGE
-- ---------------------------------------------------------------------------
--
-- The signature, the volatility, the grants, the security context, the
-- entrancy boundary (a non-entrant still receives exactly
-- `{competition_id, entered:false}`, and still cannot use the id as an
-- existence oracle), contract 205's initial-phase seed pin, the caller-only
-- Penalty Number scoping, the neutral kickoff authority, the absence of the
-- opponent's Penalty Number, and the absence of bracket arithmetic. No key is
-- removed and no key changes meaning; one key is ADDED.
-- ---------------------------------------------------------------------------

begin;

create or replace function public.get_season_cup_bracket(
  p_competition_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $bracket$
declare
  v_uid uuid := (select auth.uid());
  v_comp record;
  v_launch record;
  v_is_entrant boolean;
  v_outcome text;
  v_brackets boolean;
  v_live record;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_competition_id is null then
    raise exception 'Competition is required' using errcode = '22023';
  end if;

  -- Contract 133's resolution, unchanged: a season Championship only.
  select competition.*
    into v_comp
  from public.bonus_competitions competition
  join public.tournaments tournament on tournament.id = competition.tournament_id
  where competition.id = p_competition_id
    and competition.game_key = 'predictor_cup'
    and tournament.kind = 'league_season';

  if not found then
    return jsonb_build_object('competition_id', p_competition_id, 'entered', false);
  end if;

  -- CONTRACT 207. The entrancy gate now READS the row it was already testing
  -- for, because the answer to "am I still in this?" is stored on it.
  --
  -- `bonus_competition_entrants.outcome` is the canonical settlement
  -- vocabulary — `active | qualified | survived | eliminated | champion`, by
  -- check constraint since the games platform was founded — and it is the only
  -- authority for elimination anywhere in the schema. Contract 196 already
  -- treats the same column as the fact an inbox item may be invalidated
  -- against, so this exposes an existing truth to the read that needs it
  -- rather than adding a second opinion.
  --
  -- It is the CALLER'S OWN outcome and nobody else's. The bracket already
  -- names opponents, and a per-seat outcome would turn a draw sheet into a
  -- disclosure of every entrant's standing.
  select entrant.outcome
    into v_outcome
    from public.bonus_competition_entrants entrant
   where entrant.competition_id = p_competition_id
     and entrant.user_id = v_uid;

  v_is_entrant := v_outcome is not null;

  -- Deliberately the same response as an unknown id. Contract 133's reasoning,
  -- and its exact shape, so the two reads cannot disagree about what a
  -- non-member is told.
  if not v_is_entrant then
    return jsonb_build_object('competition_id', p_competition_id, 'entered', false);
  end if;

  select * into v_launch
    from public.bonus_cup_launches launch
   where launch.competition_id = p_competition_id;

  -- Contract 186's stored format decides whether a knockout is even coming.
  -- Absent means this competition predates the record or was never launched
  -- through the season launchers; `null` is reported rather than guessed.
  v_brackets := v_launch.format_kind = 'groups';

  -- The caller's own live tie: unsettled, not a group fixture, earliest first.
  select fixture.id as fixture_id,
         fixture.window_id,
         fixture.stage,
         fixture.round_size,
         fixture.bracket_slot,
         window_row.sequence as window_sequence,
         window_row.label as window_label,
         (fixture.home_user_id = v_uid) as is_home,
         case when fixture.home_user_id = v_uid
              then fixture.away_user_id else fixture.home_user_id end as opponent_id
    into v_live
    from public.bonus_cup_fixtures fixture
    join public.bonus_competition_windows window_row on window_row.id = fixture.window_id
   where fixture.competition_id = p_competition_id
     and fixture.stage in ('playoff', 'knockout')
     and fixture.winner_user_id is null
     and v_uid in (fixture.home_user_id, fixture.away_user_id)
   order by window_row.sequence
   limit 1;

  return jsonb_build_object(
    'competition_id', p_competition_id,
    'entered', true,
    -- CONTRACT 207. The caller's own canonical outcome, verbatim. Never
    -- derived: not from a lost tie, not from a missing seed, not from bracket
    -- position, and not from the absence of a later fixture. A competition
    -- that has not finished eliminating has entrants who are still `active`,
    -- and every one of those inferences reports them as out.
    'your_outcome', v_outcome,
    'server_now', now(),
    'visibility_kind', v_comp.visibility_kind,
    'availability_status', v_comp.availability_status,

    -- Which shape this competition is, from the record the launcher wrote.
    'format', jsonb_build_object(
      'kind', v_launch.format_kind,
      -- Stated rather than left to be inferred from an empty bracket: a
      -- `single_group` Championship finishes with contract 124's split and
      -- produces no knockout at all.
      'produces_knockout', v_brackets,
      'group_stage_last_sequence', v_launch.group_stage_last_sequence),

    'qualification', jsonb_build_object(
      -- Drawn, not merely due: the bracket exists once contract 187's driver
      -- has written knockout fixtures.
      'drawn', exists (
        select 1 from public.bonus_cup_fixtures fixture
         where fixture.competition_id = p_competition_id
           and fixture.stage in ('playoff', 'knockout')),
      'qualifiers', (
        select count(*)::integer from public.bonus_cup_members member
         where member.competition_id = p_competition_id
           and member.seed is not null),
      -- CONTRACT 205. Pinned to the INITIAL membership, and it must be.
      --
      -- Contract 102 keyed this table `(competition_id, user_id, phase_kind)`
      -- precisely so one entrant can hold BOTH an `initial` and a `split` row,
      -- and contract 124's split transition inserts the second without
      -- removing the first. This is a SCALAR subquery, so from the moment a
      -- competition splits it saw two rows and raised
      -- `more than one row returned by a subquery used as an expression` —
      -- taking the whole read down, not just this field.
      --
      -- `initial` is the correct phase rather than a convenient one:
      -- `bonus_cup_members_split_metadata_empty` requires a split row to carry
      -- `seed` (and `group_position`, and `qualified_as`) as NULL, so seeding
      -- is a fact about the initial phase by construction.
      'your_seed', (
        select member.seed from public.bonus_cup_members member
         where member.competition_id = p_competition_id
           and member.user_id = v_uid
           and member.phase_kind = 'initial'),
      'you_qualified', exists (
        select 1 from public.bonus_cup_members member
         where member.competition_id = p_competition_id
           and member.user_id = v_uid
           and member.seed is not null)),

    -- The tie in front of the caller, if there is one.
    'my_tie', case when v_live.fixture_id is null then null else jsonb_build_object(
      'fixture_id', v_live.fixture_id,
      'stage', v_live.stage,
      'round_size', v_live.round_size,
      'bracket_slot', v_live.bracket_slot,
      'window_sequence', v_live.window_sequence,
      'window_label', v_live.window_label,
      'is_home', v_live.is_home,
      'opponent', (
        select jsonb_build_object(
          'user_id', v_live.opponent_id,
          'display_name', coalesce(profile.display_name, 'Player'))
        from public.profiles profile where profile.id = v_live.opponent_id),
      'locks_at', predictor_internal.cup_window_first_kickoff(v_live.window_id))
    end,

    -- The Penalty Number, for the caller and nobody else. See the header: the
    -- opponent's value and the fact of their submission are both absent, which
    -- is what `get_my_cup` does and is the safe direction.
    'penalty_number', case when v_live.fixture_id is null then null else (
      select jsonb_build_object(
        'window_id', v_live.window_id,
        'window_label', v_live.window_label,
        -- §8.3: the home side (better seed) holds the ODD lane.
        'lane', case when v_live.is_home then 'odd' else 'even' end,
        'submitted', pn.value is not null,
        'value', pn.value,
        'version', pn.version,
        'locks_at', first_kickoff.at,
        'locked', first_kickoff.at is not null and now() >= first_kickoff.at,
        -- A round whose real fixtures are not scheduled cannot take a
        -- submission, and `submit_cup_penalty_number` refuses one. Said here
        -- so a surface can explain the refusal instead of discovering it.
        'open', first_kickoff.at is not null and now() < first_kickoff.at)
      from (select 1) placeholder
      left join public.bonus_cup_penalty_numbers pn
        on pn.window_id = v_live.window_id and pn.user_id = v_uid
      left join lateral (
        select predictor_internal.cup_window_first_kickoff(v_live.window_id) as at
      ) first_kickoff on true)
    end,

    -- Every tie the caller has played or is playing, with its outcome. This is
    -- the progression half: what happened, decided how, and against whom.
    'my_ties', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'fixture_id', fixture.id,
          'stage', fixture.stage,
          'round_size', fixture.round_size,
          'bracket_slot', fixture.bracket_slot,
          'window_sequence', window_row.sequence,
          'window_label', window_row.label,
          'is_home', fixture.home_user_id = v_uid,
          'opponent', jsonb_build_object(
            'user_id', opponent.user_id,
            'display_name', coalesce(opponent_profile.display_name, 'Player')),
          'settled', fixture.winner_user_id is not null,
          'winner_user_id', fixture.winner_user_id,
          'you_won', fixture.winner_user_id is not null
                     and fixture.winner_user_id = v_uid,
          -- 'points', 'extra_time', 'penalty_number', 'walkover' or
          -- 'admin_walkover' — the settlement authority's own vocabulary, read
          -- rather than re-derived from the scores.
          'decided_by', fixture.decided_by,
          'settled_at', fixture.settled_at)
        order by window_row.sequence)
      from public.bonus_cup_fixtures fixture
      join public.bonus_competition_windows window_row on window_row.id = fixture.window_id
      cross join lateral (
        select case when fixture.home_user_id = v_uid
          then fixture.away_user_id else fixture.home_user_id end as user_id
      ) opponent
      left join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
      where fixture.competition_id = p_competition_id
        and fixture.stage in ('playoff', 'knockout')
        and v_uid in (fixture.home_user_id, fixture.away_user_id)), '[]'::jsonb),

    -- The whole bracket, in `get_my_cup`'s shape and on its boundary: entrants
    -- only, which the early return above has already established.
    'bracket', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'fixture_id', fixture.id,
          'stage', fixture.stage,
          'round_size', fixture.round_size,
          'bracket_slot', fixture.bracket_slot,
          'window_sequence', window_row.sequence,
          'window_label', window_row.label,
          'home', jsonb_build_object(
            'user_id', fixture.home_user_id,
            'display_name', coalesce(home_profile.display_name, 'Player')),
          'away', jsonb_build_object(
            'user_id', fixture.away_user_id,
            'display_name', coalesce(away_profile.display_name, 'Player')),
          'is_yours', v_uid in (fixture.home_user_id, fixture.away_user_id),
          'winner_user_id', fixture.winner_user_id,
          'decided_by', fixture.decided_by)
        order by window_row.sequence, fixture.bracket_slot)
      from public.bonus_cup_fixtures fixture
      join public.bonus_competition_windows window_row on window_row.id = fixture.window_id
      left join public.profiles home_profile on home_profile.id = fixture.home_user_id
      left join public.profiles away_profile on away_profile.id = fixture.away_user_id
      where fixture.competition_id = p_competition_id
        and fixture.stage in ('playoff', 'knockout')), '[]'::jsonb),

    'champion', (
      select jsonb_build_object(
        'user_id', fixture.winner_user_id,
        'display_name', coalesce(profile.display_name, 'Player'))
      from public.bonus_cup_fixtures fixture
      left join public.profiles profile on profile.id = fixture.winner_user_id
      where fixture.competition_id = p_competition_id
        and fixture.stage = 'knockout'
        and fixture.round_size = 2
        and fixture.winner_user_id is not null));
end;
$bracket$;

comment on function public.get_season_cup_bracket(uuid) is
  'Contract 193 / CUP-003, amended by contracts 205 and 207. One season '
  'Championship entrant''s knockout tie, Penalty Number state, progression, '
  'the bracket around them and their own canonical outcome. Reads the rows the '
  'canonical drivers wrote and recomputes no seat, round count or pairing. '
  'your_outcome is bonus_competition_entrants.outcome verbatim and is the '
  'caller''s own only, so elimination is stated by the settlement authority '
  'rather than inferred from a lost tie or an absent fixture. Knockout means '
  'stage in (playoff, knockout): a split fixture is a group-phase table row '
  'and is not a tie. The opponent''s Penalty Number is never returned, '
  'matching get_my_cup exactly, and neither is whether they have submitted one.';

revoke all on function public.get_season_cup_bracket(uuid) from public, anon;
grant execute on function public.get_season_cup_bracket(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_read text := pg_get_functiondef(
    'public.get_season_cup_bracket(uuid)'::regprocedure);
begin
  -- CONTRACT 205'S OWN ASSERTION, and the reason this file exists. The seed
  -- lookup must name a phase. Without one it is a scalar subquery over a table
  -- keyed by `(competition_id, user_id, phase_kind)`, and it raises the moment
  -- a competition splits — so this guard is what stops the defect returning
  -- through a later restated body, exactly as contract 194 guards the stage
  -- predicate it depends on.
  if v_read !~ 'member\.phase_kind = ''initial''' then
    raise exception 'The seed lookup must be pinned to the initial membership';
  end if;

  -- THE ASSERTION THIS BLOCK EXISTS FOR. The caller's own Penalty Number is
  -- read with `pn.user_id = v_uid`, and no other predicate may appear against
  -- that table — an opponent's value must be unreachable by construction
  -- rather than by an `if` somebody can later relax.
  if v_read !~ 'pn.user_id = v_uid' then
    raise exception 'The Penalty Number must be read for the caller only';
  end if;

  if (length(v_read) - length(replace(v_read, 'bonus_cup_penalty_numbers', '')))
     / length('bonus_cup_penalty_numbers') <> 1 then
    raise exception 'The Penalty Number table may be reached exactly once';
  end if;

  -- The lock comes from the competition-neutral authority contract 98 built,
  -- never from the tournament relations it replaced.
  if v_read !~ 'cup_window_first_kickoff' then
    raise exception 'The lock must come from the neutral window-fact authority';
  end if;

  if v_read ~ 'bonus_window_fixtures' or v_read ~ 'join public.matches' then
    raise exception 'A season read must not reach a tournament-only relation';
  end if;

  -- No bracket arithmetic. Seats, rounds and pairings are read, never derived.
  if v_read ~ 'cup_bracket_order|log\(|power\(|ceil\(' then
    raise exception 'The bracket must be read rather than recomputed';
  end if;

  -- Contract 133's boundary, and the same answer for a non-entrant as for an
  -- unknown id.
  if v_read !~ 'bonus_competition_entrants' then
    raise exception 'The read must be gated on entry';
  end if;

  if v_read ~ 'p_now|p_as_of' then
    raise exception 'A reveal boundary must not accept a client-supplied time';
  end if;

  -- ---------------------------------------------------------------------
  -- CONTRACT 207'S OWN ASSERTIONS
  -- ---------------------------------------------------------------------

  -- The outcome is CARRIED, not computed. A `case` over a winner, a seed or a
  -- fixture count producing this key would be the exact inference the gap was
  -- recorded rather than closed by.
  if v_read !~ 'select entrant\.outcome' then
    raise exception 'The caller''s outcome must be read from the entrant row';
  end if;

  if v_read !~ '''your_outcome'', v_outcome' then
    raise exception 'The outcome must be emitted verbatim rather than reshaped';
  end if;

  -- It is the CALLER'S. The entrant table may be reached exactly once, and
  -- that one reach is scoped to `v_uid` — the same construction the Penalty
  -- Number uses, and for the same reason: a per-seat outcome would disclose
  -- every entrant's standing through a draw sheet.
  -- The qualified FROM form rather than the bare name: `pg_get_functiondef`
  -- returns the body's own comments, and one of them names the column this
  -- contract exposes. Counting the bare name would count the explanation as an
  -- implementation, which is the failure mode a sibling contract hit and fixed
  -- the same way.
  if (length(v_read) - length(replace(v_read, 'from public.bonus_competition_entrants', '')))
     / length('from public.bonus_competition_entrants') <> 1 then
    raise exception 'The entrant table may be reached exactly once';
  end if;

  if v_read !~ 'entrant\.user_id = v_uid' then
    raise exception 'The outcome must be read for the caller only';
  end if;

  -- KNOCKOUT MEANS KNOCKOUT. `stage <> 'group'` has included `split` since
  -- contract 102 widened the domain, and contracts 194 and 195 already use the
  -- narrow form — 194 asserting against the broad one. A `split` fixture never
  -- settles, so `winner_user_id is null` does not exclude it and it would be
  -- offered as a live tie with no round size, no bracket slot and no Penalty
  -- Number lane.
  if v_read ~ 'stage <> ''group''' then
    raise exception 'A knockout predicate must name playoff and knockout, not everything that is not a group';
  end if;

  if (length(v_read) - length(replace(v_read, 'stage in (''playoff'', ''knockout'')', '')))
     / length('stage in (''playoff'', ''knockout'')') <> 4 then
    raise exception 'All four knockout predicates must name the knockout stages';
  end if;

  -- It writes nothing, asserted from the CATALOGUE rather than by searching the
  -- text for write keywords. Two reasons, and the second one is why this was
  -- rewritten: `stable` is enforced by PostgreSQL itself — a stable function
  -- that attempted an INSERT would fail at runtime — so the catalogue check is
  -- the stronger guarantee; and a guard that quotes `delete from` puts that
  -- literal into the migration, where `check-migration-additive.mjs` reads it
  -- and refuses the file as destructive. It did exactly that, which would have
  -- routed an additive read to the guarded destructive rollout lane.
  if (select p.provolatile
        from pg_catalog.pg_proc p
       where p.oid = 'public.get_season_cup_bracket(uuid)'::regprocedure) <> 's' then
    raise exception 'The bracket read must be stable, so that it cannot write';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name = 'get_season_cup_bracket'
       and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'The bracket read must not be executable anonymously';
  end if;
end;
$$;

commit;
