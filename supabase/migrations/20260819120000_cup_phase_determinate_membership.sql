-- ===========================================================================
-- Contract 207 — `get_season_cup_phase` answers about a determinate row
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
-- Against `main` at `d7a09e8` — which carries PR #920's
-- `20260819110000_same_season_player_profile.sql` as contract 206 — the
-- determinate-membership fix in this file is the 207th migration and the
-- bracket-outcome file beside it is the 208th, which is what they are called
-- throughout.
--
-- **PR #920 LANDED FIRST.** Its timestamp (`20260819110000`) sorts BEFORE both
-- of these, so the pair was swept forward from 206/207 to 207/208 when this
-- branch was re-anchored. That was a mechanical rename of a stated number, not
-- a change of behaviour, and it was recorded here before it happened rather
-- than discovered by whichever branch merged second.
--
-- WHAT WAS WRONG
--
-- Contract 120's membership lookup was:
--
--     select member.group_id, member.phase_kind
--       into v_group_id, v_phase_kind
--       from public.bonus_cup_members member
--      where member.competition_id = p_competition_id
--        and member.user_id = v_uid;
--
-- no `phase_kind`, no `order by`, no `limit`. Contract 102 keys that table
-- `(competition_id, user_id, phase_kind)` precisely so one entrant can hold
-- BOTH an `initial` and a `split` membership, and contract 124's split
-- transition inserts the second without deleting the first.
--
-- A scalar subquery over two rows raises `21000`. A PL/pgSQL `select ... into`
-- over two rows does not: it takes one, silently. Driven on PostgreSQL 16
-- against the real key shape, with one entrant holding both memberships:
--
--     CURRENT (seq scan)  -> initial / aaaaaaaa-…   <- the PRE-SPLIT group
--     PINNED              -> split   / bbbbbbbb-…
--
-- So a split entrant was shown their pre-split group, that group's members,
-- that group's table and — through contract 133, which takes its group from
-- this function — that group's fixtures, with no error anywhere. This is
-- contract 205's defect in its quieter and worse form: 193 used a scalar
-- subquery, so it raised and was found; 120 chooses.
--
-- It is not confined to any one lane. `src/services/supabase/seasonCup.ts`
-- calls this function in the production Football Hub today.
--
-- WHY `split` IS THE ANSWER, AND WHY THAT IS NOT A PREFERENCE
--
-- The function is named for the caller's PHASE. A split membership exists only
-- after contract 124 has moved the competition into its split, so holding one
-- is the fact that the caller's current phase is the split — not a tie-break
-- between two equally good answers. The initial row remains, correctly, as the
-- permanent roster every points authority already pins itself to
-- (`cup_tournament_fixture_points`, `cup_season_fixture_points` and contract
-- 124's own settlement query all carry `phase_kind = 'initial'`).
--
-- Naming the phase in the predicate makes the PRIMARY KEY identify the row, so
-- the read is determinate by the schema rather than by an ordering. `limit 1`
-- would have been determinate only until the ordering changed.
--
-- WHAT THIS DOES NOT CHANGE
--
-- The signature, the volatility, the grants, the security context, the
-- entrancy gate, the non-entrant `entered: false` shape, the emitted keys and
-- their order, the dispatch between `cup_split_group_tables` and
-- `cup_initial_group_tables`, and the `table_source` vocabulary. A caller who
-- holds ONE membership is answered exactly as before — which is every entrant
-- in every competition that has not split.
--
-- The payload shape is unchanged, so no consumer needs a change to be correct:
-- `src/services/supabase/seasonCup.ts` already decodes `phase_kind: 'split'`
-- and `table_source: 'split'`. What changes is that a split entrant now
-- receives them.
-- ---------------------------------------------------------------------------

begin;

create or replace function public.get_season_cup_phase(
  p_competition_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $get_season_cup_phase$
declare
  v_uid uuid := (select auth.uid());
  v_group_id uuid;
  v_phase_kind text;
  v_group record;
  v_table jsonb;
begin
  if p_competition_id is null then
    raise exception 'Competition is required' using errcode = '22023';
  end if;

  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  -- The caller's own membership, and only their own. Everything below is
  -- scoped by the group this resolves to.
  --
  -- CONTRACT 206. THE PHASE IS PINNED, AND THE PIN IS NOT A TIE-BREAK.
  --
  -- `bonus_cup_members` is keyed `(competition_id, user_id, phase_kind)`
  -- (contract 102) and contract 124's split transition INSERTS the split row
  -- without deleting the initial one, so a split entrant holds two rows. The
  -- predicate below was `competition_id` and `user_id` alone, which matches
  -- both — and a PL/pgSQL `select ... into` over two rows takes one and raises
  -- nothing, so the caller was silently shown their PRE-SPLIT group, its
  -- members, its table and (through contract 133) its fixtures.
  --
  -- Naming the phase makes the primary key identify the row, exactly as
  -- contract 205 made `bonus_cup_members_split_metadata_empty` identify the
  -- seed row. `limit 1` with an ordering would have been the tie-break, and it
  -- would be wrong the day a third phase kind existed; this predicate answers
  -- the question the function is named for instead: WHICH PHASE IS THIS CALLER
  -- IN NOW. A split membership only exists once contract 124 has run, so its
  -- presence is the fact, not a preference between two candidate answers.
  select member.group_id, member.phase_kind
    into v_group_id, v_phase_kind
    from public.bonus_cup_members member
   where member.competition_id = p_competition_id
     and member.user_id = v_uid
     and member.phase_kind = case
           when exists (
             select 1
               from public.bonus_cup_members later
              where later.competition_id = p_competition_id
                and later.user_id = v_uid
                and later.phase_kind = 'split')
           then 'split'
           else 'initial'
         end;

  if v_group_id is null then
    return pg_catalog.jsonb_build_object(
      'competition_id', p_competition_id,
      'entered', false
    );
  end if;

  select grp.id, grp.ordinal, grp.size, grp.phase_kind, grp.parent_group_id
    into v_group
    from public.bonus_cup_groups grp
   where grp.id = v_group_id;

  -- The table for the caller's own group, from whichever authority owns that
  -- phase. Ordered by the rank the authority assigned rather than re-derived.
  if v_phase_kind = 'split' then
    select coalesce(
             pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'user_id', t.user_id,
                 'is_you', t.user_id = v_uid,
                 'group_rank', t.group_rank,
                 'table_points', t.table_points,
                 'points_for', t.points_for,
                 'points_against', t.points_against,
                 'window_points', t.window_points,
                 'exacts', t.exacts,
                 'corrects', t.corrects,
                 'scoreline_error', t.scoreline_error
               )
               order by t.group_rank, t.user_id
             ),
             '[]'::jsonb
           )
      into v_table
      from predictor_internal.cup_split_group_tables(p_competition_id) t
     where t.group_id = v_group_id;
  else
    select coalesce(
             pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'user_id', t.user_id,
                 'is_you', t.user_id = v_uid,
                 'group_rank', t.group_rank,
                 'table_points', t.table_points,
                 'points_for', t.points_for,
                 'points_against', t.points_against,
                 'window_points', t.window_points,
                 'exacts', t.exacts,
                 'corrects', t.corrects,
                 'scoreline_error', t.scoreline_error
               )
               order by t.group_rank, t.user_id
             ),
             '[]'::jsonb
           )
      into v_table
      from predictor_internal.cup_initial_group_tables(p_competition_id) t
     where t.group_id = v_group_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'competition_id', p_competition_id,
    'entered', true,
    'phase_kind', v_phase_kind,
    'table_source', case
                      when v_phase_kind = 'split' then 'split'
                      when predictor_internal.cup_is_league_season(p_competition_id)
                        then 'season_initial'
                      else 'tournament_initial'
                    end,
    'group', pg_catalog.jsonb_build_object(
      'id', v_group.id,
      'ordinal', v_group.ordinal,
      'size', v_group.size,
      'phase_kind', v_group.phase_kind,
      'parent_group_id', v_group.parent_group_id
    ),
    'table', coalesce(v_table, '[]'::jsonb)
  );
end;
$get_season_cup_phase$;
revoke all on function public.get_season_cup_phase(uuid) from public, anon, authenticated;
grant execute on function public.get_season_cup_phase(uuid) to authenticated;

comment on function public.get_season_cup_phase(uuid) is
  'Contract 120, amended by contracts 169 and 206. The caller''s own Predictor '
  'Championship phase and the table for their own group, taken from the '
  'authority that owns that phase: cup_split_group_tables for a split group '
  'and cup_initial_group_tables otherwise, which is the season table for a '
  'league season and the tournament table for a tournament. The membership '
  'lookup is pinned to the caller''s CURRENT phase — the split row where one '
  'exists, the initial row otherwise — so the primary key identifies exactly '
  'one row and a split entrant is never silently answered about their '
  'pre-split group. Adds no rule and recomputes nothing. A non-entrant '
  'receives entered=false rather than an exception.';

-- ---------------------------------------------------------------------------
-- Prove the properties against the INSTALLED text, in the same transaction.
--
-- The same technique contract 205 used, and for the same reason: hand-copying
-- the body of one of these functions and reading it afterwards does not catch
-- a substituted predicate.
-- ---------------------------------------------------------------------------

do $guard$
declare
  v_read text := pg_get_functiondef('public.get_season_cup_phase(uuid)'::regprocedure);
begin
  -- The pin itself. Without it the read is indeterminate for a split entrant.
  if v_read !~ 'later\.phase_kind = ''split''' then
    raise exception 'Contract 207: the membership lookup is not pinned to a phase';
  end if;

  -- Determinacy must come from the KEY, not from an ordering. A `limit` here
  -- would mean the answer depends on a plan.
  if v_read ~* 'from public\.bonus_cup_members member.*limit' then
    raise exception 'Contract 207: the membership lookup resolves by ordering, not by key';
  end if;

  -- The dispatcher, the entrancy gate and the non-entrant shape are carried.
  if v_read !~ 'cup_split_group_tables' or v_read !~ 'cup_initial_group_tables' then
    raise exception 'Contract 207: the phase dispatcher was lost';
  end if;
  if v_read !~ '''entered'', false' then
    raise exception 'Contract 207: the non-entrant shape was lost';
  end if;
  if v_read !~ 'table_source' then
    raise exception 'Contract 207: contract 169''s table_source key was lost';
  end if;

  -- It reads the caller's own membership and nobody else's.
  if v_read !~ 'member\.user_id = v_uid' then
    raise exception 'Contract 207: the caller scope was lost';
  end if;

  -- It still computes nothing. A rank, a total or a sort here would be this
  -- read becoming a second standings authority.
  if v_read ~* '\morder by t\.(table_points|points_for|window_points)' then
    raise exception 'Contract 207: the read re-ranks a table it was given';
  end if;
end;
$guard$;

commit;
