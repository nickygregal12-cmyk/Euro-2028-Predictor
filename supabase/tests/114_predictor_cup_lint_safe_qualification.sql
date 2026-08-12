begin;

select plan(8);

select ok(
  position(
    'pg_temp.cup_gate_tables'
    in pg_get_functiondef(
      'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure
    )
  ) = 0,
  'the Cup qualification gate no longer references an unresolved pg_temp relation'
);

select ok(
  position(
    'create temporary table cup_gate_tables'
    in lower(pg_get_functiondef(
      'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure
    ))
  ) = 0,
  'the Cup qualification gate no longer creates a temporary table'
);

-- Contract 187 moved this from `cup_final_group_tables` to
-- `cup_initial_group_tables`, contract 169's dispatcher, and the assertion is
-- corrected rather than deleted because its SUBJECT has not changed: contract 60
-- removed a temporary relation from this driver and required it to read an
-- authoritative table function directly, which it still does.
--
-- What changed is WHICH authority. `cup_final_group_tables` measures four of its
-- nine ADR 0014 § 5.2 keys over `sequence between 1 and 3` — correct for the
-- tournament, wrong for a season group stage of fourteen or thirty-eight — and
-- the dispatcher returns exactly those rows for a tournament while returning
-- contract 169's season table for a league season. So the tournament reads the
-- same numbers it always did, through one more hop.
--
-- The `gate` alias is kept in the match. Without it this would also pass on the
-- single unaliased `count(*)` read, which is not the qualification-and-seeding
-- read the assertion is about.
select ok(
  position(
    'predictor_internal.cup_initial_group_tables(p_competition_id) gate'
    in lower(pg_get_functiondef(
      'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure
    ))
  ) > 0,
  'qualification and seeding read the authoritative table function directly, through contract 169''s dispatcher'
);

select ok(
  position(
    'array[]::integer[]'
    in lower(pg_get_functiondef(
      'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure
    ))
  ) > 0,
  'playoff seed arrays use explicit integer-array defaults'
);

select ok(
  position(
    '  v_slot integer;'
    in pg_get_functiondef(
      'public.admin_settle_predictor_cup_round(uuid,uuid)'::regprocedure
    )
  ) = 0,
  'the Cup settle loop has no shadowing explicit integer declaration'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname in ('public','predictor_internal')
      and p.prokind = 'f'
      and l.lanname in ('plpgsql','sql')
      and (
        pg_get_functiondef(p.oid) ilike '%pg_temp.%'
        or pg_get_functiondef(p.oid) ilike '%create temporary table%'
      )
  ),
  'no application SQL function retains a temporary-table dependency'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.admin_finalise_predictor_cup_groups(uuid)',
    'execute'
  ),
  'authenticated users still cannot finalise Predictor Cup groups'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.admin_finalise_predictor_cup_groups(uuid)',
    'execute'
  ),
  'service_role retains the Predictor Cup qualification capability'
);

select * from finish();
rollback;
