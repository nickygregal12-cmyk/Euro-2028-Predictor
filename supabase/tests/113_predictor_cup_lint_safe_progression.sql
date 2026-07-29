begin;

select plan(6);

select ok(
  position(
    'pg_temp.cup_round_seats'
    in pg_get_functiondef(
      'public.admin_settle_predictor_cup_round(uuid,uuid)'::regprocedure
    )
  ) = 0,
  'the Cup settle function no longer references an unresolved pg_temp relation'
);

select ok(
  position(
    'create temporary table cup_round_seats'
    in lower(pg_get_functiondef(
      'public.admin_settle_predictor_cup_round(uuid,uuid)'::regprocedure
    ))
  ) = 0,
  'the Cup settle function no longer creates a temporary seat table'
);

select ok(
  position(
    'with cup_round_seats as'
    in lower(pg_get_functiondef(
      'public.admin_settle_predictor_cup_round(uuid,uuid)'::regprocedure
    ))
  ) > 0,
  'the fixed seeded seat handoff uses a lint-resolvable CTE'
);

select ok(
  position(
    'for v_slot in'
    in lower(pg_get_functiondef(
      'public.admin_settle_predictor_cup_round(uuid,uuid)'::regprocedure
    ))
  ) > 0,
  'the playoff progression loop uses the non-shadowing slot variable'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.admin_settle_predictor_cup_round(uuid,uuid)',
    'execute'
  ),
  'authenticated users still cannot settle a Predictor Cup round'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.admin_settle_predictor_cup_round(uuid,uuid)',
    'execute'
  ),
  'service_role retains the Predictor Cup round-settle capability'
);

select * from finish();
rollback;
