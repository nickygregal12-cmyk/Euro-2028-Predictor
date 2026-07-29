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

select ok(
  position(
    'predictor_internal.cup_final_group_tables(p_competition_id) gate'
    in lower(pg_get_functiondef(
      'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure
    ))
  ) > 0,
  'qualification and seeding read the authoritative final table function directly'
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
