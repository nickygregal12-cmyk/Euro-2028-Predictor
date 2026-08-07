-- Contract 131: the retention tables can name their players.
--
-- ---------------------------------------------------------------------------
-- WHAT CONTRACT 122 DECIDED, AND WHY THIS DOES NOT REVERSE IT
-- ---------------------------------------------------------------------------
--
-- `get_season_period_standings` returns `entry_id` and no display name, and
-- said why: "a retention view showing the same names in a different order is a
-- presentation decision and the surface consuming this can take the names from
-- the read it already makes."
--
-- That holds where the monthly table sits beside the cumulative one. It does
-- not hold where it does not — an entry id is not a person, and a surface with
-- no leaderboard beside it renders every opponent as "Entrant". Measured:
-- `get_season_period_standings` is the only season read that returns a player
-- identifier a browser cannot resolve, because `public.entries` is revoked from
-- every browser role and no function maps an entry to a name.
--
-- So the naming is OPTIONAL and defaults to off. A caller that already holds
-- the names asks for exactly what contract 122 returns, byte for byte; a caller
-- that does not asks for them. The decision contract 122 made is preserved as
-- the default rather than overturned.
--
-- ---------------------------------------------------------------------------
-- ONE SIGNATURE, AND WHY THE OBVIOUS ROUTES ARE ALL CLOSED
-- ---------------------------------------------------------------------------
--
-- This was arrived at by elimination, and the eliminated options are recorded
-- because each looks right until it meets a guard this repository already has.
--
--   A DEFAULTED fourth parameter does not replace the existing function, it
--   OVERLOADS it — and a three-argument call then matches both, which
--   PostgreSQL rejects as not unique.
--
--   DROPPING the three-argument signature avoids the overload and is
--   destructive at migration level. The additive checker refuses it, correctly:
--   one optional display name is not a reason to put a whole batch through the
--   backup-and-rehearsal rollout.
--
--   KEEPING BOTH ARITIES, the shorter one a delegation, needs both granted to
--   `authenticated` — and `rpcAllowlistParity` requires every granted RPC to be
--   declared in the deployment contract, while the contract validator refuses
--   two entries with the same NAME. Two invariants, met head-on.
--
-- So there is ONE signature with a required fourth parameter. The three-
-- argument function is left in place — dropping it is the destructive route
-- above — and REVOKED, which is additive, so nothing can reach a second body of
-- the same read. Its one caller,
-- `src/services/supabase/seasonPeriodStandings.ts`, moves in this change.
--
-- ---------------------------------------------------------------------------
-- THE AUTHORITIES ARE NOT TOUCHED
-- ---------------------------------------------------------------------------
--
-- `season_monthly_standings` and `season_form_standings` are parity-checked
-- against `src/domain/season/standings.ts`, including array ORDER. Adding a key
-- inside them would put profile data into a function whose whole job is to
-- agree with a pure domain module. The naming happens above them, as a mapping
-- over what they returned, so the rows keep their order and their values and
-- gain one key.
--
-- No score, standing or settlement is written, and the boundary is unchanged:
-- contract 95's rule, the caller must hold an entry in the season.

begin;

-- ---------------------------------------------------------------------------
-- The mapping.
--
-- Order-preserving by construction: `jsonb_agg` over `with ordinality` returns
-- the array in its original order, so a caller comparing the named rows with
-- the unnamed ones sees the same sequence.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.name_season_standing_rows(
  p_tournament_id uuid,
  p_rows jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $named$
  select coalesce(
    (
      select jsonb_agg(
        row.value || jsonb_build_object(
          -- Null rather than a placeholder when an entry has no profile. A
          -- caller can render its own fallback; a server-invented name would be
          -- indistinguishable from a real one.
          'display_name', profile.display_name
        )
        order by row.ordinality
      )
      from jsonb_array_elements(p_rows) with ordinality as row(value, ordinality)
      left join public.entries entry
        on entry.id = (row.value ->> 'entry_id')::uuid
       and entry.tournament_id = p_tournament_id
      left join public.profiles profile on profile.id = entry.user_id
    ),
    '[]'::jsonb
  );
$named$;

revoke all on function predictor_internal.name_season_standing_rows(uuid, jsonb)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The read, with the old signature retired in the same transaction.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_period_standings(
  p_tournament_id uuid,
  p_period text,
  p_window integer,
  p_include_names boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_period text;
  v_payload jsonb;
  v_rows jsonb;
begin
  if p_tournament_id is null then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  v_period := lower(btrim(coalesce(p_period, '')));
  if v_period not in ('month', 'form') then
    raise exception 'Unknown standings period' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.tournaments season
     where season.id = p_tournament_id
       and season.kind = 'league_season'
  ) then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  -- Checked after the season is known to exist, so a non-member and a
  -- nonexistent season are not distinguishable by error code, and before any
  -- score is read.
  if not exists (
    select 1
      from public.entries entry
     where entry.tournament_id = p_tournament_id
       and entry.user_id = v_uid
  ) then
    raise exception 'This season is not yours to read' using errcode = '42501';
  end if;

  if v_period = 'form' then
    v_rows := predictor_internal.season_form_standings(p_tournament_id, p_window);

    if p_include_names then
      v_rows := predictor_internal.name_season_standing_rows(p_tournament_id, v_rows);
    end if;

    return jsonb_build_object(
      'period', 'form',
      'window', p_window,
      'months', null,
      'rows', v_rows
    );
  end if;

  v_payload := predictor_internal.season_monthly_standings(p_tournament_id);

  -- NULL here is the unplaceable-matchweek refusal, not an empty season. It
  -- raises rather than returning an empty array, because the whole point of
  -- the guard is that a plausible-looking table would be wrong — and because
  -- an operator can act on "the calendar is not derived" and cannot act on a
  -- month that quietly went missing.
  if v_payload is null then
    raise exception
      'This season has a settled matchweek with no play window, so its monthly table cannot be built'
      using errcode = '55000';
  end if;

  if p_include_names then
    -- One month at a time, keeping the month order the authority produced.
    select coalesce(jsonb_agg(
      jsonb_set(
        month.value,
        '{rows}',
        predictor_internal.name_season_standing_rows(
          p_tournament_id, month.value -> 'rows')
      )
      order by month.ordinality
    ), '[]'::jsonb)
      into v_payload
      from jsonb_array_elements(v_payload) with ordinality as month(value, ordinality);
  end if;

  return jsonb_build_object(
    'period', 'month',
    'window', null,
    'months', v_payload,
    'rows', null
  );
end;
$$;

revoke all on function public.get_season_period_standings(uuid, text, integer, boolean)
  from public, anon;
grant execute on function public.get_season_period_standings(uuid, text, integer, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- The three-argument signature, retired.
--
-- Left in place rather than dropped, because dropping is the destructive route
-- this contract exists to avoid; revoked so that no caller can reach a second
-- body of the same read and the two cannot answer differently.
-- ---------------------------------------------------------------------------

revoke all on function public.get_season_period_standings(uuid, text, integer)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  -- Exactly one REACHABLE definition. The retired three-argument form is still
  -- in the catalogue — dropping it is the destructive route — so what is
  -- asserted is that nobody can call it.
  if exists (
    select 1 from pg_proc proc
     join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = 'get_season_period_standings'
      and proc.oid = to_regprocedure('public.get_season_period_standings(uuid,text,integer)')
      and (
        has_function_privilege('anon', proc.oid, 'EXECUTE')
        or has_function_privilege('authenticated', proc.oid, 'EXECUTE')
        or has_function_privilege('service_role', proc.oid, 'EXECUTE')
      )
  ) then
    raise exception 'the retired three-argument period standings read is still reachable';
  end if;

  if not exists (
    select 1 from pg_proc proc
     join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = 'get_season_period_standings'
      and proc.oid = to_regprocedure('public.get_season_period_standings(uuid,text,integer,boolean)')
      and has_function_privilege('authenticated', proc.oid, 'EXECUTE')
  ) then
    raise exception 'the period standings read is reachable by nobody at all';
  end if;

  -- The authorities are untouched. Their parity with the TypeScript is what
  -- makes the tables trustworthy, and a profile join inside either would end it.
  if (
    select pg_catalog.pg_get_functiondef(to_regprocedure(
      'predictor_internal.season_monthly_standings(uuid)'))
  ) like '%public.profiles%'
  or (
    select pg_catalog.pg_get_functiondef(to_regprocedure(
      'predictor_internal.season_form_standings(uuid, integer)'))
  ) like '%public.profiles%' then
    raise exception 'a period standings authority reads profiles';
  end if;
end;
$$;

commit;
